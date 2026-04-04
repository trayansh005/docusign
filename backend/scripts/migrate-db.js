import { MongoClient } from 'mongodb';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Set DNS to Google's public DNS as local DNS might be failing SRV queries
dns.setServers(['8.8.8.8', '8.8.4.4']);

const SOURCE_URI = "mongodb+srv://trayansh:trayansh123@cluster0.axzjobx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DEST_URI = "mongodb://root:lsxBL9zGTh3U61kDjpHAoNbqKVf3nJTzxA5zq045Z8xnZmi6ay7V643m542BtJtO@45.63.105.190:7000/?directConnection=true";
const DB_NAME = process.env.DB_NAME || "docusign";

async function migrate() {
    console.log(`Starting migration for database: ${DB_NAME}`);
    
    const sourceClient = new MongoClient(SOURCE_URI);
    const destClient = new MongoClient(DEST_URI);

    try {
        console.log('Connecting to source database...');
        await sourceClient.connect();
        console.log('Source connected.');

        console.log('Connecting to destination database...');
        await destClient.connect();
        console.log('Destination connected.');

        const sourceDb = sourceClient.db(DB_NAME);
        const destDb = destClient.db(DB_NAME);

        const collections = await sourceDb.listCollections().toArray();
        console.log(`Found ${collections.length} collections to migrate.`);

        for (const collectionInfo of collections) {
            const collectionName = collectionInfo.name;
            console.log(`\nMigrating collection: ${collectionName}`);

            const sourceCollection = sourceDb.collection(collectionName);
            const destCollection = destDb.collection(collectionName);

            const documents = await sourceCollection.find({}).toArray();
            if (documents.length > 0) {
                console.log(`Found ${documents.length} documents. Inserting into destination...`);
                // Clear destination collection just in case
                await destCollection.deleteMany({});
                await destCollection.insertMany(documents);
                console.log(`Successfully migrated ${documents.length} documents for ${collectionName}.`);
            } else {
                console.log(`Collection ${collectionName} is empty. Skipping.`);
            }

            // Copy indexes
            const indexes = await sourceCollection.listIndexes().toArray();
            for (const index of indexes) {
                if (index.name === '_id_') continue;

                try {
                    const indexKeys = index.key;
                    const indexOptions = { ...index };
                    delete indexOptions.key;
                    delete indexOptions.v;
                    delete indexOptions.ns;

                    await destCollection.createIndex(indexKeys, indexOptions);
                    console.log(`Index ${index.name} recreated.`);
                } catch (idxError) {
                    console.warn(`Could not recreate index ${index.name}: ${idxError.message}`);
                }
            }
        }

        console.log('\nMigration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sourceClient.close();
        await destClient.close();
    }
}

migrate();
