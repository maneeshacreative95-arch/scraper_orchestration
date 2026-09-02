// controllers/whatsappController.js

const VERIFY_TOKEN = 'test';

exports.receiveMessage = (req, res) => {
    // Webhook verification (when setting up the webhook in WhatsApp API)
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log('Webhook verified');
        return res.status(200).send(req.query['hub.challenge']);
    }

    // Log the incoming WhatsApp message
    console.log('Received WhatsApp message:', req.body);

    // Send the request body back in the response
    res.status(200).json(req.body);
};