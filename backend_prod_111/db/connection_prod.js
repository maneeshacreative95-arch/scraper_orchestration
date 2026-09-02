

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

// const connection_prod = mysql.createConnection({
//     host: '88.150.227.111',
//     user: 'nrkindex_111',
//     password: 'hbUs%$#984',
//     database: 'nrkindex_prod',
//     port: 3306,
// });

// connection_prod.connect((error) => {
//     if (error) {
//         console.error('Error connecting to MySQL database:', error);
//         process.exit(1);
//         return;
//     }
//     console.log('Connected to MySQL database');
// });

// module.exports = connection_prod;