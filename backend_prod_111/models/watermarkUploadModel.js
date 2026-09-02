const db = require('../db/connection');


// Function to get watermark details by user ID
const getWatermarkByUserId = (userId, callback) => {
    const query = 'SELECT * FROM WATERMARKS_DETAILS WHERE USERID = ? AND STATUS = "ACTIVE"';
    console.log('Executing query:', query);
    console.log('With parameters:', userId);
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return callback(err, null);
        }
        
        if (results.length > 0) {
            callback(null, results[0]); // Returning the first watermark found for the user
        } else {
            callback(null, null); // No watermark found
        }
    });
};

// Function to insert image details into the image_upload table
const insertImageDetails = (imagePath, userId, portalId, firmId, callback) => {
    const query = `
        INSERT INTO image_upload (image, userid, portalid, FIRMID, DATE)
        VALUES (?, ?, ?, ?, NOW())
    `;
    // Values to insert
    const values = [imagePath, userId, portalId, firmId];

    console.log('Executing query:', query);
    console.log('With values:', values);

    db.query(query, values, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return callback(err, null);
        }
        // If the insert was successful, return the result
        callback(null, results);
    });
};

module.exports = {
    getWatermarkByUserId,
    insertImageDetails, 
};