// routes/whatsappRoutes.js

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Define the route for receiving WhatsApp messages
router.post('/trainee/webhook', whatsappController.receiveMessage);

module.exports = router;