# Dashboard Performance Optimization - Implementation Guide

## Phase 1: Quick Wins (30-40% Improvement)

### Change 1: Add Database Indexes

**File:** `backend/models/DocuSignTemplate.js`

Add these compound indexes to the schema:

```javascript
// Add these after existing indexes (around line 210)
// Compound indexes for common queries
templateSchema.index({ createdBy: 1, isArchived: 1 });
templateSchema.index({ createdBy: 1, status: 1, isArchived: 1 });
templateSchema.index({ "signatureFields.recipientId": 1, isArchived: 1, status: 1 });
templateSchema.index({ "recipients.email": 1, isArchived: 1, status: 1 });
templateSchema.index({ updatedAt: -1, isArchived: 1 });
```

**MongoDB Command to Create Indexes:**

```javascript
// Run in MongoDB shell
db.docusigntemplates.createIndex({ createdBy: 1, isArchived: 1 });
db.docusigntemplates.createIndex({ createdBy: 1, status: 1, isArchived: 1 });
db.docusigntemplates.createIndex({ "signatureFields.recipientId": 1, isArchived: 1, status: 1 });
db.docusigntemplates.createIndex({ "recipients.email": 1, isArchived: 1, status: 1 });
db.docusigntemplates.createIndex({ updatedAt: -1, isArchived: 1 });
```

---

### Change 2: Remove Duplicate Activity Fetch

**File:** `frontend/src/app/dashboard/DashboardClient.tsx`

**Before:**

```typescript
// Line 82-85
const { data: activitiesData } = useQuery({
	queryKey: ["activities"],
	queryFn: getRecentActivities,
});
```

**After:**

```typescript
// Line 82-87 - Use cached prefetched data
const { data: activitiesData } = useQuery({
	queryKey: ["activities"],
	// Remove queryFn to use hydrated cache from server
	enabled: false, // Prevent automatic refetches
	gcTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

---

### Change 3: Parallelize API Calls

**File:** `frontend/src/app/dashboard/DashboardClient.tsx`

**Before:**

```typescript
// Lines 92-167 - Three separate useEffect hooks
useEffect(() => {
	const loadInbox = async () => {
		try {
			const res = await fetch("/api/dashboard/inbox", { credentials: "include" });
			if (res.ok) {
				const json = await res.json();
				if (json && json.success && Array.isArray(json.data)) {
					setInbox(json.data);
				}
			}
		} catch (e) {
			console.error("Failed to load inbox", e);
		}
	};
	loadInbox();
}, []);

useEffect(() => {
	loadUserStats();
}, [loadUserStats]);
```

**After:**

```typescript
// Replace with parallel execution
useEffect(() => {
	const loadDashboardData = async () => {
		try {
			const [statsRes, inboxRes] = await Promise.all([
				fetch("/api/dashboard/stats", { credentials: "include" }),
				fetch("/api/dashboard/inbox", { credentials: "include" }),
			]);

			// Process stats
			if (statsRes.ok) {
				const json = await statsRes.json();
				if (json?.success && json?.data) {
					setStats({
						totalDocuments: json.data.totalDocuments || 0,
						pendingSignatures: json.data.pendingSignatures || 0,
						completedSignatures: json.data.completedSignatures || 0,
						subscriptionStatus: "Free Plan",
						owner: json.data.owner,
						assigned: json.data.assigned,
					});
					if (json.data.usage) {
						setUsage(json.data.usage as FreeUsage);
					}
				}
			}

			// Process inbox
			if (inboxRes.ok) {
				const json = await inboxRes.json();
				if (json?.success && Array.isArray(json.data)) {
					setInbox(json.data);
				}
			}

			// Fetch subscription info
			try {
				const subRes = await fetch("/api/subscription/me", { credentials: "include" });
				if (subRes.ok) {
					const subData = await subRes.json();
					setSubscription(subData.subscription);
					// Update stats with subscription info
					setStats((prev) => ({
						...prev!,
						subscriptionStatus: subData.subscription?.planId?.name || "Free Plan",
					}));
				}
			} catch (err) {
				console.error("Failed to load subscription:", err);
			}
		} catch (error) {
			console.error("Failed to load dashboard data:", error);
		} finally {
			setLoading(false);
		}
	};

	loadDashboardData();
}, []);
```

---

### Change 4: Optimize Field Selection (Reduce Payload)

**File:** `backend/controllers/dashboardController.js`

**Before (Line 131):**

```javascript
const templates = await DocuSignTemplate.find(assignedFilter)
	.sort({ updatedAt: -1 })
	.select("name status createdAt updatedAt finalPdfUrl metadata recipients message")
	.populate("createdBy", "firstName lastName email")
	.lean();
