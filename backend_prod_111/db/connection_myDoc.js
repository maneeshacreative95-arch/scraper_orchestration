const mysql = require("mysql");

let connection_mydoc_mvc;

const transientErrors = [
    "PROTOCOL_CONNECTION_LOST",
    "ECONNREFUSED",
    "ER_CON_COUNT_ERROR",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "ENOTFOUND",
    "EHOSTUNREACH",
];

function handleMydocDisconnect() {
    connection_mydoc_mvc = mysql.createConnection({
        // Primary
        // host: '88.150.227.111',
        // user: 'mydoc_clinics_web',
        // password: 'Ylkhf^(^788',
        // database: 'mydoc_clinics',
        // port: 3306,

        // Google Cloud (active)
        host: "34.121.250.206",
        user: "googlemysql_native",
        password: "P@ssw0rd*&*#2115",
        database: "mydoc_clinics",
        port: 3306,
        charset: "utf8mb4",
    });

    connection_mydoc_mvc.connect((error) => {
        if (error) {
            console.error("❌ Error connecting to Mydocclinics DB:", error);
            setTimeout(handleMydocDisconnect, 2000); // Retry after 2s
        } else {
            console.log(
                "✅ Connected to Mydocclinics database (with error handling)"
            );
        }
    });

    connection_mydoc_mvc.on("error", (err) => {
        console.error("⚠️ Mydoc DB Error:", err);
        if (transientErrors.includes(err.code)) {
            console.log(
                `🔁 Reconnecting to Mydocclinics due to transient error (${err.code})...`
            );
            handleMydocDisconnect();
        } else {
            console.error("❌ Fatal DB error. Exiting...");
            // process.exit(1); // Allow nodemon/PM2 to auto-restart
            handleMydocDisconnect(); // Attempt to reconnect instead of exiting
        }
    });
}

handleMydocDisconnect();

module.exports = connection_mydoc_mvc;

// const mysql = require('mysql');

// const connection_mydoc_mvc = mysql.createConnection({
//     // host: '88.150.227.111',
//     // user: 'mydoc_clinics_web',
//     // password: 'Ylkhf^(^788',
//     // database: 'mydoc_clinics',
//     // port: 3306,

//     host: '34.121.250.206',
//     user: 'googlemysql_native',
//     password: 'P@ssw0rd*&*#2115',
//     database: 'mydoc_clinics',
//     port: 3306,
//     charset: 'utf8mb4'
// });

// connection_mydoc_mvc.connect((error) => {
//     if (error) {
//         console.error('Error connecting to MySQL database:', error);
//         return;
//     }
//     console.log('Connected to Mydocclinics database');
// });

// module.exports = connection_mydoc_mvc;
