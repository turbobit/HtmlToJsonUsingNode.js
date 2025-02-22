// addFavicon.js
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { MongoClient } = require('mongodb');
const { URL: Url } = require('url');
const sharp = require('sharp');
const { fetchFaviconAsBase64 } = require('../lib/getFavicon.js');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

(async function main() {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            console.log('Adding favicon to documents started...');
            await client.connect();
            console.log('client.connect()...');
            const db = client.db(process.env.MONGODB_DATABASE_NAME);
            const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

            const documents = await collection
                .find(
                    { $or: [{ favicon: { $exists: false } }, { favicon: '' }] },
                    { projection: { _id: 1, dataUrl: 1 } } // 필요한 필드만 선택
                )
                .toArray();
            console.info(`Found \x1b[36m${documents.length}\x1b[0m documents to update favicon.`);

            for (const doc of documents) {
                const { _id, dataUrl } = doc;
                console.log(`[NOTICE][DOCU] Processing ${dataUrl}`);
                const favicon = await fetchFaviconAsBase64(dataUrl);
                if (favicon) {
                    await collection.updateOne({ _id }, { $set: { favicon } });
                    console.log(`[\x1b[32mOK\x1b[0m][DOCU] Updated favicon for ${dataUrl}`);
                } else {
                    console.log(`[Fail][DOCU] Could not fetch favicon for ${dataUrl}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 지연
            }
        } catch (error) {
            console.error('[Warn][DOCU]Error adding favicon to documents:', error);
            retryCount++;

            if (retryCount < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 5000)); // 5초 지연 후 재시도
            }
        } finally {
            await client.close();
        }
    }
    console.log('Adding favicon to documents completed.');
})();