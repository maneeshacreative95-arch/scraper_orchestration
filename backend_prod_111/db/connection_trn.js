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
//     host: '88.150.227.117',
//     user: 'nrktrn_web_admin',
//     password: 'GOeg&*$*657',
//     database: 'nrkindex_trn',
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
//     console.error(`❌ MySQL connection error in connection_trn :`, err.code, err.message);
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
//   return new Promise((resolve, reject) => {
//     connection.getConnection((err, conn) => {
//       if (err) return reject(err);

//       // promisify only on the actual connection object
//       conn.query = util.promisify(conn.query);
//       conn.beginTransaction = util.promisify(conn.beginTransaction);
//       conn.commit = util.promisify(conn.commit);
//       conn.rollback = util.promisify(conn.rollback);

//       resolve(conn);

//       conn.on("error", (err) => {
//         console.error(
//           `❌ MySQL connection error in connection_trn (threadId ${conn.threadId}):`,
//           err.code,
//           err.message
//         );
//       });
//     });
//   });
// };


// module.exports = connection;




