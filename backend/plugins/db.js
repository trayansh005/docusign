import mongoose from "mongoose";
import fp from "fastify-plugin";

async function dbConnector(fastify, options) {
  try {
    const getDatabaseName = () => {
      const env = process.env.NODE_ENV || "development";
      switch (env) {
        case "production":
          return process.env.DB_NAME || "docusign_app_prod";
        case "test":
          return process.env.DB_NAME || "docusign_app_test";
        default:
          return process.env.DB_NAME || "docusign_app_dev";
      }
    };

    const mongoOptions = {
      dbName: getDatabaseName(),
    };

    await mongoose.connect(process.env.MONGO_URI, mongoOptions);
    fastify.log.info(
      `MongoDB Connected to database: ${mongoose.connection.db.databaseName} (${
        process.env.NODE_ENV || "development"
      })`
    );

    fastify.decorate("mongoose", mongoose);

    fastify.addHook("onClose", async (instance) => {
      await mongoose.connection.close();
    });
  } catch (err) {
    fastify.log.error("MongoDB Connection Failed");
    fastify.log.error(err.message);
    process.exit(1);
  }
}

export default fp(dbConnector);
