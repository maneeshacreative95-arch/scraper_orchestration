// routes/holidayRoutes.js

const express = require('express');
const router = express.Router();
const db = require('../db/connection_trn_117_pool_mysql12.js'); // Update path if your DB file is elsewhere

// @route   GET /api/holiday_days_list
// @desc    Get all holidays from the HOLIDAY_DAYS_LIST table
router.get('/', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear().toString(); // Ensure it's a string for comparison
    const [rows] = await db.execute(
      'SELECT * FROM HOLIDAY_DAYS_LIST WHERE YEAR = ?',
      [currentYear]
    );
    // const [rows] = await db.execute('SELECT * FROM HOLIDAY_DAYS_LIST');
    res.status(200).json(rows);
  } catch (error) {
    console.error('❌ Error fetching holiday list:', error.message);
    res.status(500).json({ message: 'Server error while retrieving holidays.' });
  }
});

module.exports = router;
