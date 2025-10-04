import mongoose from "mongoose";
import "dotenv/config";

const connectDB = async () => {
	try {
		// Determine database name based on environment
		const getDatabaseName = () => {
			const env = process.env.NODE_ENV || "development";
			switch (env) {
				case "production":
					return process.env.DB_NAME_PROD || "docusign_app_prod";
				case "test":
					return process.env.DB_NAME_TEST || "docusign_app_test";
				default:
					return process.env.DB_NAME || "docusign_app_dev";
			}
		};

		const options = {
			dbName: getDatabaseName(),
		};

		await mongoose.connect(process.env.MONGO_URI, options);
		console.log(
			`MongoDB Connected to database: ${mongoose.connection.db.databaseName} (${
				process.env.NODE_ENV || "development"
			})`
		);
	} catch (err) {
		console.log("MongoDB Connection Failed");
		console.error(err.message);
		process.exit(1);
	}
};

export default connectDB;
