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

  // Protected routes
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook("preHandler", fastify.authenticate);

    protectedRoutes.get("/profile", getProfile);
    protectedRoutes.put("/profile", { schema: updateProfileSchema }, updateProfile);
    protectedRoutes.put("/change-password", { schema: changePasswordSchema }, changePassword);
    protectedRoutes.post("/logout", logout);

    // Session management
    protectedRoutes.get("/sessions", getSessions);
    protectedRoutes.delete("/sessions/:sessionId", deleteSession);
    protectedRoutes.post("/logout-all", logoutAll);
  });
}

