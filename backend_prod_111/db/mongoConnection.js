const { MongoClient } = require('mongodb');



const MONGO_URL = 'mongodb://CustomerSupport:nrkindex123@88.150.227.111:27017';
const DATABASE_NAME = 'nrkindex_prod';

let client;
let db;

async function connectToMongo(retryCount = 0) {
    try {
        client = await MongoClient.connect(MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // Wait max 5s before timeout
        });

        db = client.db(DATABASE_NAME);
        console.log('✅ Connected to MongoDB (with error handling)');
    } catch (err) {
        console.error(`❌ MongoDB connection failed (${err.message})`);

        if (retryCount < 5) {
            console.log(`🔁 Retrying MongoDB connection in 3s... (Attempt ${retryCount + 1})`);
            setTimeout(() => connectToMongo(retryCount + 1), 3000);
        } else {
            console.error('💥 Exceeded maximum MongoDB retries. Exiting...');
            // process.exit(1);
             setTimeout(() => connectToMongo(retryCount + 1), 3000);
        }
    }
}

// 🔌 Reconnect on unexpected close
process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err);
    if (err.message.includes('topology was destroyed')) {
        console.log('🔁 Reinitializing MongoDB connection...');
        connectToMongo();
    } else {
        process.exit(1);
    }
});

connectToMongo();

module.exports = {
    getDb: () => db
};













// const { MongoClient } = require('mongodb');



// const MONGO_URL = 'mongodb://CustomerSupport:nrkindex123@88.150.227.111:27017';
// const DATABASE_NAME = 'nrkindex_prod';

// let client;
// let db;

// const connectMongoDB = async () => {
//     try {
//         client = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
//         db = client.db(DATABASE_NAME);
//         console.log('Connected to MongoDB');
//     } catch (err) {
//         console.error('Error connecting to MongoDB:', err);
//     }
// };

// const getDb = () => {
//     if (!db) {
//         throw new Error('Database not connected!');
//     }
//     return db;
// };

// module.exports = {
//     connectMongoDB,
//     getDb
// };