const express = require('express');
const multer = require('multer');
const { uploadImageWithWatermark } = require('../controllers/watermarkedImageUploadController');
const fs = require('fs');
const router = express.Router();

// Multer setup for file storage
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
        
        //cb(null, 'uploads/');
        //cb(null, '../public/watermark');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Route to handle image upload and watermarking
router.post('/', upload.single('image'), uploadImageWithWatermark);

module.exports = router;
