// routes/bulkEmailRoutes.js
const express = require('express');
const router = express.Router();
const BulkEmailController = require('../controllers/BulkEmailController');


// Route to get sent emails
router.get('/emails/sent', BulkEmailController.getSentEmails);

router.get('/myemailgroup', BulkEmailController.getEmailGroup);

module.exports = router;