```

**After (Optimized):**

```javascript
const templates = await DocuSignTemplate.find(assignedFilter)
	.sort({ updatedAt: -1 })
	.select("name status updatedAt createdBy")
	.populate("createdBy", "firstName lastName email")
	.lean();
```

And update the mapping to include only essential data:

```javascript
const items = templates.map((t) => ({
	id: t._id,
	name: t.name || "Untitled",
	status: t.status,
	updatedAt: t.updatedAt,
	sender: t.createdBy
		? `${t.createdBy.firstName || ""} ${t.createdBy.lastName || ""}`.trim() || t.createdBy.email
		: "Unknown",
}));
```

Also update the response to remove redundant fields:

**Before:**

```javascript
return res.status(200).json({
	success: true,
	data: {
		totalDocuments,
		pendingSignatures,
		completedSignatures,
		owner: { total: totalDocuments, pending: ownerPending, completed: ownerCompleted },
		assigned: { total: assignedTotal, pending: pendingSignatures, completed: completedSignatures },
		usage,
	},
});
```

**After:**

```javascript
return res.status(200).json({
	success: true,
	data: {
		owner: { total: totalDocuments, pending: ownerPending, completed: ownerCompleted },
		assigned: { total: assignedTotal, pending: pendingSignatures, completed: completedSignatures },
		usage,
	},
});
```

---

## Phase 2: Core Optimizations (Additional 30-40% Improvement)

### Change 5: Use Aggregation Pipeline for Stats

**File:** `backend/controllers/dashboardController.js`

Replace the entire `getUserStats` function with optimized aggregation pipeline:

```javascript
export const getUserStats = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Use aggregation pipeline for owner stats - single query instead of 3
		const ownerStatsResult = await DocuSignTemplate.aggregate([
			{
				$match: {
					createdBy: userId,
					isArchived: { $ne: true },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
					completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
				},
			},
		]);

		const ownerStats = ownerStatsResult[0] || { total: 0, pending: 0, completed: 0 };

		// Build assigned filter with $or conditions
		const assignedOrConditions = [
			{ "signatureFields.recipientId": String(userId) },
			{ "recipients.userId": userId },
			{ "recipients.id": String(userId) },
		];
		if (email) {
			assignedOrConditions.push({ "recipients.email": email });
		}

		// Use aggregation pipeline for assigned stats - single query instead of 3
		const assignedStatsResult = await DocuSignTemplate.aggregate([
			{
				$match: {
					isArchived: { $ne: true },
					$or: assignedOrConditions,
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
					completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
				},
			},
		]);

		const assignedStats = assignedStatsResult[0] || { total: 0, pending: 0, completed: 0 };

		// Check subscription status - single query
		const now = new Date();
		const activeSub = await Subscription.findOne({
			userId,
			status: "active",
			$or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
		}).select("_id"); // Only check existence, no need for full document

		let usage = null;
		if (!activeSub) {
			const { uploadLimit, signedLimit } = getFreeTierLimits();

			// Get usage stats with aggregation - replaces 2 more queries
			const usageResult = await DocuSignTemplate.aggregate([
				{
					$match: {
						createdBy: userId,
						isArchived: { $ne: true },
					},
				},
				{
					$group: {
						_id: null,
						uploadsUsed: { $sum: 1 },
						signUsed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
					},
				},
			]);

			const usageData = usageResult[0] || { uploadsUsed: 0, signUsed: 0 };

			usage = {
				hasActiveSubscription: false,
				uploads: { used: usageData.uploadsUsed, limit: uploadLimit },
				signs: { used: usageData.signUsed, limit: signedLimit },
			};
		} else {
			usage = { hasActiveSubscription: true };
		}

		return res.status(200).json({
			success: true,
			data: {
				owner: {
					total: ownerStats.total,
					pending: ownerStats.pending,
					completed: ownerStats.completed,
				},
				assigned: {
					total: assignedStats.total,
					pending: assignedStats.pending,
					completed: assignedStats.completed,
				},
				usage,
			},
		});
	} catch (error) {
		console.error("getUserStats error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to compute stats" });
	}
};
```

**Benefits of this approach:**

- Reduces DB queries from 9 to 3-4
- Single aggregation query gets all counts (total, pending, completed) in one pass
- Database does the filtering, not JavaScript
- Expected: **150-250ms faster**

---

### Change 6: Add Pagination to Inbox

**File:** `backend/controllers/dashboardController.js`

Update the `getInbox` function:

```javascript
export const getInbox = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;
		const { page = 1, limit = 10 } = req.query; // Add pagination params

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Find templates where the user is a recipient
		const assignedFilter = {
			isArchived: { $ne: true },
			$or: [
				{ "signatureFields.recipientId": String(userId) },
				{ "recipients.userId": userId },
				{ "recipients.id": String(userId) },
			],
		};

		if (email) {
			assignedFilter.$or.push({ "recipients.email": email });
		}

		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const total = await DocuSignTemplate.countDocuments(assignedFilter);

		const templates = await DocuSignTemplate.find(assignedFilter)
			.sort({ updatedAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.select("name status createdAt updatedAt finalPdfUrl metadata recipients message")
			.populate("createdBy", "firstName lastName email")
			.lean();

		const items = templates.map((t) => ({
			id: t._id,
			name: t.name || t.metadata?.filename || "Untitled",
			status: t.status,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
			finalPdfUrl: t.finalPdfUrl || (t.metadata && t.metadata.originalPdfPath) || "",
			sender: t.createdBy
				? `${t.createdBy.firstName || ""} ${t.createdBy.lastName || ""}`.trim() || t.createdBy.email
				: "Unknown",
			message: t.message || { subject: "", body: "" },
			myRecipientInfo:
				t.recipients?.find(
					(r) =>
						r.userId?.toString() === userId.toString() ||
						r.id === String(userId) ||
						r.email === email
				) || null,
		}));

		return res.status(200).json({
			success: true,
			data: items,
			pagination: {
				current: parseInt(page),
				total,
				pages: Math.ceil(total / parseInt(limit)),
				limit: parseInt(limit),
			},
		});
	} catch (error) {
		console.error("getInbox error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to load inbox" });
	}
};
```

**Frontend Update:** `frontend/src/app/dashboard/DashboardClient.tsx`

Update the inbox fetch and display:

```typescript
// Add state for pagination
const [inboxPage, setInboxPage] = useState(1);
const [inboxTotal, setInboxTotal] = useState(0);
const [inboxPages, setInboxPages] = useState(0);
const INBOX_LIMIT = 10;

