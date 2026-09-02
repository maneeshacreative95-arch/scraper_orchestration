const db = require('../db/connection_trn');

// Function to save watermark data to the database
const saveWatermark = (data, callback) => {
    console.log('Entering saveWatermark function');
    console.log('Received data:', data);

    // SQL for inserting a new watermark record
    const insertSql = `
        INSERT INTO WATERMARKS_DETAILS (USERID, FIRMID, WATERMARK_PATH, WATERMARK_TEXT, STATUS)
        VALUES (?, ?, ?, ?, 'ACTIVE')`;

    console.log('Insert SQL:', insertSql);

    // Execute the insert query
    db.query(insertSql, [data.USERID, data.firmid,  data.watermark_path, data.watermark_text], (err, insertResult) => {
        if (err) {
            console.error('Error during insert query:', err);
            return callback(err);
        }

        console.log('Insert query successful:', insertResult);

        // Get the ID of the last inserted record
        const lastInsertedId = insertResult.insertId;
        console.log('Last inserted ID:', lastInsertedId);

        // SQL to update all previous records for this USERID to 'INACTIVE' except the newly inserted one
        const updateSql = `
            UPDATE WATERMARKS_DETAILS 
            SET STATUS = 'INACTIVE' 
            WHERE USERID = ? AND FIRMID = ? AND ID != ?`;

        console.log('Update SQL:', updateSql);

        // Execute the update query
        db.query(updateSql, [data.USERID, data.firmid, lastInsertedId], (err, updateResult) => {
            if (err) {
                console.error('Error during update query:', err);
                return callback(err);
            }

            console.log('Update query successful:', updateResult);

            // Successfully inserted and updated records
            console.log('saveWatermark operation completed successfully');
            callback(null, { insertResult, updateResult });
        });
    });
};

module.exports = { saveWatermark };
