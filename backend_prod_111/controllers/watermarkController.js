const path = require('path');
const watermarkModel = require('../models/watermarkModel');

const saveWatermark = (req, res) => {
    const userId = req.body.USERID;
    const name = req.body.name;
    const firmid = req.body.firmid;
    const watermarkType = req.body.watermark_type || req.body.watermarkType; // Handle both cases

    let watermarkData = {
        USERID: userId,
        firmid: firmid,
        name: name,
        watermark_path: '',
        watermark_text: ''
    };

    if (watermarkType === 'image') {
        if (req.file) {

            const path1 = req.file.path;
            console.log("path1", path1)

            const imageFilePath = req.file.path;

            const imagePathNew = imageFilePath.replace(/\\/g, '/');
            const imagePathNew1 = imagePathNew.replace('/var/www/rafalin/mongo_react', '');
            const watermarkPath = `..${imagePathNew1}`;

            //const watermarkPath = `../png/${req.file.filename}`; // Store path relative to public
            watermarkData.watermark_path = watermarkPath;
            watermarkModel.saveWatermark(watermarkData, (err, result) => {
                const DATE = new Date().toISOString().split('T')[0]; // Or use actual date from request if needed
                runPythonScript(userId, firmid, DATE, res, 'Watermark image saved successfully');

                // if (err) return res.status(500).json({ message: 'Error saving watermark image', error: err });
                // return res.status(200).json({ message: 'Watermark image saved successfully' });
            });
        } else {
            return res.status(400).json({ message: 'No image file provided' });
        }
    } else if (watermarkType === 'text') {
        console.log("Text upload processing", watermarkData);
        watermarkData.watermark_text = req.body.watermark_text;

        watermarkModel.saveWatermark(watermarkData, (err, result) => {
            const DATE = new Date().toISOString().split('T')[0];
            runPythonScript(userId, firmid, DATE, res, 'Watermark text saved successfully');
            // if (err) return res.status(500).json({ message: 'Error saving watermark text', error: err });
            // return res.status(200).json({ message: 'Watermark text saved successfully' });
        });
    } else {
        return res.status(400).json({ message: 'Invalid watermark type' });
    }
};




const runPythonScript = (userId, firmId, date, res, successMessage) => {
    const isWin = process.platform === 'win32';
    const pythonCmd = isWin ? 'py' : 'python3';
    const scriptPath = isWin
        ? 'D:\\myblocks\\Weekly Planner\\main.py'
        : '/root/pythonForMyblocks/smp-scheduler/image-caption-gen/main.py';

    const case_type= 'watermark';
    const scriptArgs = [scriptPath, userId, firmId, date, case_type];

    const { spawn } = require('child_process');
    const python = spawn(pythonCmd, scriptArgs);

    python.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    python.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    python.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);
        return res.status(200).json({
            message: successMessage,
            pythonExitCode: code,
        });
    });

    python.on('error', (err) => {
        console.error('❌ Failed to start Python script:', err);
        return res.status(500).json({
            message: `${successMessage} but Python script failed to start`,
            error: err.message,
        });
    });
};


module.exports = { saveWatermark };
