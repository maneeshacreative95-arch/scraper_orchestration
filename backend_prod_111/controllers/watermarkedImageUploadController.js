const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const watermarkUploadModel = require('../models/watermarkUploadModel');

// Upload and watermark function
const uploadImageWithWatermark = async (req, res) => {
    try {
        const uploadedImagePath = req.file.path;
        console.log("uploadedImagePath", uploadedImagePath);
        const userId = req.body.userid;
        const portalId = req.body.portalid;
        const firmId = req.body.firmId; // hard coded
        const selectedFontSize = req.body.size;
        const fontColor = req.body.color;
        const captionText = req.body.caption; // New field for caption text
        const addwatermark = req.body.addwatermark === 'true';
        console.log("Font size ", selectedFontSize);
        console.log("Font color ", fontColor);
        console.log("captionText", captionText);
        console.log("addwatermark", addwatermark);
        // Fetch watermark data from the database
        watermarkUploadModel.getWatermarkByUserId(userId, async (err, watermarkData) => {
            if (err) {
                console.log("Database error", err);
                return res.status(500).json({ message: 'Error retrieving watermark', error: err.message });
            }
            if (!watermarkData) {
                return res.status(404).json({ message: 'No watermark found for this user.' });
            }
            const outputFilePath = `/var/www/rafalin/mongo_react/images/MyB_App/${portalId}/${userId}/watermark/watermarked_${req.file.filename}`;
            const outputDir = `/var/www/rafalin/mongo_react/images/MyB_App/${portalId}/${userId}/watermark`;
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });  // This will create the entire path if it doesn't exist
                console.log(`Directory created: ${outputDir}`);
            }
            const image = sharp(uploadedImagePath);
            const metadata = await image.metadata();
            const imageWidth = metadata.width;
            const imageHeight = metadata.height;
            let compositeOperations = [];

            // Check if watermark should be added
            if (addwatermark) {
                if (watermarkData.WATERMARK_PATH) {
                    // const publicDirectory = path.resolve(__dirname, '../..', 'public');
                    const publicDirectory = path.resolve(__dirname, '../..', 'mongo_react');
                    console.log("publicDirectory", publicDirectory);
                    let adjustedWatermarkPath = watermarkData.WATERMARK_PATH.replace(/^\.\./, '');
                    let watermarkImagePath = path.join(publicDirectory, adjustedWatermarkPath);

                    watermarkImagePath = watermarkImagePath.replace(/\\/g, '/');
                    console.log("watermarkImagePath", watermarkImagePath);

                    let logo = sharp(watermarkImagePath);
                    const logoMetadata = await logo.metadata();
                    const nominalWidth = 200;
                    const scaleFactor = nominalWidth / logoMetadata.width;

                    logo = await logo
                        .resize({
                            width: nominalWidth,
                            height: Math.floor(logoMetadata.height * scaleFactor),
                            fit: sharp.fit.inside
                        })
                        .toBuffer();
                    compositeOperations.push({ input: logo, gravity: 'southeast' });
                } else if (watermarkData.WATERMARK_TEXT) {
                    const fontSize = Math.floor(imageHeight * selectedFontSize);
                    const text = watermarkData.WATERMARK_TEXT;

                    const maxCharsPerLine = Math.floor(imageWidth / (fontSize * 0.6));
                    const words = text.split(' ');
                    let textLines = [];
                    let currentLine = '';

                    words.forEach(word => {
                        if ((currentLine + word).length <= maxCharsPerLine) {
                            currentLine += (currentLine ? ' ' : '') + word;
                        } else {
                            textLines.push(currentLine);
                            currentLine = word;
                        }
                    });
                    if (currentLine) {
                        textLines.push(currentLine);
                    }

                    const totalLines = textLines.length;
                    const initialYPos = imageHeight - 10;
                    let svgText = `<svg width="${imageWidth}" height="${imageHeight}">
                        <style>
                            .watermarkText {
                                fill: ${fontColor};
                                font-family: Arial, sans-serif;
                                font-size: ${fontSize}px;
                                font-weight: bold;
                                text-anchor: end;
                            }
                        </style>
                        <text x="100%" y="${initialYPos}" class="watermarkText">`;

                    textLines.forEach((line, index) => {
                        svgText += `<tspan x="100%" dy="${index === 0 ? 0 : fontSize + 2}">${line}</tspan>`;
                    });

                    svgText += `</text></svg>`;
                    compositeOperations.push({ input: Buffer.from(svgText), gravity: 'southeast' });
                }
            }

            // Add the caption (always included)
            if (captionText) {
                const captionFontSize = Math.floor(imageHeight * 0.08);
                const maxCharsPerLine = Math.floor(imageWidth / (captionFontSize * 0.6));
                const words = captionText.split(' ');

                let lines = [];
                let currentLine = '';

                words.forEach(word => {
                    if ((currentLine + word).length <= maxCharsPerLine) {
                        currentLine += (currentLine ? ' ' : '') + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                });

                if (currentLine) {
                    lines.push(currentLine);
                }

                const totalLines = lines.length;
                const lineHeight = captionFontSize + 10;
                const initialYPos = (imageHeight / 2) - ((totalLines - 1) * lineHeight) / 2;

                let svgCaption = `<svg width="${imageWidth}" height="${imageHeight}">
                    <style>
                        .captionText {
                            fill: ${fontColor};
                            font-family: Arial, sans-serif;
                            font-size: ${captionFontSize}px;
                            font-weight: bold;
                            text-anchor: middle;
                        }
                    </style>
                    <text x="${imageWidth / 2}" y="${initialYPos}" class="captionText">`;

                lines.forEach((line, index) => {
                    svgCaption += `<tspan x="${imageWidth / 2}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`;
                });

                svgCaption += `</text></svg>`;
                compositeOperations.push({ input: Buffer.from(svgCaption) });
            }

            await image.composite(compositeOperations).toFile(outputFilePath);
            // const dbFilePath = outputFilePath.replace('public/', '');
            const dbFilePath = outputFilePath.replace('/var/www/rafalin/mongo_react', '..');
            // const outputFilePath_front = path.join('/var/www/rafalin/mongo_react', 'watermark', `watermarked_${req.file.filename}`);

            watermarkUploadModel.insertImageDetails(dbFilePath, userId, portalId, firmId, (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Error saving image details', error: err.message });
                }

                res.status(200).json({
                    message: 'Image uploaded and watermarked successfully',
                    imageUrl: `${outputFilePath}`
                });
            });
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ message: 'Error processing request', error: err.message });
    }
};

module.exports = { uploadImageWithWatermark };

