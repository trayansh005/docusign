# Dashboard Performance Analysis & Optimization Guide

## Executive Summary

The dashboard page currently makes **4-5 API calls** sequentially and fetches large amounts of data unnecessarily, causing slow initial load times. This document outlines the performance bottlenecks and provides actionable optimization strategies.

---

## 📊 Current API Calls & Flow

### 1. **Server-side Prefetch (Page.tsx)**

```
GET /api/activity/recent - Prefetched on server
```

- **Triggered:** During server-side page render
- **Purpose:** Fetch 10 most recent activities
- **Data Size:** ~2-5KB per activity (with embedded objects)

### 2. **Client-side Data Fetching (DashboardClient.tsx)**

#### API Call 1: `/api/subscription/me`

```javascript
Location: Line 92-99 in DashboardClient.tsx
Method: GET
Credentials: include
```

- **Purpose:** Fetch active subscription details
- **Response Size:** ~1-2KB
- **Data Returned:**
  - Subscription ID
  - Plan details (name, price, description, features array, interval)
  - Status, dates, cancelAtPeriodEnd flag

#### API Call 2: `/api/dashboard/stats`

```javascript
Location: Line 104-119 in DashboardClient.tsx
Method: GET
Credentials: include
```

- **Purpose:** Fetch user statistics and usage limits
- **Response Size:** ~500 bytes - 2KB
- **Data Returned:**
  - Owner stats (total, pending, completed)
  - Assigned stats (total, pending, completed)
  - Free tier usage limits (if applicable)
  - Subscription status

#### API Call 3: `/api/dashboard/inbox`

```javascript
Location: Line 145-167 in DashboardClient.tsx
Method: GET
Credentials: include
```

- **Purpose:** Fetch documents assigned to user for signing
- **Response Size:** Can be LARGE (5-50KB+)
- **Data Issues:**
  - Fetches FULL document objects including recipients array
  - Includes message objects
  - Populates createdBy user details
  - Uses `.lean()` but still includes all selected fields

#### API Call 4: React Query - `["activities"]`

```javascript
Location: Line 82-85 in DashboardClient.tsx
queryKey: ["activities"]
queryFn: getRecentActivities (server action)
```

- **Purpose:** Fetch recent activities (duplicate of server prefetch)
- **Response Size:** ~2-5KB
- **Status:** Already server-side prefetched, hydrated with HydrationBoundary

---

## 🔴 Performance Issues Identified

### Issue 1: Sequential API Calls

**Problem:**

- API calls happen in `useEffect` hooks (lines 92-99, 104-119, 145-167)
- Activities are also fetched via React Query (line 82-85)
- These execute sequentially instead of in parallel

**Impact:**

- Total load time = sum of all API call durations
- Example: If each call takes 200ms, total = 800ms+ just for API calls

### Issue 2: Large Inbox Response

**Problem:**

```javascript
// Current query (line 131)
.select("name status createdAt updatedAt finalPdfUrl metadata recipients message")
.populate("createdBy", "firstName lastName email")
```

- **Fetches entire `recipients` array** for each document
- Recipients object includes: id, name, email, userId, signatureStatus, signedAt, notifiedAt
- For a user with 20+ pending documents, this can be **hundreds of KB** of data
- Many fields in recipients are not displayed in UI

**Data Bloat Example:**

```
1 Document with 5 recipients:
- Document size: ~500 bytes
- Recipients: 5 × ~150 bytes = 750 bytes
- Total per document: ~1.25KB

User with 50 inbox items × 1.25KB = 62.5KB+
```

### Issue 3: Duplicate Activity Fetch

**Problem:**

- Activities are prefetched server-side (page.tsx)
- Then fetched AGAIN via React Query client-side (DashboardClient.tsx)
- This causes double network requests

### Issue 4: No Pagination on Inbox

**Problem:**

- All inbox items fetched at once
- No pagination, no filtering
- Users with 100+ documents get all in one request

### Issue 5: Inefficient Field Selection

**Problem:**

- Dashboard stats queries count documents **3 separate times**:
  ```javascript
  // Line 17: Owner filter
  const totalDocuments = await DocuSignTemplate.countDocuments(ownerFilter);
  // Line 18-20: Owner pending
  await DocuSignTemplate.countDocuments({ ...ownerFilter, status: { $ne: "final" } });
  // Line 21-23: Owner completed
  await DocuSignTemplate.countDocuments({ ...ownerFilter, status: "final" });
  ```
