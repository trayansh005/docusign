import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  getSessions,
  deleteSession,
  logoutAll,
} from "../controllers/authController.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../schemas/auth.js";

export default async function authRoutes(fastify, options) {
  // Public routes
  fastify.post("/register", { schema: registerSchema }, register);
  fastify.post("/login", { schema: loginSchema }, login);

  // Logout is intentionally public — we should be able to clear the cookie
  // even if the session has already expired or is invalid.
  fastify.post("/logout", logout);

  // Protected routes
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook("preHandler", fastify.authenticate);

    protectedRoutes.get("/profile", getProfile);
    protectedRoutes.put("/profile", { schema: updateProfileSchema }, updateProfile);
    protectedRoutes.put("/change-password", { schema: changePasswordSchema }, changePassword);

    // Session management
    protectedRoutes.get("/sessions", getSessions);
    protectedRoutes.delete("/sessions/:sessionId", deleteSession);

    // logoutAll requires auth so request.user._id is available
    protectedRoutes.post("/logout-all", logoutAll);
  });
}

