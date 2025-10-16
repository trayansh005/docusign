import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../database/connection.js";
import User from "../models/User.js";
import DocuSignTemplate from "../models/DocuSignTemplate.js";

dotenv.config();

async function seed() {
	try {
		await connectDB();

		console.log("Clearing test users/templates...");
		await User.deleteMany({ email: /@example.com$/ });
		await DocuSignTemplate.deleteMany({ "metadata.filename": /seed-test-/ });

		console.log("Creating users...");
		const users = await User.create([
			{ firstName: "Alice", lastName: "Example", email: "alice@example.com", password: "password" },
			{ firstName: "Bob", lastName: "Example", email: "bob@example.com", password: "password" },
			{ firstName: "Carol", lastName: "Example", email: "carol@example.com", password: "password" },
		]);

		console.log("Creating templates...");
		const [alice, bob, carol] = users;

		await DocuSignTemplate.create([
			{
				name: "Seed Test - Alice owns - pending",
				metadata: {
					filename: "seed-test-1.pdf",
					originalPdfPath: "/uploads/signatures/templates/seed-test-1.pdf",
				},
				createdBy: alice._id,
				signatureFields: [
					{
						id: "f1",
						recipientId: String(bob._id),
						type: "signature",
						pageNumber: 1,
						wPct: 20,
						hPct: 5,
					},
				],
				recipients: [
					{ id: String(bob._id), name: `${bob.firstName} ${bob.lastName}`, email: bob.email },
				],
				status: "active",
			},
			{
				name: "Seed Test - Bob owns - final",
				metadata: {
					filename: "seed-test-2.pdf",
					originalPdfPath: "/uploads/signatures/templates/seed-test-2.pdf",
				},
				createdBy: bob._id,
				signatureFields: [
					{
						id: "f2",
						recipientId: String(alice._id),
						type: "signature",
						pageNumber: 1,
						wPct: 20,
						hPct: 5,
					},
				],
				recipients: [
					{
						id: String(alice._id),
						name: `${alice.firstName} ${alice.lastName}`,
						email: alice.email,
					},
				],
				status: "final",
				finalPdfUrl: "/uploads/signatures/signed/seed-test-2/final.pdf",
			},
			{
				name: "Seed Test - Carol assigned by email",
				metadata: {
					filename: "seed-test-3.pdf",
					originalPdfPath: "/uploads/signatures/templates/seed-test-3.pdf",
				},
				createdBy: alice._id,
				signatureFields: [
					{
						id: "f3",
						recipientId: "external",
						type: "signature",
						pageNumber: 1,
						wPct: 20,
						hPct: 5,
					},
				],
				recipients: [{ id: "external", name: "Carol Example", email: carol.email }],
				status: "active",
			},
		]);

		console.log("Seed complete.");
		process.exit(0);
	} catch (error) {
		console.error("Seed failed", error);
		process.exit(1);
	}
}

seed();
