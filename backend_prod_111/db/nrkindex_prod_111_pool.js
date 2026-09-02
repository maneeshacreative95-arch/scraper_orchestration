const mysql = require('mysql2/promise');

const connection = mysql.createPool({
    host: '88.150.227.111',
    user: 'nrkindex_111',
    password: 'hbUs%$#984',    
    database: 'nrkindex_prod',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    charset: 'utf8mb4',
    
});

// Optional debug hooks
connection.on?.('acquire', () => console.log('✅ Connection acquired'));
connection.on?.('release', () => console.log('🔄 Connection released'));
connection.on?.('error', (err) => console.error('⚠️ MySQL pool error:', err));

// Safe transactional wrapper
async function nrkindex_prod_111_pool(callback) {
    const conn = await connection.getConnection();
    let transactionStarted = false;
    let isReleased = false;

    const safeRelease = async () => {
        if (!isReleased) {
            try {
                conn.release();
                isReleased = true;
            } catch (e) {
                console.error("⚠️ Failed to release connection:", e.message);
            }
        }
    };

    try {
        await conn.beginTransaction();
        transactionStarted = true;

        const result = await callback(conn); // your app logic
        await conn.commit();
        return result;
    } catch (err) {
        if (transactionStarted) {
            try {
                await conn.rollback();
                console.warn("↩️ Rolled back due to error.");
            } catch (rollbackErr) {
                console.error("❌ Rollback failed:", rollbackErr.message);
            }
        }
        throw err;
    } finally {
        await safeRelease();
    }
}

// 🔄 Keep-alive ping (prevents idle disconnects)
setInterval(async () => {
  try {
    await connection.query('SELECT 1');
    console.log('✅ MySQL keep-alive ping success');
  } catch (err) {
    console.warn('⚠️ Keep-alive ping failed:', err.code || err.message);
  }
}, 5 * 60 * 1000); // every 5 minutes




nrkindex_prod_111_pool.connection = connection;
module.exports = nrkindex_prod_111_pool ;



// const mysql = require('mysql2/promise');

// const connection = mysql.createPool({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     port: 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     multipleStatements: true,
//     charset: 'utf8mb4',
// });

// // Optional debug hooks
// connection.on?.('acquire', () => console.log('✅ Connection acquired'));
// connection.on?.('release', () => console.log('🔄 Connection released'));
// connection.on?.('error', (err) => console.error('⚠️ MySQL pool error:', err));

// // Safe transactional wrapper
// async function runWithConnection(callback) {
//     const conn = await connection.getConnection();
//     let transactionStarted = false;
//     let isReleased = false;

//     const safeRelease = async () => {
//         if (!isReleased) {
//             try {
//                 conn.release();
//                 isReleased = true;
//             } catch (e) {
//                 console.error("⚠️ Failed to release connection:", e.message);
//             }
//         }
//     };

//     try {
//         await conn.beginTransaction();
//         transactionStarted = true;

//         const result = await callback(conn); // your app logic
//         await conn.commit();
//         return result;
//     } catch (err) {
//         if (transactionStarted) {
//             try {
//                 await conn.rollback();
//                 console.warn("↩️ Rolled back due to error.");
//             } catch (rollbackErr) {
//                 console.error("❌ Rollback failed:", rollbackErr.message);
//             }
//         }
//         throw err;
//     } finally {
//         await safeRelease();
//     }
// }

// setInterval(async () => {
//   try {
//     await connection.query('SELECT 1');
//     console.log('✅ MySQL keep-alive ping success');
//   } catch (err) {
//     console.warn('⚠️ Keep-alive ping failed:', err.code || err.message);
//   }
// }, 5 * 60 * 1000); // every 5 minutes


// runWithConnection.connection = connection;

// module.exports = runWithConnection;









// const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     port: 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     multipleStatements: true,
//     charset: 'utf8mb4',
// });

// // Optional hooks — may not fire in mysql2
// pool.on?.('acquire', (conn) => {
//     console.log('✅ Connection acquired');
// });

// pool.on?.('release', (conn) => {
//     console.log('🔄 Connection released');
// });

// pool.on?.('error', (err) => {
//     console.error('⚠️ MySQL pool error:', err);
// });

// // Main exported function that behaves like a transaction wrapper
// async function runWithConnection(callback) {
//     const connection = await pool.getConnection();
//     try {
//         await connection.beginTransaction();
//         const result = await callback(connection); // ✅ call your logic
//         await connection.commit();
//         return result;
//     } catch (err) {
//         await connection.rollback();
//         throw err;
//     } finally {
//         connection.release();
//     }
// }

// // Optional: attach pool in case you want to access it directly
// runWithConnection.pool = pool;

// module.exports = runWithConnection;



// const mysql = require('mysql2/promise');

// const connection = mysql.createPool({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     port: 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     multipleStatements: true,
//     charset: 'utf8mb4',
// });

// // Optional debug hooks for acquire/release
// connection.on('acquire', (conn) => {
//     console.log('✅ Connection acquired');
// });

// connection.on('release', (conn) => {
//     console.log('🔄 Connection released');
// });

// connection.on('error', (err) => {
//     console.error('⚠️ MySQL pool error:', err);
// });

// // Helper to get a connection for transactions
// connection.getPromisifiedConnection = async function () {
//     const conn = await connection.getConnection();
//     try {
//         await conn.beginTransaction();
//         return conn;
//     } catch (err) {
//         conn.release();
//         throw err;
//     }
// };

// module.exports = connection;








// // nrkindex_prod_111_pool.js
// const mysql = require('mysql2/promise');


// const pool = mysql.createPool({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     waitForConnections: true,
//     charset: 'utf8mb4', 
//     connectionLimit: 50,
//     queueLimit: 100
// });

// /**
//  * Safely runs a callback with a DB connection and handles transient errors.
//  * @param {(conn: mysql.PoolConnection) => Promise<any>} callback 
//  */
// async function nrkindex_prod_111_pool(callback) {
//     let connection;
//     try {
//         connection = await pool.getConnection();
//         return await callback(connection);
//     } catch (err) {
//         console.error("DB Error:", err.code || err.message);

//         const transientErrors = ['PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ER_CON_COUNT_ERROR'];
//         if (transientErrors.includes(err.code)) {
//             console.log("Retrying DB connection...");
//             try {
//                 connection = await pool.getConnection();
//                 return await callback(connection);
//             } catch (retryErr) {
//                 console.error("Retry failed:", retryErr.message);
//                 throw retryErr;
//             }
//         }

//         throw err;
//     } finally {
//         if (connection) connection.release();
//     }
// }

// module.exports = { nrkindex_prod_111_pool };