- Each count query hits the database separately
- Total: 8-9 separate database queries just for stats

### Issue 6: Unnecessary Data in Response

**Problem - Inbox Response:**

```javascript
// All these are fetched but some may not be needed
name, status, createdAt, updatedAt, finalPdfUrl, metadata, recipients, message;
```

- Large `metadata` objects fetched for each document
- `finalPdfUrl` might not be immediately needed

**Problem - Stats Response:**

- Both flat fields AND grouped fields sent redundantly:

```javascript
{
  totalDocuments: 10,        // Flat
  pendingSignatures: 5,      // Flat
  completedSignatures: 5,    // Flat
  owner: {                   // Grouped (same data)
    total: 10,
    pending: 5,
    completed: 5
  },
  assigned: { ... }          // Grouped
}
```

### Issue 7: Expensive Database Queries

**Problem - Dashboard Stats (lines 16-45):**

```javascript
// 8-9 separate database queries:
1. countDocuments(ownerFilter)                    // total
2. countDocuments(ownerFilter with status)       // pending
3. countDocuments(ownerFilter with status)       // completed
4. countDocuments(assignedFilter)                // assigned total
5. countDocuments(assignedFilter with status)    // assigned pending
6. countDocuments(assignedFilter with status)    // assigned completed
7. Subscription.findOne()                         // check active subscription
8. countDocuments() for free tier usage          // uploads used
9. countDocuments() for free tier usage          // signs used
```

**Optimization:**

- Use MongoDB aggregation pipeline instead
- Get all counts in **1-2 queries** instead of 9

---

## ⏱️ Estimated Load Time Breakdown (Current)

```
Server-side rendering:
- Prefetch activities:       ~100-150ms
- SSR page rendering:        ~50-100ms

Client-side:
- /api/subscription/me:      ~150-200ms
- /api/dashboard/stats:      ~200-300ms (9 DB queries)
- /api/dashboard/inbox:      ~300-500ms (large payload)
- React Query prefetch:       ~100-150ms (duplicate)

Total Page Interactive Time: 900ms - 1.4 seconds
Largest payload: Inbox response (50-100KB)
```

---

## 🎯 Optimization Recommendations

### Priority 1: Reduce Database Queries in Stats Endpoint

**Impact:** -50% on stats API latency
**Effort:** Low (1-2 hours)

**Solution:**
Replace 8-9 separate `countDocuments()` queries with MongoDB Aggregation Pipeline:

```javascript
// Instead of 9 queries, use 2 aggregation pipelines:

// Pipeline 1: Owner stats
[
	{ $match: ownerFilter },
	{
		$group: {
			_id: null,
			total: { $sum: 1 },
			pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
			completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
		},
	},
][
	// Pipeline 2: Assigned stats
	({ $match: assignedFilter },
	{
		$group: {
			/* same logic */
		},
	})
];
```

**Benefit:**

- Single query gets total + pending + completed
- Reduces DB queries from 9 to 2
- Expected improvement: **150-200ms faster**

---

### Priority 2: Parallelize API Calls

**Impact:** -30-40% on total load time
**Effort:** Low (30 minutes)

**Solution:**
Replace sequential `useEffect` hooks with `Promise.all()`:

```typescript
// BEFORE: Sequential
useEffect(() => {
	loadUserStats();
}, [loadUserStats]);
useEffect(() => {
	loadInbox();
}, []);

// AFTER: Parallel
useEffect(() => {
	Promise.all([
		loadUserStats(),
		loadInbox(),
		// Reuse prefetched activities from React Query
	]).finally(() => setLoading(false));
}, []);
```

**Benefit:**

- If stats=200ms, inbox=400ms, activities=100ms
- Sequential: 700ms total
- Parallel: 400ms total (max of all)
- **Improvement: 300ms faster (43%)**

---

### Priority 3: Paginate Inbox

**Impact:** -60% on inbox response size
**Effort:** Medium (2-3 hours)

**Solutions:**

**Option A: Server-side Pagination (Recommended)**

```javascript
// Modify getInbox to accept pagination params
export const getInbox = async (req, res) => {
	const { page = 1, limit = 10 } = req.query;

	const skip = (page - 1) * limit;
	const templates = await DocuSignTemplate.find(assignedFilter)
		.sort({ updatedAt: -1 })
		.skip(skip)
		.limit(limit)
		.select("name status createdAt updatedAt sender")
		.lean();

	const total = await DocuSignTemplate.countDocuments(assignedFilter);

	return res.json({
		success: true,
		data: templates,
		pagination: { current: page, total, pages: Math.ceil(total / limit), limit },
	});
};
```

