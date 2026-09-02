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


connection.on('error', (err) => {
    console.error(`❌ MySQL connection error in pmoConnection :`, err.code, err.message);
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
                console.error(`❌ MySQL connection error  in pmoConnection (threadId ${conn.threadId}):`, err.code, err.message);
            });

        });
    });
};

module.exports = connection;










// const mysql = require('mysql');

// const pmoConnection_mvc = mysql.createConnection({
//     host: '88.150.227.111',
//     user: 'pmo_prod_111',
//     password: 'obiK^&(677',
//     database: 'pmo_prod',
//     port: 3306,
//     charset: 'utf8mb4',
// });

// pmoConnection_mvc.connect((error) => {
//     if (error) {
//         console.error('Error connecting to pmo_prod MySQL database:', error);
//         return;
//     }
//     console.log('Connected to pmo_prod MySQL database');
// });

// module.exports = pmoConnection_mvc;