
const mysql = require('mysql');
const util = require('util');

const connection = mysql.createPool({
    connectionLimit: 10,
    host: '88.150.227.111',
    user: 'nrkindex_111',
    password: 'hbUs%$#984',
    database: 'nrkindex_prod',
    port: 3306,
    multipleStatements: true,
    charset: 'utf8mb4',
});

// Optional, but helpful for debugging
connection.on('acquire', function (conn) {
    console.log('✅ Connection %d acquired', conn.threadId);
});

connection.on('release', function (conn) {
    console.log('🔄 Connection %d released', conn.threadId);
});

connection.on('error', (err) => {
    console.error(`❌ MySQL connection error in connection_nrkindex_prod_111 :`, err.code, err.message);
});

setInterval(async () => {
    try {
        await connection.query('SELECT 1');
        // console.log('✅ Keep-alive ping success');
    } catch (err) {
        console.warn('⚠️ Keep-alive ping failed:', err.code || err.message);
    }
}, 5 * 60 * 1000);


// Promisify just the query method on the pool for simple query use
connection.query = util.promisify(connection.query);

// Add helper for transaction use
connection.getPromisifiedConnection = async function () {
    return new Promise((resolve, reject) => {
        connection.getConnection((err, conn) => {
            if (err) return reject(err);
            conn.query = util.promisify(conn.query);
            conn.beginTransaction = util.promisify(conn.beginTransaction);
            conn.commit = util.promisify(conn.commit);
            conn.rollback = util.promisify(conn.rollback);
            resolve(conn);

            conn.on('error', (err) => {
                console.error(`❌ MySQL connection error  in connection_trn (threadId ${conn.threadId}):`, err.code, err.message);
            });

        });
    });
};

module.exports = connection;



// const mysql = require('mysql');
// const util = require('util');

// let connection;

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

// // These will hold references to the bound promisified functions
// let query;
// let beginTransaction;
// let commit;
// let rollback;

// function handleDisconnect() {
//   connection = mysql.createConnection({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     port: 3306,
//     charset: 'utf8mb4',
//   });

//   connection.connect(err => {
//     if (err) {
//       console.error('❌ Error connecting to DB:', err);
//       setTimeout(handleDisconnect, 2000); // Retry after 2s
//     } else {
//       console.log('✅ Connected to connection_nrkindex_prod_111 (with error handling)');
//     }
//   });

//   connection.on('error', err => {
//     console.error('⚠️ DB Error:', err);
//     if (transientErrors.includes(err.code)) {
//       console.log(`🔁 Reconnecting due to error (${err.code})...`);
//       handleDisconnect();
//     } else {
//       throw err;
//     }
//   });

//   // Update promisified bindings whenever connection is re-established
//   query = util.promisify(connection.query).bind(connection);
//   beginTransaction = util.promisify(connection.beginTransaction).bind(connection);
//   commit = util.promisify(connection.commit).bind(connection);
//   rollback = util.promisify(connection.rollback).bind(connection);
// }

// // Initialize at load time
// handleDisconnect();

// // Export all pre-bound objects
// module.exports = {
//   connection,
//   query,
//   beginTransaction,
//   commit,
//   rollback
// };









// const mysql = require('mysql');

// let connection;

// const transientErrors = [
//   'PROTOCOL_CONNECTION_LOST',
//   'ECONNREFUSED',
//   'ER_CON_COUNT_ERROR',
//   'ECONNRESET',
//   'ETIMEDOUT',     // Connection timed out
//   'EPIPE',         // Broken pipe
//   'ENOTFOUND',     // DNS resolution failed
//   'EHOSTUNREACH'   // Host unreachable
// ];

// function handleDisconnect() {
//     connection = mysql.createConnection({
//         host: '88.150.227.111',
//         user: 'nrkindex_111',
//         password: 'hbUs%$#984',
//         database: 'nrkindex_prod',
//         port: 3306,
//         charset: 'utf8mb4',
//     });

//     connection.connect((err) => {
//         if (err) {
//             console.error('❌ Error connecting to DB:', err);
//             setTimeout(handleDisconnect, 2000); // Retry after 2s
//         } else {
//             console.log('✅ Connected to MySQL');
//         }
//     });

//     connection.on('error', function (err) {
//         console.error('⚠️ DB Error:', err);
//         if (transientErrors.includes(err.code)) {
//             console.log(`🔁 Reconnecting due to transient error (${err.code})...`);
//             handleDisconnect();
//         } else {
//             throw err; // Crash on unknown/fatal errors
//         }
//     });
// }

// handleDisconnect();

// module.exports = connection;
