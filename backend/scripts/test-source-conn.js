import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const SOURCE_URI = "mongodb+srv://trayansh:trayansh@cluster0.axzjobx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function testConnection() {
    const client = new MongoClient(SOURCE_URI);
    try {
        console.log('Connecting to source...');
        await client.connect();
        console.log('Connected!');
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log('Databases:', dbs);
    } catch (err) {
        console.error('Connection failed:', err);
    } finally {
        await client.close();
    }
}

testConnection();
