const express = require('express');
const multer = require('multer');
const watermarkController = require('../controllers/watermarkController');
const router = express.Router();
const fs = require('fs');

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        var dest = '/var/www/rafalin/mongo_react/' + req.body.finalpath;
        var stat = null;
        try {
            stat = fs.statSync(dest);
        } catch (err) {
            fs.mkdirSync(dest);
        }
        if (stat && !stat.isDirectory()) {
            throw new Error('Directory cannot be created because an inode of a different type exists at "' + dest + '"');
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ storage });

router.post('/saveWatermark', upload.single('watermark_path'), watermarkController.saveWatermark);

module.exports = router;
