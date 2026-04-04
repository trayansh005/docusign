// Uses the shared JWT auth plugin (request.user is populated by fastify.authenticate).
import {
	getPlans,
	getUserSubscription,
	createSubscription,
	cancelSubscription,
	deleteSubscription,
} from "../controllers/subscriptionController.js";
import {
	createCheckoutSession,
	verifySession,
	stripeWebhook,
} from "../controllers/stripeController.js";

/**
 * Subscription routes Fastify plugin
 */
export default async function subscriptionRoutes(fastify, options) {
	// Plans - public
	fastify.get("/plans", getPlans);

	// Authenticated routes
	fastify.register(async (instance) => {
		instance.addHook("preHandler", fastify.authenticate);

		instance.get("/me", getUserSubscription);
		instance.post("/", createSubscription);
		instance.post("/cancel", cancelSubscription);
		instance.delete("/:id", deleteSubscription);
		instance.post("/checkout", createCheckoutSession);
		instance.post("/verify", verifySession);
	});

	// Webhook - needs raw body, no auth
	// Note: rawBody should be enabled via @fastify/raw-body plugin in server.js
	fastify.post(
		"/webhook",
		{
			config: {
				rawBody: true,
			},
		},
		stripeWebhook,
	);
}
