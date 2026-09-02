// controllers/BulkEmailController.js
// const BulkEmailGroup = require('../models/BulkEmailModel');
// const SendEmailModel = require('../models/BulkEmailModel');

const { BulkEmailGroup, SendEmailModel } = require('../models/BulkEmailModel');

exports.getEmailGroup = (req, res) => {
    const userid = req.query.userid;
    const firmid = req.query.firmid;

    if (!userid || !firmid) {
        return res.status(400).json({ error: 'Missing required parameters: userid or firmid' });
    }

    BulkEmailGroup.findByUserIdAndFirmId(userid, firmid, (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (results.length === 1) {
            res.json(results);
        } else if (results.length > 1) {
            res.json(results);
        } else {
            res.status(404).json({ error: 'No email group exists for the given user and firm' });
        }
    });
};

exports.getSentEmails = (req, res) => {
    const groupId = req.query.groupid;
    const batchNum = req.query.batch;

    if (!groupId || !batchNum) {
        return res.status(400).json({ error: 'Missing required parameters: groupid or batch' });
    }

    SendEmailModel.getSentEmails(groupId, batchNum, (error, results) => {
        if (error) {
            console.error('Error fetching emails:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
};