// Update inbox fetch to use pagination
const loadInbox = async (pageNum: number = 1) => {
  try {
    const res = await fetch(`/api/dashboard/inbox?page=${pageNum}&limit=${INBOX_LIMIT}`, {
      credentials: "include"
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setInbox(json.data);
        setInboxPage(json.pagination?.current || 1);
        setInboxTotal(json.pagination?.total || 0);
        setInboxPages(json.pagination?.pages || 0);
      }
    }
  } catch (e) {
    console.error("Failed to load inbox", e);
  }
};

// In the inbox rendering section, add pagination controls:
{inbox && inbox.length > 0 ? (
  <>
    <ul className="space-y-3">
      {/* ... existing inbox items ... */}
    </ul>

    {/* Pagination Controls */}
    {inboxPages > 1 && (
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
        <div className="text-sm text-gray-400">
          Showing {(inboxPage - 1) * INBOX_LIMIT + 1} to {Math.min(inboxPage * INBOX_LIMIT, inboxTotal)} of {inboxTotal} documents
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadInbox(Math.max(1, inboxPage - 1))}
            disabled={inboxPage === 1}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm"
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, inboxPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => loadInbox(pageNum)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    inboxPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => loadInbox(Math.min(inboxPages, inboxPage + 1))}
            disabled={inboxPage === inboxPages}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm"
          >
            Next
          </button>
        </div>
      </div>
    )}
  </>
) : (
  // ... empty state ...
)}
```

**Benefits:**

- First load: 10 items instead of 50+ → 60% smaller payload
- Better user experience with pagination
- Faster subsequent page loads
- Expected: **200-300ms faster first load**

---

## Phase 3: Advanced Optimizations (Additional 20-30% Improvement)

### Change 7: Consolidate APIs (Optional but Recommended)

Create a new consolidated endpoint that fetches all dashboard data in one request.

**File:** `backend/routes/dashboard.js`

```javascript
import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
	getUserStats,
	getInbox,
	getDashboardOverview,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", authenticateToken, getUserStats);