**Option B: Virtual Scrolling (Frontend)**

- Keep large list but render only visible items
- Use `react-virtual` or `react-window`

**Benefit:**

- First page load: 10 items instead of 50+ → 60% smaller
- Inbox response: 10-15KB instead of 50-100KB
- **Improvement: 200-300ms faster**

---

### Priority 4: Optimize Field Selection

**Impact:** -20-30% on response sizes
**Effort:** Low (1 hour)

**Solution A: Remove Redundant Fields from Stats**

```javascript
// Current response has duplicate data
return {
  owner: { total, pending, completed },
  assigned: { total, pending, completed },
  totalDocuments, pendingSignatures, completedSignatures // redundant
}

// Keep only grouped format
return {
  owner: { total, pending, completed },
  assigned: { total, pending, completed },
  usage: { ... }
}
```

**Solution B: Reduce Inbox Field Selection**

```javascript
// BEFORE: Fetches everything
.select("name status createdAt updatedAt finalPdfUrl metadata recipients message")

// AFTER: Lean selection (first load)
.select("name status updatedAt sender")
.lean()

// Fetch additional details on demand:
// - finalPdfUrl when user clicks "View PDF"
// - Full recipients when needed
```

**Benefit:**

- Stats response: 2KB → 1KB (50% reduction)
- Inbox per-item: 1.25KB → 0.3KB (75% reduction)
- Total inbox: 62.5KB → 15KB for 50 items

---

### Priority 5: Consolidate APIs

**Impact:** -33% on number of API calls
**Effort:** Medium (2-3 hours)

**Solution:**
Create a single `/api/dashboard/overview` endpoint that returns all initial data:

```javascript
export const getDashboardOverview = async (req, res) => {
	const userId = req.user?.id;

	// Fetch all data in parallel
	const [stats, subscription, inbox, activities] = await Promise.all([
		getStatsData(userId),
		getSubscriptionData(userId),
		getInboxData(userId, 1, 10), // First 10 items
		getActivitiesData(userId),
	]);

	return res.json({ success: true, data: { stats, subscription, inbox, activities } });
};
```

**Benefit:**

- Single HTTP roundtrip instead of 3-4
- Server can optimize query execution
- Better cache control
- **Improvement: 100-200ms faster**

---

### Priority 6: Remove Duplicate Activity Fetch

**Impact:** -20% on total requests
**Effort:** Low (30 minutes)

**Solution:**
Remove client-side `useEffect` for activities since they're already server-prefetched:

```typescript
// BEFORE:
const { data: activitiesData } = useQuery({
	queryKey: ["activities"],
	queryFn: getRecentActivities, // Makes another request
});

// AFTER:
// Activities already in React Query from page.tsx prefetch
// Just access from query cache
const { data: activitiesData } = useQuery({
	queryKey: ["activities"],
	// Remove queryFn - will use hydrated cache
	enabled: false, // Don't refetch on mount
});
```

**Benefit:**

- Eliminates one API call on page load
- **Improvement: 100-150ms faster**

---

### Priority 7: Add Database Indexes

**Impact:** -30% on database query time (for stats queries)
**Effort:** Low (30 minutes)

**Solution:**
Add compound indexes to DocuSignTemplate model:

```javascript
// In DocuSignTemplate.js schema
templateSchema.index({ createdBy: 1, isArchived: 1 });
templateSchema.index({ createdBy: 1, status: 1, isArchived: 1 });
templateSchema.index({
	"signatureFields.recipientId": 1,
	isArchived: 1,
	status: 1,
});
templateSchema.index({
	"recipients.email": 1,
	isArchived: 1,
	status: 1,
});
templateSchema.index({ updatedAt: -1 }); // For sorting
```

**Benefit:**

- Stats queries: 150-200ms → 50-100ms
- Inbox query: 300ms → 150ms
- **Improvement: 200-300ms faster total**

---

## 🚀 Implementation Roadmap

### Phase 1: Quick Wins (Day 1) - 30-40% improvement

1. ✅ Parallelize API calls (Priority 2)
2. ✅ Add database indexes (Priority 7)
3. ✅ Remove duplicate activity fetch (Priority 6)
4. ✅ Reduce field selection (Priority 4)

**Expected improvement:** 300-500ms faster

