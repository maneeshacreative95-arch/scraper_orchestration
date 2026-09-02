const db = require('../db/connection'); // Assuming you have a database connection module
const connection = require('../db/connection'); 

const BulkEmailGroup = {
    findByUserIdAndFirmId: (userid, firmid, callback) => {
        const query = `SELECT * FROM EMAIL_GROUPS WHERE USERID = ? AND FIRMID = ? AND STATUS='Active'`;
        db.query(query, [userid, firmid], (error, results) => {
            if (error) {
                return callback(error, null);
            }
            return callback(null, results);
        });
    }
};



const SendEmailModel = {
    getSentEmails: (groupId, batchNum, callback) => {
        const query = `
            SELECT MAIL_FROM AS MAIL_FROM_LIST,
                   MAIL_TO AS MAIL_TO_LIST,
                   SUBJECT,
                   CONTENT
            FROM USER_EMAIL_HISTORY
            WHERE GROUPID = ? AND BATCH_NUM = ?`;

        connection.query(query, [groupId, batchNum], (error, results) => {
            if (error) {
                return callback(error, null);
            }
            callback(null, results);
        });
    }
};




module.exports = { BulkEmailGroup, SendEmailModel };