router.get("/inbox", authenticateToken, getInbox);
router.get("/overview", authenticateToken, getDashboardOverview); // New consolidated endpoint

export default router;
```

**File:** `backend/controllers/dashboardController.js`

Add this new function:

```javascript
export const getDashboardOverview = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;
		const { inboxPage = 1, inboxLimit = 10 } = req.query;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Fetch all data in parallel
		const [statsData, inboxData, subscriptionData] = await Promise.all([
			// Stats aggregation
			(async () => {
				const ownerStatsResult = await DocuSignTemplate.aggregate([
					{ $match: { createdBy: userId, isArchived: { $ne: true } } },
					{
						$group: {
							_id: null,
							total: { $sum: 1 },
							pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
							completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
						},
					},
				]);

				const assignedOrConditions = [
					{ "signatureFields.recipientId": String(userId) },
					{ "recipients.userId": userId },
					{ "recipients.id": String(userId) },
				];
				if (email) assignedOrConditions.push({ "recipients.email": email });

				const assignedStatsResult = await DocuSignTemplate.aggregate([
					{ $match: { isArchived: { $ne: true }, $or: assignedOrConditions } },
					{
						$group: {
							_id: null,
							total: { $sum: 1 },
							pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
							completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
						},
					},
				]);

				return {
					owner: ownerStatsResult[0] || { total: 0, pending: 0, completed: 0 },
					assigned: assignedStatsResult[0] || { total: 0, pending: 0, completed: 0 },
				};
			})(),

			// Inbox data
			(async () => {
				const assignedFilter = {
					isArchived: { $ne: true },
					$or: [
						{ "signatureFields.recipientId": String(userId) },
						{ "recipients.userId": userId },
						{ "recipients.id": String(userId) },
					],
				};
				if (email) assignedFilter.$or.push({ "recipients.email": email });

				const skip = (parseInt(inboxPage) - 1) * parseInt(inboxLimit);
				const total = await DocuSignTemplate.countDocuments(assignedFilter);

				const templates = await DocuSignTemplate.find(assignedFilter)
					.sort({ updatedAt: -1 })
					.skip(skip)
					.limit(parseInt(inboxLimit))
					.select("name status updatedAt createdBy")
					.populate("createdBy", "firstName lastName email")
					.lean();

				return {
					items: templates.map((t) => ({
						id: t._id,
						name: t.name || "Untitled",
						status: t.status,
						updatedAt: t.updatedAt,
						sender: t.createdBy
							? `${t.createdBy.firstName || ""} ${t.createdBy.lastName || ""}`.trim() ||
							  t.createdBy.email
							: "Unknown",
					})),
					pagination: {
						current: parseInt(inboxPage),
						total,
						pages: Math.ceil(total / parseInt(inboxLimit)),
						limit: parseInt(inboxLimit),
					},
				};
			})(),

			// Subscription data
			(async () => {
				const now = new Date();
				const activeSub = await Subscription.findOne({
					userId,
					status: "active",
					$or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
				});

				return {
					hasActiveSubscription: !!activeSub,
					subscription: activeSub,
				};
			})(),
		]);

		return res.status(200).json({
			success: true,
			data: {
				stats: statsData,
				inbox: inboxData,
				subscription: subscriptionData.subscription,
				hasActiveSubscription: subscriptionData.hasActiveSubscription,
			},
		});
	} catch (error) {
		console.error("getDashboardOverview error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to fetch dashboard overview" });
	}
};
```

**Frontend Update:** `frontend/src/app/dashboard/DashboardClient.tsx`

Replace all data fetching with single consolidated call:

```typescript
useEffect(() => {
	const loadDashboard = async () => {
		try {
			const res = await fetch(`/api/dashboard/overview?inboxPage=1&inboxLimit=10`, {
				credentials: "include",
			});

			if (res.ok) {
				const json = await res.json();
				if (json?.success) {
					const { stats, inbox, subscription, hasActiveSubscription } = json.data;

					setStats({
						totalDocuments: stats.owner.total,
						pendingSignatures: stats.assigned.pending,
						completedSignatures: stats.assigned.completed,
						subscriptionStatus: hasActiveSubscription ? subscription?.planId?.name : "Free Plan",
						owner: stats.owner,
						assigned: stats.assigned,
					});

					setInbox(inbox.items);
					setInboxPage(inbox.pagination.current);
					setInboxTotal(inbox.pagination.total);
					setInboxPages(inbox.pagination.pages);

					if (subscription) {
						setSubscription(subscription);
					}
				}
			}
		} catch (error) {
			console.error("Failed to load dashboard:", error);
		} finally {
			setLoading(false);
		}
	};

	loadDashboard();
}, []);
```

**Benefits:**

- Single HTTP request instead of 3-4
- Server optimizes query execution
- Better cache control with single endpoint
- Expected: **100-200ms faster**

---

## Testing & Validation

### Before/After Comparison

Test using Chrome DevTools Network tab:

**Metrics to Compare:**

1. **Total Page Load Time** (DOMContentLoaded + Full Load)
2. **Network Payload Size** (total bytes transferred)
3. **Number of Requests** (count in Network tab)
4. **API Response Times** (individual endpoint timings)
5. **Time to Interactive (TTI)**

### Testing Commands

```bash
# Test API endpoints locally
curl -X GET http://localhost:5000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X GET http://localhost:5000/api/dashboard/inbox \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X GET http://localhost:5000/api/dashboard/overview \
  -H "Authorization: Bearer YOUR_TOKEN"

