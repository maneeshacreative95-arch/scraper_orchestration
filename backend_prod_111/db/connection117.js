const mysql = require('mysql');
const util = require('util');

const pool = mysql.createPool({
  connectionLimit: 10,
  host: '88.150.227.117',
  user: 'nrktrn_web_admin',
  password: 'GOeg&*$*657',
  database: 'nrkindex_trn',
  port: 3306,
  multipleStatements: true,
  charset: 'utf8mb4',
});

// ✅ Debugging hooks
pool.on('acquire', function (conn) {
  console.log('✅ Connection %d acquired', conn.threadId);
});

pool.on('release', function (conn) {
  console.log('🔄 Connection %d released', conn.threadId);
});

// ✅ Pool-level error handler (destroys bad connections)
pool.on('error', (err, conn) => {
  console.error('❌ MySQL pool error:', err.code, err.message);

  if (conn) {
    try {
      conn.release();
    } catch (_) {}
    conn.destroy();
    console.log(`⚠️ Connection ${conn.threadId} destroyed after error`);
  }
});

// ✅ Safe promisified query wrapper (don’t override pool.query)
pool.asyncQuery = util.promisify(pool.query).bind(pool);

// ✅ Promisified connection getter for transactions
pool.getPromisifiedConnection = async function () {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, conn) => {
      if (err) return reject(err);

      // Promisify only this connection
      conn.query = util.promisify(conn.query);
      conn.beginTransaction = util.promisify(conn.beginTransaction);
      conn.commit = util.promisify(conn.commit);
      conn.rollback = util.promisify(conn.rollback);

      // Error handler for this individual connection
      conn.on('error', (err) => {
        console.error(
          `❌ MySQL connection error (threadId ${conn.threadId}):`,
          err.code,
          err.message
        );
      });

      resolve(conn);
    });
  });
};

// ✅ Keep-alive ping (every 5 minutes)
setInterval(async () => {
  try {
    await pool.asyncQuery('SELECT 1');
    // console.log('✅ Keep-alive ping success');
  } catch (err) {
    console.warn('⚠️ Keep-alive ping failed:', err.code || err.message);
  }
}, 5 * 60 * 1000);

module.exports = pool;



// const mysql = require('mysql');
// const util = require('util');

// const connection = mysql.createPool({
//     connectionLimit: 10,
//      host: '88.150.227.117',
//         user: 'nrkindexdev1_scrpper_v2',
//         password: 'dev1scrap123&**(',
//         database: 'nrkindex_prod',
//     port: 3306,
//     multipleStatements: true,
//     charset: 'utf8mb4',
// });

// // Optional, but helpful for debugging
// connection.on('acquire', function (conn) {
//     console.log('✅ Connection %d acquired', conn.threadId);
// });

// connection.on('release', function (conn) {
//     console.log('🔄 Connection %d released', conn.threadId);
// });

// connection.on('error', (err) => {
//     console.error(`❌ MySQL connection error in connection117 :`, err.code, err.message);
// });

// setInterval(async () => {
//   try {
//     await connection.query('SELECT 1');
//     // console.log('✅ Keep-alive ping success');
//   } catch (err) {
//     console.warn('⚠️ Keep-alive ping failed:', err.code || err.message);
//   }
// }, 5 * 60 * 1000);

// // Promisify just the query method on the pool for simple query use
// connection.query = util.promisify(connection.query);

// // Add helper for transaction use
// connection.getPromisifiedConnection = async function () {
//     return new Promise((resolve, reject) => {
//         connection.getConnection((err, conn) => {
//             if (err) return reject(err);
//             conn.query = util.promisify(conn.query);
//             conn.beginTransaction = util.promisify(conn.beginTransaction);
//             conn.commit = util.promisify(conn.commit);
//             conn.rollback = util.promisify(conn.rollback);
//             resolve(conn);

//                 conn.on('error', (err) => {
//                 console.error(`❌ MySQL connection error  in connection117 (threadId ${conn.threadId}):`, err.code, err.message);
//             });
//         });
//     });
// };

// module.exports = connection;










// const mysql = require('mysql');

// let connection_117;

// const transientErrors = [
//   'PROTOCOL_CONNECTION_LOST',
//   'ECONNREFUSED',
//   'ER_CON_COUNT_ERROR',
//   'ECONNRESET',
//   'ETIMEDOUT',
//   'EPIPE',
//   'ENOTFOUND',
//   'EHOSTUNREACH'
// ];

// function handle117Disconnect() {
//     connection_117 = mysql.createConnection({
//         host: '88.150.227.117',
//         user: 'nrkindexdev1_scrpper_v2',
//         password: 'dev1scrap123&**(',
//         database: 'nrkindex_prod',
//         port: 3306,
//         charset: 'utf8mb4',
//     });

//     connection_117.connect((err) => {
//         if (err) {
//             console.error('❌ Error connecting to 117 DB:', err);
//             setTimeout(handle117Disconnect, 2000); // Retry after 2s
//         } else {
//             console.log('✅ Connected to 117 MySQL database(with error handling)');
//         }
//     });

//     connection_117.on('error', function (err) {
//         console.error('⚠️ 117 DB Error:', err);
//         if (transientErrors.includes(err.code)) {
//             console.log(`🔁 Reconnecting 117 due to transient error (${err.code})...`);
//             handle117Disconnect();
//         } else {
//             throw err;
//         }
//     });
// }

// handle117Disconnect();

// module.exports = connection_117;






// const mysql = require('mysql');

// // const connection_117 = mysql.createConnection({
// //     host: '88.150.227.117',
// //     user: 'nrkindexdev1_scrpper',
// //     password: 'dev1scrap@123',
// //     database: 'nrkindex_prod',
// //     port: 3306,
// // });

// const connection_117 = mysql.createConnection({
//     host: '88.150.227.117',
//     user: 'nrkindexdev1_scrpper_v2',
//     password: 'dev1scrap123&**(',
//     database: 'nrkindex_prod',
//     port: 3306,
//     charset: 'utf8mb4', 
// });

// connection_117.connect((error) => {
//     if (error) {
//         console.error('Error connecting to 117 MySQL database:', error);
//         return;
//     }
//     console.log('Connected to 117 MySQL database');
// });

// module.exports = connection_117;