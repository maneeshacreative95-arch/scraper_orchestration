// nrkindex_prod_111_pool.js
const mysql = require('mysql2/promise');
// require('dotenv').config({ path: __dirname + '/../.env' });

// ✅ Create the connection pool
// const pool = mysql.createPool({
//     host: process.env.DB_HOST_TRN_117,
//     port: process.env.DB_PORT_TRN_117,
//     user: process.env.DB_USER_TRN_117,
//     password: process.env.DB_PASSWORD_TRN_117,
//     database: process.env.DB_NAME_TRN_117,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });

const pool = mysql.createPool({
    host: '88.150.227.117',
    user: 'nrkindexdev1_admin',
    password: 'nrkv1@0413',
    database: 'nrkindex_trn',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const transientErrors = [
  'PROTOCOL_CONNECTION_LOST',
  'ECONNREFUSED',
  'ER_CON_COUNT_ERROR',
  'ECONNRESET'  // ✅ add this
];


// ✅ Inject retry logic into pool.execute (1 retry attempt on transient errors)
const originalExecute = pool.execute.bind(pool);


pool.execute = async function (...args) {
    try {
        return await originalExecute(...args);
    } catch (err) {
        if (transientErrors.includes(err.code)) {
            console.warn('⚠️ Transient DB error. Retrying execute...');
            try {
                return await originalExecute(...args);
            } catch (retryErr) {
                console.error('❌ Retry failed:', retryErr.message);
                throw retryErr;
            }
        }
        throw err;
    }
};

setInterval(async () => {
  try {
    await pool.query("SELECT 1");
    // console.log("Keep-alive query success");
  } catch (err) {
    console.error("Keep-alive query failed:", err);
  }
}, 60 * 1000);




async function connection_trn_117_pool_retry(callback) {
    let connection;
    try {
        connection = await pool.getConnection();
        return await callback(connection);
    } catch (err) {
        console.error("DB Error:", err.code || err.message);
        if (transientErrors.includes(err.code)) {
            console.log("Retrying DB connection...");
            try {
                connection = await pool.getConnection();
                return await callback(connection);
            } catch (retryErr) {
                console.error("Retry failed:", retryErr.message);
                throw retryErr;
            }
        }
        throw err;
    } finally {
        if (connection) connection.release();
    }
}


// ✅ Optional: pool-like retry wrapper with .execute() and .query()
function createRetryWrapper() {
    return {
        execute: async (...args) => {
            return await connection_trn_117_pool_retry(async (conn) => {
                return await conn.execute(...args);
            });
        },
        query: async (...args) => {
            return await connection_trn_117_pool_retry(async (conn) => {
                return await conn.query(...args);
            });
        }
    };
}

const connection_trn_117_pool_retry_wrapper = createRetryWrapper();

// ✅ Exports
module.exports = {
    connection_trn_117_pool: pool,                      // Main pool with auto-retry on .execute()
    connection_trn_117_pool_retry,                      // Manual connection wrapper
    connection_trn_117_pool_retry_wrapper               // Pool-like retry version (optional)
};