# Measure response times
time curl http://localhost:5000/api/dashboard/stats
```

### Database Query Analysis

```javascript
// Add timing to MongoDB queries (in development)
mongoose.set("debug", true);

// Or use Node.js native timing
console.time("stats-query");
const stats = await getUserStats(req, res);
console.timeEnd("stats-query");
```

---

## Rollback Plan

If any optimization causes issues:

```javascript
// Keep old endpoints functional during transition
// In routes/dashboard.js
router.get("/stats", authenticateToken, getUserStats); // V1 (old)
router.get("/stats-v2", authenticateToken, getUserStatsOptimized); // V2 (new)

// In frontend, conditionally use old endpoint if new fails
const statsUrl = useOptimizedApis ? "/api/dashboard/stats-v2" : "/api/dashboard/stats";
```

---

## Deployment Checklist

- [ ] All changes tested locally
- [ ] Database indexes created/verified
- [ ] API contracts updated in documentation
- [ ] Frontend handles new response formats
- [ ] Error handling added for all new code paths
- [ ] Backwards compatibility maintained
- [ ] Performance metrics baseline established
- [ ] Monitoring alerts configured
- [ ] Deployment to staging environment
- [ ] Staging testing completed
- [ ] Production deployment
- [ ] Monitor metrics post-deployment
