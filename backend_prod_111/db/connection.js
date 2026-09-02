

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
    console.error(`❌ MySQL connection error in connection (111 server) :`, err.code, err.message);
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
                console.error(`❌ MySQL connection error   in connection (111 server) (threadId ${conn.threadId}):`, err.code, err.message);
            });

        });
    });
};

module.exports = connection;



// const mysql = require('mysql');

// let connection_mvc;

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

// function handleMVCDisconnect() {
//     connection_mvc = mysql.createConnection({
//         host: '88.150.227.111',
//         user: 'nrkindex_111',
//         password: 'hbUs%$#984',
//         database: 'nrkindex_prod',
//         port: 3306,
//         charset: 'utf8mb4',
//     });

//     connection_mvc.connect((error) => {
//         if (error) {
//             console.error('❌ Error connecting to MySQL database:', error);
//             setTimeout(handleMVCDisconnect, 2000); // Retry after 2s
//         } else {
//             console.log('✅ Connected to 111 nrkindex_prod MySQL database (with error handling)');
//         }
//     });

//     connection_mvc.on('error', (err) => {
//         console.error('⚠️ MVC DB Error:', err);
//         if (transientErrors.includes(err.code)) {
//             console.log(`🔁 Reconnecting due to transient error (${err.code})...`);
//             handleMVCDisconnect();
//         } else {
//             console.error('❌ Fatal DB error. Exiting...');
//             // process.exit(1); // Let nodemon/PM2 restart
//             handleMVCDisconnect()
//         }
//     });
// }

// handleMVCDisconnect();

// module.exports = connection_mvc;



// const mysql = require('mysql');

// const connection_mvc = mysql.createConnection({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     port: 3306,
//     charset: 'utf8mb4',
// });

// connection_mvc.connect((error) => {
//     if (error) {
//         console.error('Error connecting to MySQL database:', error);
//         return;
//     }
//     console.log('Connected to MySQL database');
// });

// module.exports = connection_mvc;