const express = require('express');
const axios = require('axios');
require('dotenv').config();

// If you want to use this as a standalone server, change this to `const app = express();`
// Since you have an existing server, we'll export it as an Express Router.
const router = express.Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// console.log("BOT_TOKEN", BOT_TOKEN);
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Database pool setup
const pool = require('../db/connection_trn_117_pool_mysql12');

// Helper function to reply to Telegram
async function sendTelegramMessage(chatId, text) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text
        });
    } catch (error) {
        console.error("Error sending message to Telegram:", error.response?.data || error.message);
    }
}

// ---------------------------------------------------------------------
// YOUR WEBHOOK ROUTE
// e.g. POST https://myblocks.in:7101/telegram_bot
// ---------------------------------------------------------------------
router.post('/telegram_bot', async (req, res) => {
    // 1. MUST acknowledge receipt to Telegram immediately (so it stops retrying)
    res.sendStatus(200);

    const update = req.body;

    // We only care about normal text messages
    if (!update || !update.message || !update.message.text) return;

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    // 2. Parse the `/start {USER_ID}` command
    if (text.startsWith('/start')) {
        const parts = text.split(' ');

        if (parts.length < 2) {
            await sendTelegramMessage(chatId, "Invalid link. Please use the link provided in your WhatsApp message.");
            return;
        }

        const userId = parseInt(parts[1], 10);
        if (isNaN(userId)) {
            await sendTelegramMessage(chatId, "Invalid user ID.");
            return;
        }

        console.log(`[Telegram Webhook] Received /start with USER_ID: ${userId} and CHAT_ID: ${chatId}`);

        // 3. Update the Database
        try {
            const [rows] = await pool.execute('SELECT USER_ID, CHAT_ID FROM GST_USER_NOTIFICATIONS WHERE USER_ID = ?', [userId]);

            if (rows.length === 0) {
                await sendTelegramMessage(chatId, "User not found in our database.");
                return;
            }

            const user = rows[0];
            if (user.CHAT_ID !== null) {
                await sendTelegramMessage(chatId, "✅ You are already registered for GST notifications!");
                return;
            }

            // Save CHAT_ID to database
            await pool.execute('UPDATE GST_USER_NOTIFICATIONS SET CHAT_ID = ? WHERE USER_ID = ?', [chatId, userId]);

            await sendTelegramMessage(chatId, "✅ Registered successfully! You will now receive GST notifications here.");
            console.log(`[Telegram Webhook] Successfully registered USER_ID: ${userId} with CHAT_ID: ${chatId}`);

        } catch (error) {
            console.error('[Telegram Webhook] Database error:', error);
            await sendTelegramMessage(chatId, "An error occurred while registering. Please try again later.");
        }
    }
});

// Assuming your main express app is basically importing this router:
// const telegramWebhook = require('./telegram_webhook');
// app.use('/', telegramWebhook);

module.exports = router;