### Phase 2: Core Optimizations (Day 2-3) - Additional 30-40% improvement

1. ✅ Use aggregation pipeline for stats (Priority 1)
2. ✅ Paginate inbox (Priority 3)

**Expected improvement:** 400-600ms faster

### Phase 3: Advanced Optimizations (Day 4+) - Additional 20-30% improvement

1. ✅ Consolidate dashboard APIs (Priority 5)
2. ✅ Implement caching strategy (Redis)
3. ✅ Add CDN for static assets
4. ✅ Implement request debouncing

**Expected improvement:** 200-400ms faster

---

## 📈 Expected Results After All Optimizations

### Current Metrics

- Page Load Time: **1.2-1.5 seconds**
- Main Payload Size: **100-150KB**
- Number of API Calls: **4-5**
- Number of DB Queries: **15-18**

### After Phase 1 (Quick Wins)

- Page Load Time: **0.8-1.0 seconds** ✅ 30% improvement
- Main Payload Size: **70-100KB** ✅ 30% reduction
- Number of API Calls: **3-4** ✅ 20-25% reduction
- Number of DB Queries: **12-15**

### After Phase 2 (Core Optimizations)

- Page Load Time: **0.4-0.6 seconds** ✅ 60-70% improvement
- Main Payload Size: **30-50KB** ✅ 60-65% reduction
- Number of API Calls: **2-3** ✅ 40-50% reduction
- Number of DB Queries: **4-6** ✅ 70% reduction

### After Phase 3 (Advanced)

- Page Load Time: **0.2-0.3 seconds** ✅ 80% improvement
- Main Payload Size: **10-20KB** ✅ 85% reduction
- Number of API Calls: **1** ✅ 75% reduction
- Number of DB Queries: **1-2** ✅ 90% reduction

---

## 🔧 Code Changes Summary

### File: `/backend/controllers/dashboardController.js`

**Changes Required:**

1. Replace multiple `countDocuments()` with aggregation pipeline
2. Refactor to use `Promise.all()` for parallel queries
3. Add pagination support to `getInbox()`
4. Reduce field selection in inbox query
5. Create new `getDashboardOverview()` endpoint

### File: `/backend/models/DocuSignTemplate.js`

**Changes Required:**

1. Add compound indexes for common query patterns

### File: `/frontend/src/app/dashboard/DashboardClient.tsx`

**Changes Required:**

1. Replace sequential `useEffect` hooks with `Promise.all()`
2. Remove duplicate activity fetch
3. Add pagination controls to inbox
4. Add loading skeletons instead of spinner

### File: `/frontend/src/app/dashboard/page.tsx`

**Changes Required:**

1. Update server prefetch to use new consolidated API
2. Adjust hydration boundary

---

## 🔍 Monitoring & Measurement

### Add Performance Monitoring

**Frontend (Next.js):**

```typescript
// Add to layout.tsx
import { useReportWebVitals } from "next/web-vitals";

export function reportWebVitals(metric) {
	console.log(`${metric.name}: ${metric.value}ms`);
	// Send to analytics: LCP, FID, CLS
}
```

**Backend:**

```javascript
// Add timing middleware
app.use((req, res, next) => {
	const start = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(`${req.method} ${req.path}: ${duration}ms`);
	});
	next();
});
```

### Metrics to Track

- **LCP (Largest Contentful Paint):** Target < 2.5s
- **FID (First Input Delay):** Target < 100ms
- **CLS (Cumulative Layout Shift):** Target < 0.1
- **TTFB (Time to First Byte):** Target < 600ms
- **API Response Times:** Track per endpoint
- **Payload Sizes:** Monitor in production

---

## 📝 Notes & Gotchas

1. **Breaking Changes:** Some optimizations may require frontend updates to handle new response formats
2. **Database Indexes:** Need to be created in production with consideration for write performance
3. **Pagination:** Update UI to include pagination controls
4. **Testing:** Ensure all tests pass after refactoring, especially auth checks
5. **Backwards Compatibility:** Keep old endpoints during transition period

---

## ✅ Checklist for Implementation

- [ ] Review and approve optimization plan
- [ ] Create feature branch
- [ ] Implement Phase 1 changes
- [ ] Test locally with dashboard
- [ ] Deploy to staging
- [ ] Performance test (before/after comparison)
- [ ] Deploy to production
- [ ] Monitor metrics for 24-48 hours
- [ ] Implement Phase 2 changes
- [ ] Repeat process
