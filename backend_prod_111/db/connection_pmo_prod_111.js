const mysql = require('mysql');
const util = require('util');

const connection = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'pmo_prod_111',
    password: 'YUBjyg677%&',
    database: 'pmo_prod',
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

connection.on('error', function (err) {
    console.error('⚠️ MySQL pool error:', err);
});

setInterval(() => {
    connection.query("SELECT 1", (err) => {
        if (err) console.error("Keep-alive query failed:", err);
    });
}, 60 * 1000);

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
        });
    });
};

module.exports = connection;







// const mysql = require('mysql');

// let pmoConnection;

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

// function handlePMODisconnect() {
//     pmoConnection = mysql.createConnection({
//         host: '88.150.227.111',
//         user: 'pmo_prod_111',
//         password: 'obiK^&(677',
//         database: 'pmo_prod',
//         port: 3306,
//         charset: 'utf8mb4',
//     });

//     pmoConnection.connect((err) => {
//         if (err) {
//             console.error('❌ Error connecting to pmo_prod DB:', err);
//             setTimeout(handlePMODisconnect, 2000); // Retry after 2s
//         } else {
//             console.log('✅ Connected to connection_pmo_prod_111 MySQL database (with error handling)');
//         }
//     });

//     pmoConnection.on('error', function (err) {
//         console.error('⚠️ PMO DB Error:', err);
//         if (transientErrors.includes(err.code)) {
//             console.log(`🔁 Reconnecting pmo_prod due to transient error (${err.code})...`);
//             handlePMODisconnect();
//         } else {
//             throw err;
//         }
//     });
// }

// // Call once at startup
// handlePMODisconnect();

// module.exports = pmoConnection;
