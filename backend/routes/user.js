import { listUsers } from "../controllers/userController.js";

export default async function userRoutes(fastify, options) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.get("/", listUsers);
}

