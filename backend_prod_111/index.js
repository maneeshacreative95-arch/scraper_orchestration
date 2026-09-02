const express = require("express");
const cors = require("cors");
var bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const https = require("https");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const mysql = require("mysql");
const nodemailer = require("nodemailer");
const { exec } = require("child_process");
const { spawn } = require("child_process");
const axios = require("axios");
const socketIo = require("socket.io");
const util = require("util");

// const Typo = require("typo-js");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

// Load the English dictionary
// const dictionary = new Typo("en_US");
const { v4: uuidv4 } = require("uuid");
const net = require("net");
const { stringify } = require("csv-stringify/sync");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

const { getClientIp } = require("get-client-ip");
const geoip = require("geoip-country");

require("dotenv").config();

const { JSONPath } = require("jsonpath-plus");

const tls = require("tls");

const crypto = require("crypto");

// const fetch = require("node-fetch"); // if using CommonJS

const OLLAMA_API_URL = "http://61.2.142.91:8434/api/chat";
const HEADERS = { "Content-Type": "application/json" };

const connection_trn = require("./db/connection_trn.js");

const nrkindex_prod_111_pool = require("./db/nrkindex_prod_111_pool.js");

const {
    connection_trn_117_pool_retry_wrapper,
} = require("./db/connection_trn_117_pool.js");

const TrendsRoute = require("./routes/TrendsRoute"); // Adjust the path according to your project structure
const whatsappRoutes = require("./routes/whatsappRoutes");

const watermarkRoutes = require("./routes/watermarkRoutes.js");
const watermarkUploadRoutes = require("./routes/watermarkUploadRoutes");
const bulkEmailRoutes = require("./routes/bulkEmailRoutes");

const holidayRoutes = require("./routes/holidayRoutes");
const specialHolidayRouter = require("./routes/specialHolidayRouter");

const telegramWebhook = require('./routes/telegram_webhook.js');


const app = express();

const MONGO_URL = "mongodb://CustomerSupport:nrkindex123@88.150.227.111:27017";
const DATABASE_NAME = "nrkindex_prod";

// const allowedOrigins = [
//   'http://88.150.227.111:4550',
//   'https://myblocks.in',
//   'https://techie-index.com/'

// ];
// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true
// }));

app.use(
    cors({
        origin: "*",
    })
);

app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());


app.use(bodyParser.json({
    verify: (req, res, buf) => {
        if (buf && buf.length) {
            req.rawBody = buf;
            console.log("📦 Raw body captured:", buf.length);
        }
    }
}));



const JWT_SECRET = process.env.JWT_SECRET || "fallbacksecret";

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token)
        return res.status(401).json({ message: "Authentication token required" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err)
            return res.status(403).json({ message: "Invalid or expired token" });
        req.user = user;
        next();
    });
};


// Global variables for MongoDB client and database
let client;
let db;

// Connect to the MongoDB database when the server starts
(async () => {
    try {
        client = await MongoClient.connect(MONGO_URL);
        db = client.db(DATABASE_NAME);
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
})();

// process.on('SIGINT', () => {
//     if (client) {
//         client.close();
//         console.log('MongoDB connection closed');
//     }
// });

const connection = mysql.createConnection({
    host: "localhost",
    user: "nrkindex_111",
    password: "hbUs%$#984",
    database: "nrkindex_prod",
    port: 3306,
    charset: "utf8mb4",
});

connection.connect((error) => {
    if (error) {
        console.error("Error connecting to MySQL database:", error);
        return;
    }
    console.log("Connected to MySQL database");
});

const pmoConnection = mysql.createConnection({
    host: "localhost",
    user: "pmo_prod_111",
    password: "YUBjyg677%&",
    database: "pmo_prod",
    port: 3306,
    charset: "utf8mb4",
});

pmoConnection.connect((error) => {
    if (error) {
        console.error("Error connecting to pmo_prod MySQL database:", error);
        return;
    }
    console.log("Connected to pmo_prod MySQL database");
});

// const privateKeyPath = "/home/rafalin/cert/myblocks.key";
// const certificatePath = "/home/rafalin/cert/cert.pem";
// const intermediateCertificatePath = "/home/rafalin/cert/inter_cert.pem";

// // Load the private key, SSL certificate, and intermediate certificate
// const privateKey = fs.readFileSync(privateKeyPath, "utf8");
// const certificate = fs.readFileSync(certificatePath, "utf8");
// const intermediateCertificate = fs.readFileSync(
//     intermediateCertificatePath,
//     "utf8"
// );

// // Create an options object with the key, certificate, and intermediate certificate
// const options = {
//     key: privateKey,
//     cert: certificate,
//     ca: intermediateCertificate, // Include the intermediate certificate here
// };

// ✅ Use Let's Encrypt certificates
// const privateKey = fs.readFileSync(
//     "/etc/letsencrypt/live/myblocks.in/privkey.pem",
//     "utf8"
// );
// const certificate = fs.readFileSync(
//     "/etc/letsencrypt/live/myblocks.in/fullchain.pem",
//     "utf8"
// );

// const options = {
//     key: privateKey,
//     cert: certificate,
// };



// Load certs for each domain
const sslOptions = {
    "myblocks.in": {
        key: fs.readFileSync("/etc/letsencrypt/live/myblocks.in/privkey.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/myblocks.in/fullchain.pem"),
    },
    "techie-index.com": {
        key: fs.readFileSync("/etc/letsencrypt/live/techie-index.com/privkey.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/techie-index.com/fullchain.pem"),
    },
};

// Default cert (fallback)
const defaultCert = sslOptions["myblocks.in"];

// Create HTTPS server with SNICallback
const server = https.createServer(
    {
        key: defaultCert.key,
        cert: defaultCert.cert,
        SNICallback: (servername, callback) => {
            const cert = sslOptions[servername];
            if (cert) {
                callback(null, tls.createSecureContext(cert));
            } else {
                callback(null, tls.createSecureContext(defaultCert));
            }
        },
    },
    app
);

// const server = https.createServer(options, app);

// Start the HTTPS server on port 7101
server.listen(7101, () => {
    console.log("The server is running on port 7101 (HTTPS)");
});

// Initialize socket.io with the HTTPS server
// const io = socketIo(server, {
//     cors: {
//         origin: "https://localhost:3000",
//         methods: ["GET", "POST"],
//         allowedHeaders: ["Content-Type"],
//         credentials: true // If you need to allow credentials
//     }
// });

// // Handle WebSocket connections
// io.on('connection', (socket) => {
//     console.log('WebSocket client connected');
//     socket.emit('message', { data: 'Hello, Secure WebSocket!' });
// });

const TARGET_SERVER_IP = "61.2.142.91"; // Target WebSocket server IP
const TARGET_SERVER_PORT = 8500; // Target WebSocket server port

// const io = socketIo(server, {
//     cors: {
//         origin: "https://localhost:7100",  // Allow frontend
//         methods: ["GET", "POST"],
//         allowedHeaders: ["Content-Type"],
//         credentials: true
//     }
// });

const io = socketIo(server, {
    cors: {
        origin: "https://myblocks.in/", // Change this to your frontend URL in production
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
    },
});

io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

    socket.on("message", (data) => {
        console.log(`Received message from client: ${data}`);
        socket.broadcast.emit("message", data);
    });
});

const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (request, socket, head) => {
    if (socket.upgradeHandled) {
        socket.destroy(); // Prevent duplicate upgrades
        return;
    }
    socket.upgradeHandled = true;

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

wss.on("connection", (clientSocket) => {
    console.log("Client connected to MITM (WSS)");
    const targetSocket = new WebSocket(
        `ws://${TARGET_SERVER_IP}:${TARGET_SERVER_PORT}`
    );

    targetSocket.on("open", () => {
        console.log("Connected to target WebSocket server");
    });

    targetSocket.on("message", (message) => {
        console.log(`Received from target server: ${message}`);
        clientSocket.send(message);
    });

    targetSocket.on("close", () => {
        console.log("Target WebSocket server closed");
        clientSocket.close();
    });

    targetSocket.on("error", (err) => {
        console.error("Error with target WebSocket server:", err);
        clientSocket.close();
    });

    clientSocket.on("message", (message) => {
        console.log(`Intercepted from client: ${message}`);
        targetSocket.send(message);
    });

    clientSocket.on("close", () => {
        console.log("Client disconnected");
        targetSocket.close();
    });

    clientSocket.on("error", (err) => {
        console.error("Error with client WebSocket:", err);
        targetSocket.close();
    });
});

// const wss = new WebSocket.Server({ server });

// wss.on("connection", (clientSocket) => {
//     console.log("Client connected to MITM (WSS)");

//     // Connect to the real WebSocket server
//     const targetSocket = new WebSocket(`ws://${TARGET_SERVER_IP}:${TARGET_SERVER_PORT}`);

//     targetSocket.on("open", () => {
//         console.log("Connected to target WebSocket server");
//     });

//     targetSocket.on("message", (message) => {
//         console.log(`Received from target server: ${message}`);
//         clientSocket.send(message); // Forward response to client
//     });

//     targetSocket.on("close", () => {
//         console.log("Target WebSocket server closed");
//         clientSocket.close();
//     });

//     targetSocket.on("error", (err) => {
//         console.error("Error with target WebSocket server:", err);
//         clientSocket.close();
//     });

//     // Handle messages from client
//     clientSocket.on("message", (message) => {
//         console.log(`Intercepted from client: ${message}`);
//         targetSocket.send(message); // Forward request to target server
//     });

//     clientSocket.on("close", () => {
//         console.log("Client disconnected");
//         targetSocket.close();
//     });

//     clientSocket.on("error", (err) => {
//         console.error("Error with client WebSocket:", err);
//         targetSocket.close();
//     });
// });

app.use("/trends", TrendsRoute);
app.use("/whatsapp", whatsappRoutes);
app.use("/api", watermarkRoutes);
app.use("/watermarkupload", watermarkUploadRoutes);
app.use("/get", bulkEmailRoutes);

app.use("/api/holiday_days_list", holidayRoutes);
app.use("/api/special_user_holiday", specialHolidayRouter);

// Mount it to the root so that /telegram_bot becomes the full path
app.use('/', telegramWebhook);

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        var dest =
            "/var/www/rafalin/mongo_react/images/MyB_App/" + req.body.finalpath;
        var stat = null;
        try {
            stat = fs.statSync(dest);
        } catch (err) {
            fs.mkdirSync(dest);
        }
        if (stat && !stat.isDirectory()) {
            throw new Error(
                'Directory cannot be created because an inode of a different type exists at "' +
                dest +
                '"'
            );
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const today = new Date();
        const formattedDate = today.toISOString().slice(0, 10); // Get today's date in 'YYYY-MM-DD' format
        const extname = path.extname(file.originalname);

        const uniqueSuffix = Math.round(Math.random() * 1e9);

        if (req.body.finalpath) {
            const finalpathWithUnderscores = req.body.finalpath.replace(
                /\//g,
                "_"
            ); // Replace / with _
            const filename = `image-${uniqueSuffix}_${formattedDate}_${finalpathWithUnderscores}${extname}`;
            cb(null, filename);
        }
    },
});

var upload = multer({
    dest: "/var/www/rafalin/mongo_react/images/MyB_App",
    storage: storage,
});

var storage_resume_smp = multer.diskStorage({
    destination: function (req, file, cb) {
        var dest = "/var/www/rafalin/mongo_react/" + req.body.finalpath;
        var stat = null;
        try {
            stat = fs.statSync(dest);
        } catch (err) {
            fs.mkdirSync(dest);
        }
        if (stat && !stat.isDirectory()) {
            throw new Error(
                'Directory cannot be created because an inode of a different type exists at "' +
                dest +
                '"'
            );
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const today = new Date();
        const formattedDate = today.toISOString().slice(0, 10); // Get today's date in 'YYYY-MM-DD' format
        const extname = path.extname(file.originalname);

        const uniqueSuffix = Math.round(Math.random() * 1e9);

        if (req.body.finalpath) {
            const finalpathWithUnderscores = req.body.finalpath.replace(
                /\//g,
                "_"
            ); // Replace / with _
            let filename;
            if (req.body.finalpath.toLowerCase().includes("resume")) {
                filename = `resume-${uniqueSuffix}_${formattedDate}_${finalpathWithUnderscores}${extname}`;
            } else {
                filename = `${uniqueSuffix}_${formattedDate}_${finalpathWithUnderscores}${extname}`;
            }
            cb(null, filename);
        }
    },
});

var upload_resume_smp = multer({
    dest: "/var/www/rafalin/mongo_react/",
    storage: storage_resume_smp,
});

var storage_smpl = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log("Request body:", req.body);
        console.log("Request files:", req.files);
        console.log("File:", file.originalname);
        var dest =
            "/var/www/rafalin/mongo_react/images/MyB_App/" + req.body.finalpath;
        var stat = null;
        try {
            stat = fs.statSync(dest);
        } catch (err) {
            fs.mkdirSync(dest);
            // fs.mkdirSync(dest, { recursive: true });
        }
        if (stat && !stat.isDirectory()) {
            throw new Error(
                'Directory cannot be created because an inode of a different type exists at "' +
                dest +
                '"'
            );
        }
        cb(null, dest);
    },

    filename: (req, file, cb) => {
        const today = new Date();
        const formattedDate = today.toISOString().slice(0, 10);
        const extname = path.extname(file.originalname);
        const uniqueSuffix = Math.round(Math.random() * 1e9);

        if (req.body.finalpath) {
            const finalpathWithUnderscores = req.body.finalpath.replace(
                /\//g,
                "_"
            );
            const filename = `image-${uniqueSuffix}_${formattedDate}_${finalpathWithUnderscores}${extname}`;
            cb(null, filename);
        } else {
            cb(null, `image-${uniqueSuffix}_${formattedDate}${extname}`); // fallback
        }
    },
});

var upload_smpl = multer({
    dest: "/var/www/rafalin/mongo_react/images/MyB_App",
    storage: storage_smpl,
    fileFilter: (req, file, cb) => {
        if (!file) {
            // No file was uploaded
            cb(new Error("No file uploaded"), false);
        } else {
            // File is accepted
            cb(null, true);
        }
    },
});

app.post("/create/folder/session", (req, res) => {
    const portalid = req.body.portalid;
    const userid = req.body.userid;

    const folderPath = path.join(
        "/var/www/rafalin/mongo_react/images/MyB_App",
        portalid
    );

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    const folderPath1 = path.join(
        "/var/www/rafalin/mongo_react/images/MyB_App",
        portalid,
        userid
    );

    if (!fs.existsSync(folderPath1)) {
        fs.mkdirSync(folderPath1);
    }

    res.send({
        status: "success",
        message: "Folder created successfully",
    });
});

app.post("/create/folder/session/resumeupload", (req, res) => {
    const homepath = req.body.homepath;
    const portalid = req.body.portalid;
    const userid = req.body.userid;

    let folderPath = path.join("/var/www/rafalin/mongo_react", homepath);

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    folderPath = path.join("/var/www/rafalin/mongo_react", homepath, portalid);

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    folderPath = path.join(
        "/var/www/rafalin/mongo_react",
        homepath,
        portalid,
        userid
    );

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    res.send({
        status: "success",
        message: "Folder created successfully",
    });
});

// app.post('/news/headlines/entertainment', async (req, res) => {
//     try {

//         const port = parseInt(req.body.port);
//         const parentport = parseInt(req.body.parentport);

//         const query = {
//             $and: [
//                 {
//                     $or: [
//                         { portalid: port },
//                         { portalid: parentport },
//                         { parentportalid: port }
//                     ]
//                 },
//                 {
//                     $or: [
//                         { DOC_CATEGRY: 'news' },
//                         { DOC_CATEGRY: 'News' }
//                     ]
//                 },
//                 {
//                     DOC_PRICE: { $gt: 2 }
//                 }
//             ]
//         };

//         const options = {
//             sort: { DOC_ID: -1 },
//             limit: 9
//         };

//         // Find documents that match the given query and apply the options for sorting and limiting
//         const documents = await db.collection('kf_docmnt').find(query, options).toArray();
//         //const documents = await db.collection('kf_docmnt').find().toArray();
//         //res.status(200).json(documents);
//         res.send(documents)
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

// app.post("/news/headlines/entertainment", async (req, res) => {
//     try {
//         const port = parseInt(req.body.port);
//         const parentport = parseInt(req.body.parentport);

//         let query = {
//             $and: [
//                 {
//                     $or: [
//                         { portalid: port },
//                         { portalid: parentport },
//                         { parentportalid: port },
//                     ],
//                 },
//                 {
//                     $or: [{ DOC_CATEGRY: "news" }, { DOC_CATEGRY: "News" }],
//                 },
//                 {
//                     DOC_PRICE: { $gt: 2 },
//                 },
//             ],
//         };

//         const options = {
//             sort: { DOC_ID: -1 },
//             limit: 8,
//         };

//         // Find documents that match the given query and apply the options for sorting and limiting
//         let documents = await db
//             .collection("kf_docmnt")
//             .find(query, options)
//             .toArray();

//         let documentCount = await db
//             .collection("kf_docmnt")
//             .countDocuments(query, options);
//         console.log("documentCount", documentCount);

//         if (documentCount >= 1) {
//             res.send(documents);
//         } else {
//             const parentPortalDocument = await db
//                 .collection("portal")
//                 .findOne({ portalid: parentport });

//             console.log("parentPortalDocument", parentPortalDocument);

//             console.log(
//                 "parentPortalDocument.portalid 2nd phase",
//                 parentPortalDocument.portalid
//             );
//             console.log(
//                 "parentPortalDocument.parentportalid 2nd phase",
//                 parentPortalDocument.parentportalid
//             );

//             query = {
//                 $and: [
//                     {
//                         $or: [
//                             { portalid: parentPortalDocument.portalid },
//                             { portalid: parentPortalDocument.parentportalid },
//                             { parentportalid: parentPortalDocument.portalid },
//                             {
//                                 parentportalid:
//                                     parentPortalDocument.parentportalid,
//                             },
//                         ],
//                     },
//                     {
//                         $or: [{ DOC_CATEGRY: "news" }, { DOC_CATEGRY: "News" }],
//                     },
//                     {
//                         DOC_PRICE: { $gt: 2 },
//                     },
//                 ],
//             };
//             documents = await db
//                 .collection("kf_docmnt")
//                 .find(query, options)
//                 .toArray();

//             //console.log("documents", documents)

//             documentCount = await db
//                 .collection("kf_docmnt")
//                 .countDocuments(query, options);

//             console.log("documentCount", documentCount);

//             if (documentCount >= 1) {
//                 res.send(documents);
//             } else {
//                 const parentPortalDocument1 = await db
//                     .collection("portal")
//                     .findOne({ portalid: parentPortalDocument.parentportalid });

//                 console.log("parentPortalDocument", parentPortalDocument1);

//                 console.log(
//                     "parentPortalDocument.portalid 3nd phase",
//                     parentPortalDocument1.portalid
//                 );
//                 console.log(
//                     "parentPortalDocument.parentportalid 3nd phase",
//                     parentPortalDocument1.parentportalid
//                 );

//                 query = {
//                     $and: [
//                         {
//                             $or: [
//                                 { portalid: parentPortalDocument1.portalid },
//                                 {
//                                     portalid:
//                                         parentPortalDocument1.parentportalid,
//                                 },
//                                 {
//                                     parentportalid:
//                                         parentPortalDocument1.portalid,
//                                 },
//                             ],
//                         },
//                         {
//                             $or: [
//                                 { DOC_CATEGRY: "news" },
//                                 { DOC_CATEGRY: "News" },
//                             ],
//                         },
//                         {
//                             DOC_PRICE: { $gt: 2 },
//                         },
//                     ],
//                 };
//                 documents = await db
//                     .collection("kf_docmnt")
//                     .find(query, options)
//                     .toArray();

//                 //console.log("documents", documents)

//                 documentCount = await db
//                     .collection("kf_docmnt")
//                     .countDocuments(query, options);

//                 console.log("documentCount", documentCount);

//                 if (documentCount >= 1) {
//                     res.send(documents);
//                 }
//             }
//         }

//         //const documents = await db.collection('kf_docmnt').find().toArray();
//         //res.status(200).json(documents);
//     } catch (err) {
//         console.error("Error:", err);
//         res.status(500).json({
//             message: "An error occurred while processing your request.",
//         });
//     }
// });



app.post("/news/headlines/entertainment", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const parentport = parseInt(req.body.parentport);

        const limit = 8;

        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port },
                        { portalid: parentport },
                        { parentportalid: port },
                    ],
                },
                {
                    $or: [
                        { DOC_CATEGRY: "news" },
                        { DOC_CATEGRY: "News" },
                    ],
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const options = {
            sort: {
                DOC_SDATE: -1,
                DOC_PRI: -1,
                DOC_ID: -1,
            },
        };

        const documents = await db
            .collection("kf_docmnt")
            .find(query, options)
            .limit(limit)
            .toArray();

        res.send(documents);

    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/entertainment/more", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const parentport = parseInt(req.body.parentport);
        const page = parseInt(req.body.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port },
                        { portalid: parentport },
                        { parentportalid: port },
                    ],
                },
                {
                    $or: [{ DOC_CATEGRY: "news" }, { DOC_CATEGRY: "News" }],
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const options = {
            sort: {
                DOC_SDATE: -1,
                DOC_PRI: -1,
                DOC_ID: -1,
            },
        };

        // Find documents that match the given query and apply the options for sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, options)
            .skip(skip)
            .limit(limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/citynews/news/singlepages", async (req, res) => {
    try {
        const id = req.body.id;

        const query = {
            _id: new ObjectId(id),
        };

        const projection = {
            _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            image: 1,
            DOC_URL: 1,
            DOC_SDATE: 1,
        };

        // Execute the query
        const result = await db
            .collection("kf_docmnt")
            .find(query, projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/cityS/quality", async (req, res) => {
    try {
        // Assuming you have a MongoDB connection object named 'db'
        //const db = req.db; // or however you get your MongoDB connection object

        // MongoDB aggregation pipeline

        const pipeline = [
            {
                $match: {
                    status: "ACTIVE",
                    type: "MYBLOCKS.IN",
                },
            },
            {
                $lookup: {
                    from: "portal_quality", // Target collection
                    localField: "portalid", // Field in 'portal' collection
                    foreignField: "PORTALID", // Field in 'portal_quality' collection
                    as: "quality", // Field to store the joined documents
                },
            },
            {
                $limit: 10, // Limit the number of results to 10
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    portalname: 1,
                    portalid: 1,
                    parentportalid: 1,
                    type: 1,
                },
            },

            // You can add more stages to the pipeline if needed
        ];

        // Execute the aggregation pipeline
        const result = await db
            .collection("portal")
            .aggregate(pipeline)
            .toArray();
        // console.log(result);
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/cityS/PortalID/techieindexlatest_first4", async (req, res) => {
    try {
        const portalType = "TECHIE-INDEX.COM";
        const status = "ACTIVE";
        const limit = 200;

        const query = {
            type: portalType,
            status: status,
        };

        const projection = {
            id: 1,
            portalname: 1,
            portalid: 1,
            parentportalid: 1,
            type: 1,
            _id: 0,
        };

        const options = {
            sort: { quality_level: -1 }, // Sorting by date in descending order
        };

        // Execute the query with the specified projection and limit
        const result = await db
            .collection("portal")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);

        // Close the MongoDB connection
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/cityS/PortalID/id", async (req, res) => {
    try {
        // Build the MongoDB query
        const query = {
            portalid: parseInt(req.body.id),
        };

        // Execute the query to find matching documents
        const documents = await db.collection("portal").find(query).toArray();

        // Send the result as a response
        res.send(documents);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/city/fromname", async (req, res) => {
    try {
        // Build the MongoDB query
        console.log("req.body.city", req.body.city);
        const query = {
            portalname: {
                $regex: new RegExp(`^${req.body.city}$`, "i"),
                // $regex: new RegExp(req.body.city, 'i')
            },
        };

        // Execute the query to find matching documents
        const documents = await db.collection("portal").find(query).toArray();

        // Send the result as a response
        res.send(documents);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

//Rafalin add links to top header in react myblock
app.post("/top/myblock/links", async (req, res) => {
    try {
        // Assuming you have a MongoDB connection object named 'db'
        // const db = req.db; // or however you get your MongoDB connection object

        // MongoDB query
        const query = {
            type: "MYBLOCKS.IN",
            headerdisplay: { $ne: "" },
            status: "ACTIVE",
        };

        const projection = {
            _id: 0,
            portalid: 1,
            headerdisplay: 1,
        };

        // Execute the query
        const result = await db
            .collection("portal")
            .find(query)
            .project(projection)
            .toArray();
        // console.log(result);
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/top/techieindex/links", async (req, res) => {
    try {
        // Assuming you have a MongoDB connection object named 'db'
        // const db = req.db; // or however you get your MongoDB connection object
        // MongoDB query
        const query = {
            type: "TECHIE-INDEX.COM",
            headerdisplay: { $ne: "" },
            status: "ACTIVE",
        };
        const projection = {
            _id: 0,
            portalid: 1,
            headerdisplay: 1,
        };
        // Execute the query
        const result = await db
            .collection("portal")
            .find(query)
            .project(projection)
            .toArray();
        console.log(result);
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/news", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Myblock\/News\//i }, // Using regex to match the pattern
            PORTALID: 0,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/news/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Myblock\/News\//i }, // Using regex to match the pattern
            PORTALID: port, // Match PORTALID with the provided 'port'
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/news", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Techieindex\/News\//i }, // Using regex to match the pattern
            PORTALID: 0,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/news/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Techieindex\/News\//i }, // Using regex to match the pattern
            PORTALID: port, // Match PORTALID with the provided 'port'
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/articles", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Myblock\/Articles\//i }, // Using regex to match the pattern
            PORTALID: 0,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/articles/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Myblock\/Articles\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/articles", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Techieindex\/Articles\//i }, // Using regex to match the pattern
            PORTALID: 0,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/articles/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Techieindex\/Articles\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/health", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Myblock\/Health\//i }, // Using regex to match the pattern
            $or: [
                { PORTALID: 0 }, // Include documents where PORTALID is 0
                { PORTALID: "" }, // Include documents where PORTALID is an empty string
            ],
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/spotlight", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Myblock\/Spotlight\//i }, // Using regex to match the pattern
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/spotlight/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Myblock\/Spotlight\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/spotlight", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Techieindex\/Spotlight\//i }, // Using regex to match the pattern
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/spotlight/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Techieindex\/Spotlight\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/events", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Myblock\/Events\//i }, // Using regex to match the pattern
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/events/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Myblock\/Events\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/events", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Techieindex\/Events\//i }, // Using regex to match the pattern
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/events/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Techieindex\/Events\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/usercontent", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Myblock\/UserContent\//i }, // Using regex to match the pattern
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/myblock/altimage/usercontent/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Myblock\/UserContent\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/usercontent", async (req, res) => {
    try {
        const query = {
            image_url: { $regex: /\/Techieindex\/UserContent\//i }, // Using regex to match the pattern
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/techieindex/altimage/usercontent/portalid", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const query = {
            image_url: { $regex: /\/Techieindex\/UserContent\//i }, // Using regex to match the pattern
            PORTALID: port,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            image_url: 1,
        };

        const options = {
            sort: { date: -1 }, // Sorting by date in descending order
        };

        // Execute the query
        const result = await db
            .collection("homepage_image")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/articles", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const parentport = parseInt(req.body.parentport);

        const variations = ["Articles", "Whitepaper", "articles", "whitepaper"];
        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port },
                        { portalid: parentport },
                        { parentportalid: port },
                    ],
                },
                {
                    DOC_CATEGRY: { $in: variations },
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            // _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
            DOC_SDATE: 1,
        };

        const options = {
            sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
            limit: 8, // Limiting the result to 9 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/articles/more", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const parentport = parseInt(req.body.parentport);

        const page = parseInt(req.body.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const variations = ["Articles", "Whitepaper", "articles", "whitepaper"];

        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port },
                        { portalid: parentport },
                        { parentportalid: port },
                    ],
                },
                {
                    DOC_CATEGRY: { $in: variations },
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            // _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
            DOC_SDATE: 1,
        };

        const options = {
            sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, options)
            .project(projection)
            .skip(skip)
            .limit(limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/health", async (req, res) => {
    try {
        // const port = parseInt(req.body.port);
        // const parentport = parseInt(req.body.parentport);

        const variations = ["Health", "health"];

        const query = {
            $and: [
                {
                    DOC_CATEGRY: { $in: variations },
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            // _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
            DOC_SDATE: 1,
        };

        const options = {
            sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
            limit: 8, // Limiting the result to 9 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/health/more", async (req, res) => {
    try {
        // const port = parseInt(req.body.port);
        // const parentport = parseInt(req.body.parentport);

        const variations = ["Health", "health"];

        const query = {
            $and: [
                {
                    DOC_CATEGRY: { $in: variations },
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            // _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
            DOC_SDATE: 1,
        };

        const options = {
            sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
            limit: 100, // Limiting the result to 9 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, options)
            .project(projection)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/local/vendor/list", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);

        const query = {
            $and: [
                {
                    $or: [
                        { PORTAL_ID: port1 },
                        { PORTAL_ID: parentport },
                        { PORTALID_LEVEL1: port1 },
                        { PORTALID_LEVEL1: parentport },
                        { parentportalid: port1 },
                    ],
                },
                { DOC_PRICE: { $gt: 2 } },
                // ✅ Only include docs where these fields are NOT null or empty
                {
                    IMAGE: { $nin: [null, ""] },
                    VEND_CON_ADDR: { $nin: [null, ""] },
                    VEND_URL: { $nin: [null, ""] },

                },
            ],
        };

        const projection = {
            _id: 1,
            VEND_ID: 1,
            VEND_TITL: 1,
            VEND_DESC: 1,
            IMAGE: 1,
            VEND_CON_ADDR: 1,
            VEND_URL: 1,
            phone: 1,
            email: 1,
            CITY: 1,
            STATE: 1,
            COUNTRY: 1,
        };

        const options = {
            sort: { VEND_ID: -1 },
            limit: 4,
        };

        const result = await db
            .collection("kf_vendor")
            .find(query)
            .project(projection)
            .sort(options.sort)
            .limit(options.limit)
            .toArray();

        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/local/vendor/list/techieindex/all", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);
        const page = parseInt(req.body.page) || 1;
        const limit = 18;
        const skip = (page - 1) * limit;

        const query = {
            $and: [
                {
                    $or: [
                        { PORTAL_ID: port1 },
                        { PORTAL_ID: parentport },
                        { PORTALID_LEVEL1: port1 },
                        { PORTALID_LEVEL1: parentport },
                        { parentportalid: port1 },
                    ],
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
                {
                    IMAGE: { $nin: [null, ""] },
                    VEND_CON_ADDR: { $nin: [null, ""] },
                    VEND_URL: { $nin: [null, ""] },

                },
            ],
        };

        const projection = {
            _id: 1, // Exclude the _id field
            VEND_ID: 1,
            VEND_TITL: 1,
            VEND_DESC: 1,
            IMAGE: 1,
            VEND_CON_ADDR: 1,
            vend_url: 1,
            phone: 1,
            email: 1,
            CITY: 1,
            STATE: 1,
            COUNTRY: 1,
        };

        const options = {
            sort: { VEND_ID: -1 }, // Sorting by VEND_ID in descending order
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_vendor")
            .find(query)
            .project(projection)
            .sort(options.sort)
            .skip(skip)
            .limit(limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/local/vendorcategory/list", async (req, res) => {
    try {
        const query = {
            DOC_CATEGRY_ID: 122,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            CONFIG_ID: 1,
            CONFIG_DES: 1,
            CFG_PRNT_CD: 1,
            IMAGE: 1,
        };

        const options = {
            sort: { QUALITY_LEVEL: -1 }, // Sorting by CONFIG_ID in descending order
            limit: 4, // Limiting the result to 4 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_doc_config")
            .find(query, projection)
            .sort(options.sort)
            .limit(options.limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/local/vendorcategory/list/all", async (req, res) => {
    try {
        const query = {
            DOC_CATEGRY_ID: 122,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            CONFIG_ID: 1,
            CONFIG_DES: 1,
            CFG_PRNT_CD: 1,
            IMAGE: 1,
        };

        const options = {
            // sort: { QUALITY_LEVEL: -1 },// Sorting by CONFIG_ID in descending order
            sort: { CONFIG_DES: 1 }, // Sorting by CONFIG_DES in ascending order
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_doc_config")
            .find(query, projection)
            .sort(options.sort)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/local/vendor/list/all", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);
        const vendCat = req.body.vend_cat;

        const query = {
            $and: [
                {
                    $or: [
                        { PORTAL_ID: port1 },
                        { PORTAL_ID: parentport },
                        { PORTALID_LEVEL1: port1 },
                        { PORTALID_LEVEL1: parentport },
                        { parentportalid: port1 },
                    ],
                },
                {
                    VEND_CATEGRY: vendCat,
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            _id: 0, // Exclude the _id field
            VEND_ID: 1,
            VEND_TITL: 1,
            VEND_DESC: 1,
            IMAGE: 1,
            VEND_CON_ADDR: 1,
            vend_url: 1,
            phone: 1,
            email: 1,
            CITY: 1,
            STATE: 1,
            COUNTRY: 1,
        };

        const options = {
            sort: { VEND_ID: -1 }, // Sorting by VEND_ID in descending order
            limit: 100, // Limiting the result to 100 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_vendor")
            .find(query)
            .project(projection)
            .sort(options.sort)
            .limit(options.limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/interview", async (req, res) => {
    try {
        const id = parseInt(req.body.id);
        const parentport = parseInt(req.body.parentport);

        const query = {
            $and: [
                {
                    $or: [
                        { portalid: id },
                        { portalid: parentport },
                        { parentportalid: id },
                    ],
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            _id: 0, // Exclude the _id field
            intrvw_id: 1,
            interviewPerson: 1,
            aboutPerson: 1,
            photo: 1,
        };

        const options = {
            sort: { intrvw_id: -1 }, // Sorting by intrvw_id in descending order
            limit: 4, // Limiting the result to 5 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("interview")
            .find(query)
            .project(projection)
            .sort(options.sort)
            .limit(options.limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/interview/more", async (req, res) => {
    try {
        const id = parseInt(req.body.id);
        const parentport = parseInt(req.body.parentport);

        const query = {
            $and: [
                {
                    $or: [
                        { portalid: id },
                        { portalid: parentport },
                        { parentportalid: id },
                    ],
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            _id: 0, // Exclude the _id field
            intrvw_id: 1,
            interviewPerson: 1,
            aboutPerson: 1,
            photo: 1,
        };

        const options = {
            sort: { intrvw_id: -1 }, // Sorting by intrvw_id in descending order
            // Limiting the result to 5 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("interview")
            .find(query)
            .project(projection)
            .sort(options.sort)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/spotlight/companies/name", async (req, res) => {
    try {
        const id = parseInt(req.body.id);

        const query = {
            intrvw_id: id,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            interviewPerson: 1,
            aboutPerson: 1,
            photo: 1,
            REFYX_URL: 1,
            designation: 1,
        };

        // Execute the query
        const result = await db
            .collection("interview")
            .find(query, { projection: projection })
            .toArray();
        console.log("result", result);
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

// app.post('/news/headlines/Spotlight', async (req, res) => {
//     try {

//         const port3 = parseInt(req.body.port3);
//         const parentport = parseInt(req.body.parentport);

//         const variations = ['Spotlights', 'spotlights'];
//         const query = {
//             $or: [
//                 { portalid: port3 },
//                 { portalid: parentport },
//                 { parentportalid: port3 }
//             ],
//             DOC_CATEGRY: { $in: variations }
//         };

//         const projection = {
//             _id: 0, // Exclude the _id field
//             DOC_ID: 1,
//             DOC_TITL: 1,
//             DOC_DESC: 1,
//             DOC_DET: 1,
//             DOC_CATEGRY: 1,
//             DOC_PUBDATE: 1,
//             DOC_SUBCATEGRY: 1,
//             DOC_URL: 1,
//             image: 1
//         };

//         const options = {
//             sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
//             limit: 4 // Limiting the result to 4 documents
//         };

//         // Execute the query with sorting and limiting
//         const result = await db.collection('kf_docmnt').find(query, { projection: projection }).sort(options.sort).limit(options.limit).toArray();
//         res.send(result);
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

// app.post('/news/headlines/Spotlight/All', async (req, res) => {
//     try {

//         const port3 = parseInt(req.body.port3);
//         const parentport = parseInt(req.body.parentport);

//         const variations = ['Spotlights', 'spotlights'];
//         const query = {
//             $or: [
//                 { portalid: port3 },
//                 { portalid: parentport },
//                 { parentportalid: port3 }
//             ],
//             DOC_CATEGRY: { $in: variations }
//         };

//         const projection = {
//             _id: 0, // Exclude the _id field
//             DOC_ID: 1,
//             DOC_TITL: 1,
//             DOC_DESC: 1,
//             DOC_DET: 1,
//             DOC_CATEGRY: 1,
//             DOC_PUBDATE: 1,
//             DOC_SUBCATEGRY: 1,
//             DOC_URL: 1,
//             image: 1
//         };

//         const options = {
//             sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
//             limit: 100 // Limiting the result to 4 documents
//         };

//         // Execute the query with sorting and limiting
//         const result = await db.collection('kf_docmnt').find(query, { projection: projection }).sort(options.sort).limit(options.limit).toArray();
//         res.send(result);
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

// app.post('/news/headlines/Spotlight/techieindex', async (req, res) => {
//     try {

//         const port3 = parseInt(req.body.port3);
//         const parentport = parseInt(req.body.parentport);

//         const query = {
//             $or: [
//                 { portalid: port3 },
//                 { portalid: parentport },
//                 { parentportalid: port3 }
//             ]
//         };

//         const projection = {
//             _id: 0, // Exclude the _id field
//             intrvw_id: 1,
//             companyName: 1,
//             aboutPerson: 1,
//             photo: 1
//         };

//         const options = {
//             limit: 5 // Limiting the result to 5 documents
//         };

//         // Execute the query with limiting
//         const result = await db.collection('spotlight').find(query, { projection: projection }).limit(options.limit).toArray();
//         res.send(result);
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

// app.post('/news/headlines/Spotlight/techieindex/All', async (req, res) => {
//     try {
//         const port3 = parseInt(req.body.port3);
//         const parentport = parseInt(req.body.parentport);

//         const query = {
//             $or: [
//                 { portalid: port3 },
//                 { portalid: parentport },
//                 { parentportalid: port3 }
//             ]
//         };

//         const projection = {
//             _id: 0, // Exclude the _id field
//             intrvw_id: 1,
//             companyName: 1,
//             aboutPerson: 1,
//             photo: 1
//         };

//         // Execute the query
//         const result = await db.collection('spotlight').find(query, { projection: projection }).toArray();
//         res.send(result);
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

//Rafalin spotlight for myblocks
app.post("/news/headlines/Spotlight", (req, res) => {
    // console.log(req.body.port3)

    console.log(req.body.parentport);
    //const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight where (portalid=${req.body.port3} or portalid=${req.body.parentport} or parentportalid=${req.body.port3}) limit 5`
    const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight  where TYPE='Myblock' limit 4`;
    // console.log(req)
    // console.log(QUERY);
    // console.log(res);
    connection.query(QUERY, (err, result) => {
        //   console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

//Rafalin all spotlight for myblocks
app.post("/news/headlines/Spotlight/All", (req, res) => {
    // console.log(req.body.port3)
    // const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight where (portalid=${req.body.port3} or portalid=${req.body.parentport} or parentportalid=${req.body.port3}) `
    const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight where TYPE='Myblock' `;
    // console.log(req)
    // console.log(QUERY);
    // console.log(res);
    connection.query(QUERY, (err, result) => {
        //   console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

//Rafalin spotlight for techieindex
app.post("/news/headlines/Spotlight/techieindex", (req, res) => {
    console.log(req.body.port3);

    console.log(req.body.parentport);
    // const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight where (portalid=${req.body.port3} or portalid=${req.body.parentport} or parentportalid=${req.body.port3}) limit 5`
    const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight  where TYPE='Techie-Index' limit 4`;
    // console.log(req)
    // console.log(QUERY);
    // console.log(res);
    connection.query(QUERY, (err, result) => {
        //   console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

//Rafalin all spotlight for techieindex
app.post("/news/headlines/Spotlight/techieindex/All", (req, res) => {
    // console.log(req.body.port3)
    // const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight where (portalid=${req.body.port3} or portalid=${req.body.parentport} or parentportalid=${req.body.port3}) `
    const QUERY = `select intrvw_id,companyName,aboutPerson,photo from spotlight where TYPE='Techie-Index' `;
    // console.log(req)
    // console.log(QUERY);
    // console.log(res);
    connection.query(QUERY, (err, result) => {
        //   console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

// app.get("/spotlight-details/:id", (req, res) => {
//     const id = req.params.id;

//     const sql = `SELECT INTERVIEW,PERSON_PHOTO,designation,companyName,interviewPerson, aboutPerson, photo, logo, quote,Founded, Revenue, url, Employees, Headquarters FROM spotlight WHERE intrvw_id=${id};`;
//     connection.query(sql, (err, results) => {
//         if (err) {
//             console.error("Error fetching details:", err);
//             res.status(500).json({ error: "Internal Server Error" });
//         } else {
//             // Log the fetched values to the console
//             console.log("Fetched values:", results);

//             // Send the fetched values as a JSON response
//             res.json(results);
//         }
//     });
// });


app.get("/spotlight-details/:id", (req, res) => {
    const id = req.params.id;

    const sql = `
SELECT
  JSON_ARRAYAGG(
    JSON_OBJECT(
      'question_number', iq.question_number,
      'question_text', iq.question_text,
      'answer_text', iq.answer_text
    )
  ) AS INTERVIEW,
  s.PERSON_PHOTO,
  s.designation,
  s.companyName,
  s.interviewPerson,
  s.aboutPerson,
  s.photo,
  s.logo,
  s.quote,
  s.Founded,
  s.Revenue,
  s.url,
  s.Employees,
  s.Headquarters
FROM spotlight s
LEFT JOIN interview_qa iq
  ON iq.interview_key = s.intrvw_id
WHERE s.intrvw_id = ?
GROUP BY s.intrvw_id;
  `;

    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error fetching details:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        console.log("Fetched values:", results);
        res.json(results);
    });
});


// Fetch topics from the intrvw_spotlight table
app.get("/spotlight-topics/:id", (req, res) => {
    const id = req.params.id;
    const sql = `SELECT intsp_dtlid, topic FROM intrvw_spotlight WHERE intrvw_id =${id};`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching topics:", err);
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            console.log("Fetched topics:", results);
            res.json(results);
        }
    });
});

// Fetch details based on the selected topic ID
app.get("/spotlight-topic-details/:id", (req, res) => {
    const topicId = req.params.id;
    const sql = `SELECT detail FROM intrvw_spotlight WHERE intsp_dtlid = ${topicId};`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching topic details:", err);
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            console.log("Fetched topic details:", results);
            res.json(results);
        }
    });
});

app.post("/interview-spotlight", (req, res) => {
    const type = req.body.type;

    // const port3 = parseInt(req.body.port3);
    // const parentport = parseInt(req.body.parentport);
    // where TYPE='${type}'

    //const sql = `SELECT * FROM spotlight  where (portalid=${req.body.port3} or portalid=${req.body.parentport} or parentportalid=${req.body.port3}) and interviewPerson!='NULL'`;
    // const sql = `SELECT * FROM spotlight   where interviewPerson!='NULL'  `;

    const sql = `SELECT *
        FROM spotlight
        WHERE interviewPerson IS NOT NULL
        AND interviewPerson <> ''
        ORDER BY intrvw_id DESC `;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching topic details:", err);
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            console.log("Fetched topic details:", results);
            res.json(results);
        }
    });
});

app.post("/news/headlines/events", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);

        const variations = ["Events", "events"];
        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port1 },
                        { portalid: parentport },
                        { parentportalid: port1 },
                    ],
                },
                {
                    DOC_CATEGRY: { $in: variations },
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
        };

        const options = {
            sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
            limit: 5, // Limiting the result to 4 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .sort(options.sort)
            .limit(options.limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/events/all", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);

        const variations = ["Events", "events"];
        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port1 },
                        { portalid: parentport },
                        { parentportalid: port1 },
                    ],
                },
                {
                    DOC_CATEGRY: { $in: variations },
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const projection = {
            _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
        };

        const options = {
            sort: { DOC_ID: -1 }, // Sorting by DOC_ID in descending order
            limit: 100, // Limiting the result to 4 documents
        };

        // Execute the query with sorting and limiting
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .sort(options.sort)
            .limit(options.limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/citylocal/news/eventdesc", async (req, res) => {
    try {
        const docId = parseInt(req.body.id);

        const query = {
            DOC_ID: docId,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
        };

        // Execute the query
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/citylocal/vendor/vendordesc", async (req, res) => {
    try {
        // const vendId = parseInt(req.body.id);

        // const query = {
        //     VEND_ID: vendId,
        // };
        const id = req.body.id;

        const query = {
            _id: new ObjectId(id),
        };

        const projection = {
            _id: 0, // Exclude the _id field
            VEND_ID: 1,
            VEND_TITL: 1,
            VEND_DESC: 1,
            VEND_DET: 1,
            VEND_URL: 1,
            IMAGE: 1,
            VEND_CON_ADDR: 1,
            vend_url: 1,
            CITY: 1,
            STATE: 1,
            COUNTRY: 1,
        };

        // Execute the query
        const result = await db
            .collection("kf_vendor")
            .find(query, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/Spotlight/details", async (req, res) => {
    try {
        const docId = parseInt(req.body.id);

        const query = {
            DOC_ID: docId,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
        };

        // Execute the query
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/Spotlight/techieindex/details", async (req, res) => {
    try {
        const intrvwId = parseInt(req.body.id);

        const query = {
            intrvw_id: intrvwId,
        };

        const projection = {
            _id: 0, // Exclude the _id field
            intrvw_id: 1,
            companyName: 1,
            aboutPerson: 1,
            photo: 1,
        };

        // Execute the query
        const result = await db
            .collection("spotlight")
            .find(query, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/usercontent", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);
        console.log("port1", port1);

        const query = {
            $or: [
                { portalid: port1 },
                { portalid: parentport },
                { parentportalid: port1 },
            ],
            DOC_CATEGRY: "USER_GENERATED",
            DOC_PRICE: { $gt: 2 },
        };

        const projection = {
            // _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
            DOC_SDATE: 1,
        };

        const sort = {
            DOC_PRICE: -1,
            DOC_ID: -1, // Sort by DOC_ID in descending order
        };

        const limit = 4; // Limit the result to 4 documents

        // Execute the query
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .sort(sort)
            .limit(limit)
            .toArray();
        console.log("result", result);

        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/news/headlines/usercontent/all", async (req, res) => {
    try {
        const port1 = parseInt(req.body.port1);
        const parentport = parseInt(req.body.parentport);

        const query = {
            $or: [
                { portalid: port1 },
                { portalid: parentport },
                { parentportalid: port1 },
            ],
            DOC_CATEGRY: "USER_GENERATED",
            DOC_PRICE: { $gt: 2 },
        };

        const projection = {
            // _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
            DOC_SDATE: 1,
        };

        const sort = {
            DOC_PRICE: -1,
            DOC_ID: -1, // Sort by DOC_ID in descending order
        };

        const limit = 100; // Limit the result to 4 documents

        // Execute the query
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .sort(sort)
            .limit(limit)
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/citylocal/news/usercontentdesc", async (req, res) => {
    try {
        const id = req.body.id;

        const query = {
            _id: new ObjectId(id),
        };

        const projection = {
            _id: 0, // Exclude the _id field
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_DESC: 1,
            DOC_DET: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_SUBCATEGRY: 1,
            DOC_URL: 1,
            image: 1,
        };

        // Execute the query
        const result = await db
            .collection("kf_docmnt")
            .find(query, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

// app.post("/pincode", async (req, res) => {
//     try {
//         const { pin, searchcity } = req.body;

//         const matchCondition = pin
//             ? { zipcode: parseInt(pin) }
//             : { portalname: { $regex: searchcity, $options: "i" } }; // Case-insensitive match for city

//         const pipeline = [
//             {
//                 $match: matchCondition,
//             },
//             {
//                 $lookup: {
//                     from: "portal",
//                     localField: "parentportalid",
//                     foreignField: "portalid",
//                     as: "parentPortal",
//                 },
//             },
//             {
//                 $unwind: "$parentPortal",
//             },
//             {
//                 $lookup: {
//                     from: "portal",
//                     localField: "parentPortal.parentportalid",
//                     foreignField: "portalid",
//                     as: "statePortal",
//                 },
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     id: 1,
//                     portalname: 1,
//                     portalid: 1,
//                     parentportalid: 1,
//                     parentport: "$parentPortal.portalname",
//                     type: 1,
//                     state: "$statePortal.portalname",
//                 },
//             },
//         ];

//         // Execute the aggregation pipeline
//         const result = await db
//             .collection("portal")
//             .aggregate(pipeline)
//             .toArray();
//         res.send(result);
//     } catch (err) {
//         console.error("Error:", err);
//         res.status(500).json({
//             message: "An error occurred while processing your request.",
//         });
//     }
// });

// app.post('/pincode', async (req, res) => {
//     try {
//         const pincode = parseInt(req.body.pin);

//         const pipeline = [
//             {
//                 $match: {
//                     zipcode: pincode
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "portal",
//                     localField: "parentportalid",
//                     foreignField: "portalid",
//                     as: "parentPortal"
//                 }
//             },
//             {
//                 $unwind: "$parentPortal"
//             },
//             {
//                 $lookup: {
//                     from: "portal",
//                     localField: "parentPortal.parentportalid",
//                     foreignField: "portalid",
//                     as: "statePortal"
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     id: 1,
//                     portalname: 1,
//                     portalid: 1,
//                     parentportalid: 1,
//                     parentport: "$parentPortal.portalname",
//                     type: 1,
//                     state: "$statePortal.portalname"
//                 }
//             }
//         ];

//         // Execute the aggregation pipeline
//         const result = await db.collection('portal').aggregate(pipeline).toArray();
//         res.send(result);
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

app.post("/Extra", async (req, res) => {
    try {
        const QUERY = {
            TYPE: "EXTRA",
        };

        const projection = {
            _id: 0,
            PORTALID: 1,
            PARENT_PORTALID: 1,
            TITLE: 1,
            URL: 1,
        };

        // Execute the query
        const result = await db
            .collection("extra")
            .find(QUERY, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/About", async (req, res) => {
    try {
        const QUERY = {
            TYPE: "ABOUT",
        };

        const projection = {
            _id: 0,
            PORTALID: 1,
            PARENT_PORTALID: 1,
            TITLE: 1,
            URL: 1,
        };

        // Execute the query
        const result = await db
            .collection("extra")
            .find(QUERY, { projection: projection })
            .toArray();
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/login/details", async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("test", req.body);

        const projection = {
            _id: 0,
            HOME_PORTALID: 1,
            USER_ID: 1,
            USERNAME: 1,
            FIRM_ID: 1,
            ROLE_ID: 1,
            NAME: 1,
        };

        // Find a user with the provided username and password
        const user = await db
            .collection("vendor_user")
            .find(
                { USERNAME: username, PASSWORD: password },
                { projection: projection }
            )
            .toArray();

        if (user && user.length > 0) {
            const userData = user[0];
            const token = jwt.sign(
                {
                    userid: userData.USER_ID,
                    username: userData.USERNAME,
                    role: "user",
                },
                JWT_SECRET,
                { expiresIn: "24h" }
            );
            res.json({ user: user, token: token });
        } else {
            // User not found, send an error response or empty array as per original logic
            res.send(user); // Send original result (empty array if not found)
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

// app.post('/signup/details', async (req, res) => {
//     try {
//         // Retrieve the values from the request body
//         const { name, id, key, town, dist, state, portalid, phone, email, lat, long } = req.body;

//         // Find the maximum USER_ID value in the collection
//         //const maxUserIdDoc = await db.collection('vendor_user').findOne({}, { sort: { USER_ID: -1 } });

//         const maxUserIdAggregate = await db.collection('vendor_user').aggregate([
//             {
//                 $group: {
//                     _id: null,
//                     maxUserId: { $max: '$USER_ID' }
//                 }
//             }
//         ]).toArray();

//         // Calculate the new USER_ID by incrementing the maximum value by one
//         const maxUserId = maxUserIdAggregate[0] ? maxUserIdAggregate[0].maxUserId : 0;
//         const newUserId = maxUserId + 1;

//         console.log("maxUserIdAggregate[0].maxUserId", maxUserIdAggregate[0].maxUserId)

//         console.log("maxUserIdAggregate", maxUserIdAggregate)

//         // Create a new user document
//         const newUser = {
//             NAME: name,
//             USERNAME: id,
//             USER_ID: newUserId,
//             FIRM_ID: 101,
//             PASSWORD: key,
//             HOME_PORTALID: portalid,
//             OTHER_PORTALID: null,
//             STATE: state,
//             DISTRICT: dist,
//             TOWN: town,
//             ROLE_ID: 1,
//             BARD_KEY: null,
//             PHONE: phone,
//             EMAIL: email,
//             LATITUDE: lat,
//             LONGITUDE: long,
//             CAMPAIGN_ID: 3

//         };

//         const user = await db.collection('vendor_user').findOne({ EMAIL: email });

//         if (user) {
//             // User found, send found response
//             return res.status(403).json({ message: 'Email already exists', user: existingEmailUser });
//         } else {

//             const user = await db.collection('vendor_user').findOne({ USERNAME: id });

//             if (user) {
//                 return res.status(403).json({ message: 'Username already exists', user: existingUsernameUser });
//             }
//             else {

//                 // User not found, send not found response
//                 await db.collection('vendor_user').insertOne(newUser);

//                 res.send('Data added successfully');

//             }

//         }
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

app.post("/signup/details", async (req, res) => {
    try {
        const {
            name,
            id,
            key,
            town,
            dist,
            state,
            portalid,
            phone,
            email,
            lat,
            long,
        } = req.body;

        // Check if the email already exists
        const existingEmailUser = await db
            .collection("vendor_user")
            .findOne({ EMAIL: email });
        if (existingEmailUser) {
            return res.status(403).json({
                message: "Email already exists",
                user: existingEmailUser,
            });
        }

        // Check if the username already exists
        const existingUsernameUser = await db
            .collection("vendor_user")
            .findOne({ USERNAME: id });
        if (existingUsernameUser) {
            return res.status(403).json({
                message: "Username already exists",
                user: existingUsernameUser,
            });
        }

        // Generate a new USER_ID (Note: This method can lead to duplicate USER_IDs in high-volume environments)
        const maxUserIdAggregate = await db
            .collection("vendor_user")
            .aggregate([
                { $group: { _id: null, maxUserId: { $max: "$USER_ID" } } },
            ])
            .toArray();
        const newUserId = maxUserIdAggregate[0]
            ? maxUserIdAggregate[0].maxUserId + 1
            : 1;

        // Create a new user document
        const newUser = {
            NAME: name,
            USERNAME: id,
            USER_ID: newUserId,
            FIRM_ID: 101,
            PASSWORD: key,
            HOME_PORTALID: portalid,
            OTHER_PORTALID: null,
            STATE: state,
            DISTRICT: dist,
            TOWN: town,
            ROLE_ID: 1,
            BARD_KEY: null,
            PHONE: phone,
            EMAIL: email,
            LATITUDE: lat,
            LONGITUDE: long,
            CAMPAIGN_ID: 3,
        };

        // Insert the new user
        await db.collection("vendor_user").insertOne(newUser);
        res.status(201).json({ message: "Data added successfully", newUser });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/submit-form", async (req, res) => {
    const { name, age, gender, hospitalName, phone, patientId, MyblocksId } =
        req.body;

    // Construct the URL with the patientId
    let updatedUrl = `http://61.2.142.91:8082/camp_test/quick.php?id=${patientId}`;

    console.log("Received data from the frontend:");
    console.log("Name:", name);
    console.log("Age:", age);
    console.log("Gender:", gender);
    console.log("Hospital Name:", hospitalName);
    console.log("phone:", phone);
    console.log("Patient ID:", patientId);
    console.log("Myblocks ID:", MyblocksId);
    console.log("Updated URL:", updatedUrl);

    // Perform validation here if needed

    // Define a document to insert into the MongoDB collection
    const document = {
        Name: name,
        Age: parseInt(age, 10),
        Gender: gender,
        Hos_name: hospitalName,
        phone: parseInt(phone, 10),
        patientId: parseInt(patientId, 10),
        MyblocksId: parseInt(MyblocksId, 10),
        Url: updatedUrl,
    };

    try {
        // Perform the update
        const result = await db.collection("doc_patient").insertOne(document);

        console.log("result", result);

        res.status(200).json({ message: "Data Added successfully", result });
    } catch (error) {
        console.error("Error updating data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/api/fetch-link", async (req, res) => {
    try {
        //const MyblockId = req.query.userId;
        let MyblockId = req.query.userId;
        MyblockId = parseInt(MyblockId, 10);
        console.log("Received User ID:", MyblockId); // Log the received user ID

        // Define the MongoDB query to find the document where `MyblocksId` matches MyblockId
        const query = { MyblocksId: MyblockId };

        // Use the `findOne` method to retrieve the first document that matches the query
        const document = await db.collection("doc_patient").findOne(query);

        console.log("document", document);

        if (!document) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        // Check if the Url field is null
        const link = document.Url;
        if (link === null) {
            res.status(400).json({
                error: "The Url field for this user is null",
            });
            return;
        }

        // Successfully fetched the URL
        console.log("Successfully fetched URL:", link); // Log the fetched URL
        res.json({ link });
    } catch (error) {
        console.error("Error fetching link:", error);
        res.status(500).json({
            error: "An error occurred while fetching the link.",
        });
    }
});

// Example route that handles file upload
app.post("/upload", upload.single("image"), (req, res) => {
    // Access the uploaded file information via req.file
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    // Access the file path
    const filePath = req.file.path;
});

app.get("/kfimage", async (req, res) => {
    try {
        // Define the query using the MongoDB driver for Node.js
        const query = {
            DOC_CATEGRY_ID: 144,
        };

        // Use the `find` method to retrieve documents that match the query
        const options = {
            projection: {
                CONFIG_DES: 1,
            },
        };

        const documents = await db
            .collection("kf_doc_config")
            .find(query, options)
            .toArray();

        if (documents.length > 0) {
            // Respond with the found documents
            res.json(documents);
        } else {
            // Handle the case where no documents were found
            res.status(404).json({ error: "No documents found" });
        }
    } catch (error) {
        // Handle any errors that occur during the query or response handling
        console.error(error);
        res.status(500).json({ error: "Failed to fetch select box options" });
    }
});
//image uploading
// Handle POST request to /upload
// server.js
// Endpoint for inserting data

app.post("/kfupload", upload.single("image"), async (req, res) => {
    try {
        const imageFilePath = req.file.path;

        const imagePathNew = imageFilePath.replace(/\\/g, "/");
        const imagePathNew1 = imagePathNew.replace(
            "/var/www/rafalin/mongo_react",
            ""
        );
        const imagePathWithPrefix = `..${imagePathNew1}`;

        console.log("path", imagePathWithPrefix);

        const DOC_CATEGRY = req.body.DOC_CATEGRY;
        let {
            userid,
            DOC_TITL,
            DOC_DESC,
            DOC_URL,
            DOC_SDATE,
            portalid,
            vendorId, // Make sure this matches the key in req.body
        } = req.body;

        console.log("Received Form Data:", req.body); // Logging received form data

        const parsedPortalId = parseInt(portalid, 10);

        const maxDocIdResult = await db
            .collection("kf_docmnt")
            .find({}, { DOC_ID: 1 })
            .sort({ DOC_ID: -1 })
            .limit(1)
            .toArray();
        const maxDocId =
            maxDocIdResult.length > 0 ? maxDocIdResult[0].DOC_ID : 0;

        // Increment the max DOC_ID by 1
        const newDocId = maxDocId + 1;

        // Create a document (object) with the data to be inserted into MongoDB
        const document = {
            MEMBER_ID: userid,
            DOC_ID: newDocId,
            DOC_VEND_ID: vendorId,
            DOC_TITL,
            DOC_DESC,
            DOC_URL,
            DOC_CATEGRY,
            DOC_SDATE,
            DOC_PRICE: 5,
            portalid: parsedPortalId,
            image: imagePathWithPrefix,
            DOC_STATUS: 1,
        };

        // Insert the document into the 'kf_docmnt' collection
        const result = await db.collection("kf_docmnt").insertOne(document);

        console.log("result", result);
        console.log("result.insertedCount", result.insertedCount);

        if (result.insertedId) {
            console.log("Data inserted successfully");
            res.status(200).json({
                message: "Data inserted successfully",
                result,
            });
        } else {
            console.error("Error inserting data into the database");
            res.status(500).json({
                error: "Error inserting data into the database",
            });
        }
    } catch (error) {
        console.error("Error inserting data into the database:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/doc", async (req, res) => {
    try {
        const vendorId = req.query.vendorId; // Get the vendorId from the query parameter

        if (!vendorId) {
            return res
                .status(400)
                .json({ error: "vendorId is required in the query parameter" });
        }

        console.log("Received vendorId:", vendorId); // Add this console log

        // Define the MongoDB query using the MongoDB driver for Node.js
        const query = {
            DOC_VEND_ID: vendorId,
            DOC_STATUS: 1,
        };

        // Use the `find` method to retrieve documents that match the query
        const documents = await db
            .collection("kf_docmnt")
            .find(query)
            .toArray();

        // Check if any documents were found
        if (documents.length > 0) {
            res.json(documents);
        } else {
            // Handle the case where no documents were found
            res.status(404).json({
                error: "No documents found for the provided vendorId",
            });
        }
    } catch (error) {
        // Handle any errors that may occur during the query execution or response handling
        console.error("Error fetching data from the database:", error);
        res.status(500).json({
            error: "Failed to fetch data from the database",
        });
    }
});

// // Addkfdocmnt.js
// const fetchkfdocmntData = async () => {
//   try {
//     const response = await axios.get('/doc');
//     setData(response.data);
//   } catch (error) {
//     console.log(error);
//   }
// };
// Endpoint for deleting data
app.delete("/kfdelete/:ID", async (req, res) => {
    try {
        const ID = req.params.ID;
        console.log("Received DOC_VEND_ID:", ID);

        // Define the MongoDB query to find the document to update
        const query = { _id: new ObjectId(ID) };

        // Define the update operation using $set to update the DOC_STATUS field to 0
        const updateOperation = {
            $set: { DOC_STATUS: 0 },
        };

        // Use the `updateOne` method to update the document in the 'kf_docmnt' collection
        const result = await db
            .collection("kf_docmnt")
            .updateOne(query, updateOperation);

        console.log("result", result);

        if (result.modifiedCount === 1) {
            // The document was updated successfully
            res.status(200).json({ message: "Data updated successfully" });
        } else if (result.matchedCount === 0) {
            // No document was found to update
            res.status(404).json({ message: "Data not found" });
        } else {
            // Some other error occurred
            res.status(500).json({ message: "Error updating data" });
        }
    } catch (error) {
        // Handle any errors that may occur during the update operation or response handling
        console.error("Error updating data:", error);
        res.status(500).json({ message: "Error updating data" });
    }
});

// Endpoint for updating data
app.put("/kfupload/:DOC_ID", upload.single("image"), async (req, res) => {
    try {
        const DOC_ID = req.params.DOC_ID;
        const {
            DOC_VEND_ID,
            MEMBER_ID,
            DOC_TITL,
            DOC_DESC,
            DOC_URL,
            DOC_SDATE,
            portalid,
        } = req.body;

        let imageFilePath = req.body.image; // Default to the existing image if no new image is selected

        if (req.file) {
            // New image selected, use the uploaded file
            imageFilePath = req.file.path;
        }

        // Define the MongoDB query to find the document to update
        const query = { DOC_ID: DOC_ID };

        // Define the update operation using $set to update the document fields
        const updateOperation = {
            $set: {
                DOC_VEND_ID,
                MEMBER_ID,
                DOC_TITL,
                DOC_DESC,
                DOC_URL,
                DOC_SDATE,
                portalid,
                image: imageFilePath,
            },
        };

        // Use the `updateOne` method to update the document in the 'kf_docmnt' collection
        const result = await db
            .collection("kf_docmnt")
            .updateOne(query, updateOperation);

        if (result.modifiedCount === 1) {
            // The document was updated successfully
            res.status(200).json({ message: "Data updated successfully" });
        } else if (result.matchedCount === 0) {
            // No document was found to update
            res.status(404).json({ message: "Data not found" });
        } else {
            // Some other error occurred
            res.status(500).json({ message: "Error updating data" });
        }
    } catch (error) {
        // Handle any errors that may occur during the update operation or response handling
        console.error("Error updating data:", error);
        res.status(500).json({ message: "Error updating data" });
    }
});

// kf_vendor

app.get("/Images", async (req, res) => {
    try {
        // Define the MongoDB query using the MongoDB driver for Node.js
        const query = { DOC_CATEGRY_ID: 122 };

        // Use the `find` method to retrieve documents that match the query
        const options = {
            projection: {
                CONFIG_DES: 1,
            },
        };

        const documents = await db
            .collection("kf_doc_config")
            .find(query, options)
            .toArray();

        // Respond with the found documents
        res.json(documents);
    } catch (error) {
        // Handle any errors that may occur during the query or response handling
        console.error(error);
        res.status(500).json({ error: "Failed to fetch select box options" });
    }
});

app.post("/vendupload", upload.single("image"), async (req, res) => {
    try {
        const imageFilePath = req.file.path;
        const VEND_CATEGRY = req.body.selectedOption;
        const {
            PARENTPORTALID,
            USER_ID,
            VEND_TITL,
            VEND_DESC,
            VEND_SDATE,
            phone,
            email,
            VEND_CON_ADDR,
            PORTAL_ID,
        } = req.body;

        // Create a document (object) with the data to be inserted into MongoDB
        const document = {
            VEND_ID: null, // Assuming VEND_ID is an auto-generated field, set it to null to let the database generate it.
            PARENTPORTALID,
            PORTAL_ID,
            MEMBERID: USER_ID,
            VEND_TITL,
            VEND_DESC,
            VEND_SDATE,
            phone,
            email,
            VEND_CATEGRY,
            VEND_CON_ADDR,
            IMAGE: imageFilePath,
        };

        // Insert the document into the 'kf_vendor' collection
        const result = await db.collection("kf_vendor").insertOne(document);

        if (result.insertedId) {
            console.log("Data inserted successfully");
            res.sendStatus(200);
        } else {
            console.error("Error inserting data into the database");
            res.sendStatus(500);
        }
    } catch (error) {
        console.error("Error inserting data into the database:", error);
        res.sendStatus(500);
    }
});

app.put("/vendupload/:VEND_ID", upload.single("image"), async (req, res) => {
    try {
        const VEND_ID = req.params.VEND_ID;
        const {
            PARENTPORTALID,
            PORTAL_ID,
            MEMBERID,
            VEND_TITL,
            VEND_DESC,
            VEND_SDATE,
            phone,
            email,
            VEND_CATEGRY,
            VEND_CON_ADDR,
        } = req.body;

        let imageFilePath = req.file ? req.file.path : req.body.IMAGE;

        // Define the MongoDB query to find the document to update
        const query = { VEND_ID: VEND_ID };

        // Define the update operation using $set to update the document fields
        const updateOperation = {
            $set: {
                PARENTPORTALID,
                PORTAL_ID,
                MEMBERID,
                VEND_TITL,
                VEND_DESC,
                VEND_SDATE,
                phone,
                email,
                IMAGE: imageFilePath,
                VEND_CATEGRY,
                VEND_CON_ADDR,
            },
        };

        // Use the `updateOne` method to update the document in the 'kf_vendor' collection
        const result = await db
            .collection("kf_vendor")
            .updateOne(query, updateOperation);

        if (result.modifiedCount === 1) {
            // The document was updated successfully
            res.status(200).json({ message: "Data updated successfully" });
        } else if (result.matchedCount === 0) {
            // No document was found to update
            res.status(404).json({ message: "Data not found" });
        } else {
            // Some other error occurred
            res.status(500).json({ message: "Error updating data" });
        }
    } catch (error) {
        // Handle any errors that may occur during the update operation or response handling
        console.error("Error updating data:", error);
        res.status(500).json({ message: "Error updating data" });
    }
});

app.get("/vendorImages", async (req, res) => {
    try {
        // Define the MongoDB query using the MongoDB driver for Node.js
        const query = { DOC_CATEGRY_ID: 122 };

        // Use the `find` method to retrieve documents that match the query
        const options = {
            projection: {
                CONFIG_DES: 1,
            },
        };

        const documents = await db
            .collection("kf_doc_config")
            .find(query, options)
            .toArray();

        // Respond with the found documents
        res.json(documents);
    } catch (error) {
        // Handle any errors that may occur during the query or response handling
        console.error(error);
        res.status(500).json({ error: "Failed to fetch select box options" });
    }
});

// app.post('/kfvendupload', upload.single('selectedImage'), async (req, res) => {
//     try {
//         const imageFilePath = req.file ? req.file.path : '';
//         const VEND_CATEGRY = req.body.VEND_CATEGRY; // Updated to use VEND_CATEGRY from the frontend
//         const portalid = parseInt(req.body.portalid);
//         console.log("imageFilePath", imageFilePath)

//         const imagePathNew = imageFilePath.replace(/\\/g, '/');
//         const imagePathNew1 = imagePathNew.replace('/var/www/rafalin/mongo_react', '');
//         const imagePathWithPrefix = `..${imagePathNew1}`;

//         console.log("path", imagePathWithPrefix)

//         // Define the MongoDB filter object to find the document to update
//         const filter = {
//             VEND_TITL: req.body.VEND_TITL, // Condition: VEND_TITL
//             PORTAL_ID: portalid, // Condition: portal_id
//         };

//         // Define the update operation using $set to update the document fields
//         const updateOperation = {
//             $set: {
//                 VEND_TITL: req.body.VEND_TITL,
//                 VEND_DESC: req.body.VEND_DESC,
//                 VEND_SDATE: req.body.VEND_SDATE,
//                 VEND_CATEGRY: VEND_CATEGRY,
//                 IMAGE: imagePathWithPrefix,
//             }
//         };

//         // Use the `updateOne` method to update the document in the 'kf_vendor' collection
//         const result1 = await db.collection('kf_vendor').updateOne(filter, updateOperation);
//         console.log("result", result1)

//         if (result1.modifiedCount === 1) {

//             console.log("result", result1)

//             // The document was updated successfully
//             console.log('Data updated successfully');
//             console.log('Updated Values:', {
//                 VEND_TITL: req.body.VEND_TITL,
//                 VEND_DESC: req.body.VEND_DESC,
//                 VEND_SDATE: req.body.VEND_SDATE,
//                 VEND_CATEGRY: VEND_CATEGRY,
//                 IMAGE: imagePathWithPrefix,
//                 Condition: {
//                     VEND_TITL: req.body.VEND_TITL,
//                     portal_id: portalid,
//                 },
//             });
//             res.status(200).json({ message: 'Data updated successfully' });
//         } else if (result1.matchedCount === 0) {
//             // No document was found to update
//             res.status(404).json({ message: 'Data not found' });
//         }

//         // else {
//         //     // Some other error occurred
//         //     res.status(500).json({ message: 'Error updating data' });
//         // }
//     } catch (error) {
//         // Handle any errors that may occur during the update operation or response handling
//         console.error('Error during file upload:', error);
//         res.status(500).json({ error: 'Error during file upload' });
//     }
// });

app.post("/kfvendupload", upload.single("selectedImage"), async (req, res) => {
    try {
        const VEND_TITL = req.body.VEND_TITL;
        const imageFilePath = req.file ? req.file.path : "";
        const VEND_CATEGRY = req.body.VEND_CATEGRY;
        const email = req.body.email;
        const phone = req.body.phone;
        const portalid = parseInt(req.body.portalid);
        const VEND_SDATE = new Date(req.body.VEND_SDATE);

        console.log("Received values from the frontend:");
        console.log("VEND_TITL:", VEND_TITL);
        console.log("VEND_CATEGRY:", VEND_CATEGRY);
        console.log("email:", email);
        console.log("phone:", phone);
        console.log("portalid:", portalid);

        const imagePathNew = imageFilePath.replace(/\\/g, "/");
        const imagePathNew1 = imagePathNew.replace(
            "/var/www/rafalin/mongo_react",
            ""
        );
        const imagePathWithPrefix = `..${imagePathNew1}`;

        console.log("path", imagePathWithPrefix);

        const maxVendIdResult = await db
            .collection("kf_vendor")
            .find({}, { VEND_ID: 1 })
            .sort({ VEND_ID: -1 })
            .limit(1)
            .toArray();
        const maxVendId =
            maxVendIdResult.length > 0 ? maxVendIdResult[0].VEND_ID : 0;

        // Increment the max DOC_ID by 1
        const newVendId = maxVendId + 1;

        // Define the new document to insert into the 'kf_vendor' collection
        const documentToInsert = {
            VEND_ID: newVendId,
            VEND_TITL: VEND_TITL,
            VEND_DESC: req.body.VEND_DESC,
            VEND_SDATE: VEND_SDATE,
            VEND_CATEGRY: VEND_CATEGRY,
            phone: phone,
            email: email,
            IMAGE: imagePathWithPrefix,
            PORTAL_ID: portalid,
        };

        // Use the `insertOne` method to insert the new document into the 'kf_vendor' collection
        const result = await db
            .collection("kf_vendor")
            .insertOne(documentToInsert);
        console.log("result", result);

        if (result.insertedId) {
            // The document was inserted successfully
            console.log("Data inserted successfully");
            res.status(200).json({ message: "Data inserted successfully" });
        } else {
            // Some other error occurred during insertion
            res.status(500).json({ message: "Error inserting data" });
        }
    } catch (error) {
        // Handle any errors that may occur during the insert operation or response handling
        console.error("Error during file upload:", error);
        res.status(500).json({ error: "Error during file upload" });
    }
});

app.get("/vend/:portalid", async (req, res) => {
    try {
        const portalid = req.params.portalid;
        console.log("Received portalid from frontend:", portalid); // Log the received portalid

        // Define the MongoDB query using the MongoDB driver for Node.js
        const query = {
            portal_id: portalid,
            VEND_STATUS: 1, // Added the condition for VEND_STATUS
        };

        // Use the `find` method to retrieve documents that match the query
        const documents = await db
            .collection("kf_vendor")
            .find(query)
            .toArray();

        if (documents.length === 0) {
            res.status(404).json({ message: "Vendor not found" });
        } else {
            console.log("Result of query:", documents);
            res.json(documents);
        }
    } catch (error) {
        // Handle any errors that may occur during the query or response handling
        console.error("Error fetching data from the database:", error);
        res.sendStatus(500);
    }
});

app.delete("/vendor-delete/:VEND_ID", async (req, res) => {
    try {
        const VEND_ID = parseInt(req.params.VEND_ID);

        // Define the MongoDB filter object to find the document to update
        const filter = { VEND_ID: VEND_ID };

        // Define the update operation using $set to update the `VEND_STATUS` field to 0
        const updateOperation = {
            $set: {
                VEND_STATUS: 0,
            },
        };

        // Use the `updateOne` method to update the document in the 'kf_vendor' collection
        const result = await db
            .collection("kf_vendor")
            .updateOne(filter, updateOperation);

        console.log(result);

        if (result.modifiedCount === 1) {
            // The document was updated successfully
            res.status(200).json({ message: "Data updated successfully" });
        } else if (result.matchedCount === 0) {
            // No document was found to update
            res.status(404).json({ message: "Data not found" });
        } else {
            // Some other error occurred
            res.status(500).json({ message: "Error updating data" });
        }
    } catch (error) {
        // Handle any errors that may occur during the update operation or response handling
        console.error("Error updating data:", error);
        res.status(500).json({ message: "Error updating data" });
    }
});

app.post("/fetch-vendor-shop", async (req, res) => {
    try {
        const { shopName } = req.body;

        // Check if shopName is missing or empty
        if (!shopName) {
            console.error("shopName is missing or empty"); // Log the error
            return res
                .status(400)
                .json({ error: "shopName is missing or empty" }); // Return a 400 Bad Request response
        }

        console.log("Received shopName from frontend:", shopName);

        // Define the MongoDB query to find the document where `VEND_TITL` matches shopName
        const query = {
            VEND_TITL: shopName,
            VEND_STATUS: 1,
        };

        // Use the `findOne` method to retrieve the first document that matches the query
        const document = await db.collection("kf_vendor").findOne(query);

        if (!document) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        // Send the found document as a JSON response
        res.status(200).json(document);
    } catch (error) {
        // Handle any errors that may occur during the query or response handling
        console.error("Error fetching data from the database:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/full_survey", (req, res) => {
    const {
        SURVRID,
        FIRST_NAME,
        LAST_NAME,
        HOUSENAME,
        AGE,
        PINCODE,
        RESOURCE_ACC_WATER,
        RESOURCE_ACC_AIR,
        RESOURCE_ACC_FUND,
        RESOURCE_ACC_EDUCATION,
        RESOURCE_ACC_HEALTH,
        ANUAL_INCOME,
        STRESS_MEASUREMENT,
        QST1,
        QST2,
        QST3,
        QST4,
        QST5,
        QST6,
        QST7,
        QST8,
        QST9,
        QST10,
        JOBSTATUS,
        breakfastString,
        lunchString,
        snacksString,
        dinnerString,
        ALCOHOL,
        TOBACCO,
        SMOKING,
        ACTIVITY,
        OUTODOC,
        DIABETES,
        HYPERTENSION,
        CHOLESTROL,
        HIST_CANCER,
        HIST_DIABETES,
        HIST_BP,
        HIST_CHOLESTROL,
        HEART,
        SKIN_ALLERGIES,
        HEAD_ACHE,
        COUGH,
        EAR_PAIN,
        RELATIVE_NAME,
        TRANSPORT,
        GOV_APPROVALS,
    } = req.body;
    const insertUserQuery = `INSERT INTO HEALTH_SURVEY (Surveyor_id,Fname, Lname, Family_name, DOB, PIN, Water_resrs, Clean_air, Funds, Proper_edu, Health_resus,
              Anual_income, Resce_of_watr, Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, Q9, Q10, Job_status, Break_fast, Lunch, Snacks, Dinner, Alcohol,
              Tobacco, Smoking, Activity,Cup_auto_doc, Diabetes1, Hypertension, Cholestrol, Cancer, Diabetes2, BP, Cholestrol1, Heart, Rel_persion,
              Ear_pain, Cough, Head_ache, Skin_allergies, Pub_priv_trport, Govt_approvel) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    console.log("req.body", req.body);
    //const heart =null;
    connection.query(
        insertUserQuery,
        [
            SURVRID,
            FIRST_NAME,
            LAST_NAME,
            HOUSENAME,
            AGE,
            PINCODE,
            RESOURCE_ACC_WATER,
            RESOURCE_ACC_AIR,
            RESOURCE_ACC_FUND,
            RESOURCE_ACC_EDUCATION,
            RESOURCE_ACC_HEALTH,
            ANUAL_INCOME,
            STRESS_MEASUREMENT,
            QST1,
            QST2,
            QST3,
            QST4,
            QST5,
            QST6,
            QST7,
            QST8,
            QST9,
            QST10,
            JOBSTATUS,
            breakfastString,
            lunchString,
            snacksString,
            dinnerString,
            ALCOHOL,
            TOBACCO,
            SMOKING,
            ACTIVITY,
            OUTODOC,
            DIABETES,
            HYPERTENSION,
            CHOLESTROL,
            HIST_CANCER,
            HIST_DIABETES,
            HIST_BP,
            HIST_CHOLESTROL,
            HEART,
            RELATIVE_NAME,
            EAR_PAIN,
            COUGH,
            HEAD_ACHE,
            SKIN_ALLERGIES,
            TRANSPORT,
            GOV_APPROVALS,
        ],
        (err, result) => {
            if (err) {
                console.error("Error inserting data into the database:", err);
                return res.sendStatus(500);
            }
            console.log("Data inserted successfully");
            return res.status(200).json({ message: "Registration successful" });
        }
    );
});

app.post("/addleadersdata", upload.single("image"), async (req, res) => {
    try {
        let {
            NAME,
            DESIGNATION,
            COMP_NAME,
            SHORT_DESC,
            portalid,
            parentportalid,
            userid,
        } = req.body;

        portalid = parseInt(portalid, 10);
        parentportalid = parseInt(parentportalid, 10);
        userid = parseInt(userid, 10);

        const imageFilePath = req.file.path;

        const imagePathNew = imageFilePath.replace(/\\/g, "/");
        const imagePathNew1 = imagePathNew.replace(
            "/var/www/rafalin/mongo_react",
            ""
        );
        const imagePathWithPrefix = `..${imagePathNew1}`;

        console.log("path", imagePathWithPrefix);

        console.log("req.body", req.body);

        // Create a document (object) with the data to be inserted into MongoDB
        const document = {
            intrvw_id: userid, // You can set this value as needed
            technologyId: 0, // You can set this value as needed
            vendorId: 0, // You can set this value as needed
            productId: 0, // You can set this value as needed
            interviewPerson: NAME,
            designation: DESIGNATION,
            companyName: COMP_NAME,
            aboutPerson: SHORT_DESC,
            photo: imagePathWithPrefix,
            name: "",
            quote: "",
            details: "",
            mainKeyWords: "",
            subKeyWords: 0,
            status: 0,
            priority: 0,
            privilege: 0,
            rating: 0,
            key1: "",
            key2: "",
            key3: "",
            key4: "",
            source: "",
            portalid: portalid,
            parentportalid: parentportalid,
        };

        // Insert the document into the 'your-collection-name' collection
        const result = await db.collection("interview").insertOne(document);

        if (result.insertedId) {
            console.log("Data inserted successfully");
            return res.status(200).json({ message: "My Infomation added" });
        } else {
            console.error("Error inserting data into the database");
            res.sendStatus(500);
        }
    } catch (error) {
        console.error("Error inserting data into the database:", error);
        res.sendStatus(500);
    }
});

app.post("/updateleadersdata", upload.single("image"), async (req, res) => {
    try {
        let {
            NAME,
            DESIGNATION,
            COMP_NAME,
            SHORT_DESC,
            portalid,
            parentportalid,
            userid,
        } = req.body;

        portalid = parseInt(portalid, 10);
        parentportalid = parseInt(parentportalid, 10);
        userid = parseInt(userid, 10);
        let updateOperation;

        if (req.file) {
            const imageFilePath = req.file.path;

            const imagePathNew = imageFilePath.replace(/\\/g, "/");
            const imagePathNew1 = imagePathNew.replace(
                "/var/www/rafalin/mongo_react",
                ""
            );
            let imagePathWithPrefix = `..${imagePathNew1}`;

            console.log("path", imagePathWithPrefix);

            updateOperation = {
                $set: {
                    interviewPerson: NAME,
                    designation: DESIGNATION,
                    companyName: COMP_NAME,
                    aboutPerson: SHORT_DESC,
                    photo: imagePathWithPrefix,
                },
            };
        } else {
            updateOperation = {
                $set: {
                    interviewPerson: NAME,
                    designation: DESIGNATION,
                    companyName: COMP_NAME,
                    aboutPerson: SHORT_DESC,
                },
            };
        }
        console.log("req.body", req.body);

        const filter = { intrvw_id: userid };

        const result = await db
            .collection("interview")
            .updateOne(filter, updateOperation);

        console.log(result);

        if (result.modifiedCount === 1) {
            // The document was updated successfully
            res.status(200).json({ message: "Data updated successfully" });
        } else if (result.matchedCount === 0) {
            // No document was found to update
            res.status(404).json({ message: "Data not found" });
        } else {
            // Some other error occurred
            res.status(500).json({ message: "Error updating data" });
        }
    } catch (error) {
        console.error("Error inserting data into the database:", error);
        res.sendStatus(500);
    }
});

app.get("/api/getTopics/:usertype/:firmid", (req, res) => {
    const usertype = req.params.usertype;
    const firmid = req.params.firmid;

    console.log("");

    const selectTopicsQuery = `SELECT QM_ID, TOPIC FROM TEST_QM where USER_TYPE='${usertype}' && VENDOR_ID='${firmid}'`;

    connection_trn.query(selectTopicsQuery, (err, results) => {
        if (err) {
            console.error("Error fetching data from the database:", err);
            return res.status(500).json({ error: "Error fetching data" });
        }

        const topics = results;

        return res.json(topics);
    });
});

app.get("/api/main-heads", (req, res) => {
    const query = "SELECT DISTINCT MAIN_HEAD FROM TEST_QM";

    connection_trn.query(query, (err, results) => {
        if (err) {
            console.error(
                "Error fetching distinct MAIN_HEAD from the database:",
                err
            );
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json(results);
    });
});

app.post("/api/getquestions", (req, res) => {
    const id = req.body.id;
    const firmid = req.body.firmid;
    const role_id = req.body.role_id;

    console.log("id", id);
    console.log(" firmid ", firmid);

    const selectTopicsQuery = `SELECT Q_ID,QM_ID,QUESTION FROM TEST_QUESTIONS where QM_ID=${id} AND VENDOR_ID= ${firmid} AND ROLE_ID<= ${role_id}`;

    connection_trn.query(selectTopicsQuery, (err, results) => {
        if (err) {
            console.error("Error fetching data from the database:", err);
            return res.status(500).json({ error: "Error fetching data" });
        }

        const topics = results;
        console.log("results", results);
        res.status(200).json(topics);

        //return res.json(topics);
    });
});

app.post("/api/getquestions/main", (req, res) => {
    const { firmid, role_id, mainHead } = req.body;

    console.log("mainHead", mainHead);

    // Query to fetch questions based on MAIN_HEAD and VENDOR_ID
    const query = `SELECT * FROM TEST_QM WHERE MAIN_HEAD = ? AND VENDOR_ID = ?;`;

    console.log("Query:", query);
    console.log("Parameters:", [mainHead, firmid]);

    connection_trn.query(query, [mainHead, firmid], (err, results) => {
        if (err) {
            console.error("Error fetching questions:", err);
            return res.status(500).json({ error: "Database query error" });
        }
        console.log("results", results);

        // Filter questions based on the role_id
        // const filteredQuestions = results.filter(topic => topic.ROLE_ID === role_id);

        res.json(results);
    });
});

app.get("/testqm/api/media", (req, res) => {
    const { id } = req.query; // Get mainHead from query parameter

    if (!id) {
        return res.status(400).json({ error: "id parameter is required" });
    }

    // SQL query to fetch media data based on id
    const query = `SELECT TRAINING_DOC, TRAINING_VIDEO_LINK, TRAINING_AUDIO_LINK 
                   FROM TEST_QM 
                   WHERE QM_ID = ?`;

    connection_trn.query(query, [id], (err, results) => {
        if (err) {
            console.error("Error fetching data:", err);
            res.status(500).json({ error: "Internal Server Error" });
            return;
        }
        res.json(results);
    });
});

// app.post('/submit/answer', (req, res) => {
//     const { answer_summary, answer_detail, userid, topicId, questionId } = req.body;

//     console.log("req.body", req.body)

//     // Define an INSERT SQL query to add the answer to the TEST_ANSWERS table
//     const sql = `INSERT INTO TEST_ANSWERS (Q_ID, QM_ID, USER_ID,ANSWER_SUMMARY, ANSWER_DETAIL, INSRT_DTM)
//                 VALUES (?, ?, ?,?,?, NOW())`;

//     // Prepare and execute the SQL query
//     connection_trn.query(
//         sql,
//         [questionId, topicId, userid, answer_summary, answer_detail],
//         (error, results) => {
//             if (error) {
//                 console.error('Error submitting answer to the database: ' + error);
//                 res.status(500).json({ message: 'Error submitting answer' });
//             } else {
//                 console.log('Answer submitted successfully');
//                 res.status(200).json({ message: 'Answer submitted successfully' });
//             }
//         }
//     );
// });

// app.post('/submit/answer', (req, res) => {
//     console.log('Request received at /submit/answer with body:', req.body);

//     const { answer_summary, answer_detail, userid, topicId, questionId } = req.body;

//     // Check for missing required fields
//     if (!answer_summary || !answer_detail || !userid || !topicId || !questionId) {
//         console.error('Missing required fields in request body:', req.body);
//         return res.status(400).json({ error: 'Missing required fields' });
//     }

//     console.log('All required fields are present. Proceeding with database query.');

//     const insertAnswerQuery = `
//         INSERT INTO TEST_ANSWERS (Q_ID, QM_ID, USER_ID, ANSWER_SUMMARY, ANSWER_DETAIL, INSRT_DTM)
//         VALUES (?, ?, ?, ?, ?, NOW())
//     `;

//     connection_trn.query(
//         insertAnswerQuery,
//         [questionId, topicId, userid, answer_summary, answer_detail],
//         (error, results) => {
//             if (error) {
//                 console.error('Error submitting answer to the database:', error);
//                 return res.status(500).json({ message: 'Error submitting answer' });
//             }

//             console.log('Answer inserted into database successfully. Results:', results);

// 			const insertedAnswerId = results.insertId;  // Get the primary key of the inserted row

//             // Execute Python script after inserting the answer asynchronously
//             const pythonScriptPath = '/home/rafalin/python_files/testqm/process_review_prog4.py';

//             console.log('Starting Python script execution asynchronously with script path:', pythonScriptPath, 'and questionId:', questionId);

//             // Run Python script in its own time without waiting for completion
//             const { spawn } = require('child_process');
//             const pythonProcess = spawn('python3.7', [pythonScriptPath, questionId,insertedAnswerId]);

//             pythonProcess.on('error', (err) => {
//                 console.error('Error spawning Python process:', err.message);
//             });

//             pythonProcess.stdout.on('data', (data) => {
//                 console.log('Python script stdout:', data.toString());
//             });

//             pythonProcess.stderr.on('data', (data) => {
//                 console.error('Python script stderr:', data.toString());
//             });

//             console.log('Python script execution started, returning response to frontend.');
//             res.status(200).json({ message: 'Answer submitted successfully. Reviews will be processed in the background.' });
//         }
//     );
// });

// app.post('/submit/answer', (req, res) => {
//     console.log('Request received at /submit/answer with body:', req.body);

//     const { answer_summary, answer_detail, userid, topicId, questionId } = req.body;

//     // Check for missing required fields
//     if (!answer_summary || !answer_detail || !userid || !topicId || !questionId) {
//         console.error('Missing required fields in request body:', req.body);
//         return res.status(400).json({ error: 'Missing required fields' });
//     }

//     console.log('All required fields are present. Proceeding with database query.');

//     const insertAnswerQuery = `
//         INSERT INTO TEST_ANSWERS (Q_ID, QM_ID, USER_ID, ANSWER_SUMMARY, ANSWER_DETAIL, INSRT_DTM)
//         VALUES (?, ?, ?, ?, ?, NOW())
//     `;

//     connection_trn.query(
//         insertAnswerQuery,
//         [questionId, topicId, userid, answer_summary, answer_detail],
//         (error, results) => {
//             if (error) {
//                 console.error('Error submitting answer to the database:', error);
//                 return res.status(500).json({ message: 'Error submitting answer' });
//             }

//             console.log('Answer inserted into database successfully. Results:', results);

// 			const insertedAnswerId = results.insertId; // Get the primary key of the inserted row

//             // Execute Python script after inserting the answer asynchronously
//             const pythonScriptPath = '/home/rafalin/python_files/testqm/process_review_prog4.py';
//             const logFilePath = path.join('/home/rafalin/python_files/testqm', 'process_review_prog4.log');

//             console.log('Starting Python script execution asynchronously with script path:', pythonScriptPath, 'and questionId:', questionId);

//             // Create write streams for the log file
//             const logStream = fs.createWriteStream(logFilePath, { flags: 'a' }); // Append mode

//             const pythonProcess = spawn('python3.7', [pythonScriptPath, questionId, insertedAnswerId], {
//                 stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, pipe stdout and stderr
//             });

//             pythonProcess.stdout.pipe(logStream); // Pipe stdout to log file
//             pythonProcess.stderr.pipe(logStream); // Pipe stderr to log file

//             pythonProcess.on('error', (err) => {
//                 console.error('Error spawning Python process:', err.message);
//             });

//             pythonProcess.on('close', (code) => {
//                 console.log(`Python script execution completed with exit code ${code}.`);
//                 logStream.end(); // Close the log stream after the process ends
//             });

//             console.log('Python script execution started, returning response to frontend.');
//             res.status(200).json({ message: 'Answer submitted successfully. Reviews will be processed in the background.' });
//         }
//     );
// });

app.post("/proxy/submit/answer", async (req, res) => {
    console.log(
        "Proxy API received request to /proxy/submit/answer with body:",
        req.body
    );

    try {
        // Make a POST request to the external API
        const response = await axios.post(
            "http://61.2.142.91:8512/submit/answer",
            req.body,
            {
                headers: {
                    "Content-Type": "application/json", // Set appropriate headers
                },
            }
        );

        console.log("External API responded with:", response.data);

        // Forward the response back to the frontend
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error while calling the external API:", error.message);

        // Handle different error scenarios
        if (error.response) {
            // The server responded with a status code outside the 2xx range
            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            // No response received from the server
            res.status(502).json({ error: "No response from external API" });
        } else {
            // Other errors
            res.status(500).json({
                error: "Error making request to external API",
            });
        }
    }
});

// app.post('/submit/answer', (req, res) => {
//     console.log('Request received at /submit/answer with body:', req.body);

//     const { answer_summary, answer_detail, userid, topicId, questionId } = req.body;

//     // Check for missing required fields
//     if (!answer_summary ||  !userid || !topicId || !questionId) {
//         console.error('Missing required fields in request body:', req.body);
//         return res.status(400).json({ error: 'Missing required fields' });
//     }

//     console.log('All required fields are present. Proceeding with database query.');

//     const insertAnswerQuery = `
//         INSERT INTO TEST_ANSWERS (Q_ID, QM_ID, USER_ID, ANSWER_SUMMARY, ANSWER_DETAIL, INSRT_DTM)
//         VALUES (?, ?, ?, ?, ?, NOW())
//     `;

//     connection_trn.query(
//         insertAnswerQuery,
//         [questionId, topicId, userid, answer_summary, answer_detail],
//         (error, results) => {
//             if (error) {
//                 console.error('Error submitting answer to the database:', error);
//                 return res.status(500).json({ message: 'Error submitting answer' });
//             }

//             console.log('Answer inserted into database successfully. Results:', results);

//             const insertedAnswerId = results.insertId; // Get the primary key of the inserted row

//             // Execute Python script after inserting the answer asynchronously
//             const pythonScriptPath = '/home/rafalin/python_files/testqm/process_review_prog4.py';
//             const logFilePath = path.join('/home/rafalin/python_files/testqm', 'process_review_prog4.log');

//             console.log('Starting Python script execution asynchronously with script path:', pythonScriptPath, 'and questionId:', questionId);

//             // Create write streams for the log file
//             const logStream = fs.createWriteStream(logFilePath, { flags: 'a' }); // Append mode

//             const pythonProcess = spawn('python3.7', [pythonScriptPath, questionId, insertedAnswerId], {
//                 stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, pipe stdout and stderr
//             });

//             // Pipe Python script logs to both the log file and the console
//             pythonProcess.stdout.on('data', (data) => {
//                 const logMessage = data.toString().trim();
//                 console.log(`[Python Script STDOUT]: ${logMessage}`); // Log to console
//                 logStream.write(`[STDOUT]: ${logMessage}\n`); // Write to file
//             });

//             pythonProcess.stderr.on('data', (data) => {
//                 const logMessage = data.toString().trim();
//                 console.error(`[Python Script STDERR]: ${logMessage}`); // Log to console
//                 logStream.write(`[STDERR]: ${logMessage}\n`); // Write to file
//             });

//             pythonProcess.on('error', (err) => {
//                 console.error('Error spawning Python process:', err.message);
//             });

//             pythonProcess.on('close', (code) => {
//                 console.log(`Python script execution completed with exit code ${code}.`);
//                 logStream.end(); // Close the log stream after the process ends
//             });

//             console.log('Python script execution started, returning response to frontend.');
//             res.status(200).json({ message: 'Answer submitted successfully. Reviews will be processed in the background.' });
//         }
//     );
// });

app.post("/submit/answer", (req, res) => {
    console.log("Request received at /submit/answer with body:", req.body);

    const { answer_summary, answer_detail, userid, topicId, questionId } =
        req.body;

    // Check for missing required fields
    if (!answer_summary || !userid || !topicId || !questionId) {
        console.error("Missing required fields in request body:", req.body);
        return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(
        "All required fields are present. Proceeding with database query."
    );

    const insertAnswerQuery = `
        INSERT INTO TEST_ANSWERS (Q_ID, QM_ID, USER_ID, ANSWER_SUMMARY, ANSWER_DETAIL, INSRT_DTM) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;

    connection_trn.query(
        insertAnswerQuery,
        [questionId, topicId, userid, answer_summary, answer_detail],
        (error, results) => {
            if (error) {
                console.error(
                    "Error submitting answer to the database:",
                    error
                );
                return res
                    .status(500)
                    .json({ message: "Error submitting answer" });
            }

            console.log(
                "Answer inserted into database successfully. Results:",
                results
            );

            const insertedAnswerId = results.insertId; // Get the primary key of the inserted row

            // Execute Python script after inserting the answer asynchronously
            const pythonScriptPath =
                "/home/rafalin/python_files/testqm/process_review_prog4.py";
            const logFilePath = path.join(
                "/home/rafalin/python_files/testqm",
                "process_review_prog4.log"
            );

            console.log(
                "Starting Python script execution asynchronously with script path:",
                pythonScriptPath,
                "and questionId:",
                questionId
            );

            // Create write streams for the log file
            const logStream = fs.createWriteStream(logFilePath, { flags: "a" }); // Append mode

            // Spawn the Python process
            const pythonProcess = spawn(
                "python3.7",
                ["-u", pythonScriptPath, questionId, insertedAnswerId],
                {
                    stdio: ["ignore", "pipe", "pipe"], // Ignore stdin, pipe stdout and stderr
                }
            );

            // Stream stdout in real-time
            pythonProcess.stdout.setEncoding("utf8"); // Ensure proper text encoding
            pythonProcess.stdout.on("data", (data) => {
                const logMessage = data.trim(); // Trim extra whitespace
                console.log(`[Python Script STDOUT]: ${logMessage}`); // Log in real-time to console
                logStream.write(`[STDOUT]: ${logMessage}\n`); // Write to log file in real-time
            });

            // Stream stderr in real-time
            pythonProcess.stderr.setEncoding("utf8"); // Ensure proper text encoding
            pythonProcess.stderr.on("data", (data) => {
                const logMessage = data.trim(); // Trim extra whitespace
                console.error(`[Python Script STDERR]: ${logMessage}`); // Log in real-time to console
                logStream.write(`[STDERR]: ${logMessage}\n`); // Write to log file in real-time
            });

            // Handle errors when spawning the process
            pythonProcess.on("error", (err) => {
                console.error("Error spawning Python process:", err.message);
            });

            // Log when the Python process finishes execution
            pythonProcess.on("close", (code) => {
                console.log(
                    `Python script execution completed with exit code ${code}.`
                );
                logStream.end(); // Close the log stream
            });

            console.log(
                "Python script execution started, returning response to frontend."
            );
            res.status(200).json({
                message:
                    "Answer submitted successfully. Reviews will be processed in the background.",
            });
        }
    );
});

app.get("/api/answer/:topicId/:questionId/:userid", (req, res) => {
    const topicId = req.params.topicId;
    const questionId = req.params.questionId;
    const userid = req.params.userid;

    //console.log("id",topicId)

    const selectTopicsQuery = `SELECT Q_ID,ANSWER_SUMMARY,ANSWER_DETAIL FROM TEST_ANSWERS where  QM_ID=${topicId} and USER_ID=${userid}`;

    connection_trn.query(selectTopicsQuery, (err, results) => {
        if (err) {
            console.error("Error fetching data from the database:", err);
            return res.status(500).json({ error: "Error fetching data" });
        }

        const topics = results;

        return res.json(topics);
    });
});

app.get("/activityportal", (req, res) => {
    const QUERY = `select * from act_portal where status='active'`;

    connection.query(QUERY, (err, result) => {
        console.log(result);
        console.log(err);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.get("/actportal/:act_id", (req, res) => {
    const actId = req.params.act_id;
    console.log("act id", actId);
    const SELECT_QUERY = `SELECT DETAILS, DISPLAY_SUMMARY, DISPLAY_DETAIL, TEAM_INSTRUCTIONS, USER_BENEFITS, COMMUNITY_BENEFITS, HOW_TO_HELP FROM act_portal WHERE CMPN_DTL_ID = ?`;

    connection.query(SELECT_QUERY, [actId], (err, result) => {
        if (err) {
            console.error("Error retrieving data from MySQL database:", err);
            res.status(500).send("Error retrieving data from MySQL database");
        } else {
            res.send(result);
        }
    });
});

app.post("/userprofile", async (req, res) => {
    try {
        const userId = parseInt(req.body.userid); // You can replace this with the appropriate request field

        const query = {
            USER_ID: userId,
        };

        // Find documents that match the given query and apply the options
        const users = await db.collection("vendor_user").find(query).toArray();
        res.send(users);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/profile/Update", async (req, res) => {
    try {
        // Updated profile data from the request body
        let {
            NAME,
            USERNAME,
            PASSWORD,
            HOME_PORTALID,
            EMAIL,
            USER_ID,
            LATITUDE,
            LONGITUDE,
        } = req.body.updatedUser; // Assuming these fields are sent from the frontend
        console.log("req.body", req.body);
        console.log("req.body", NAME);
        console.log("req.body", USERNAME);
        console.log("req.body", PASSWORD);
        console.log("req.body", HOME_PORTALID);
        console.log("req.body", EMAIL);

        const userId = parseInt(USER_ID); // You can replace this with the appropriate request field
        console.log("userId", userId);

        // Update query
        const query = {
            USER_ID: userId,
        };

        // Construct the update operation
        const updateOperation = {
            $set: {
                NAME,
                USERNAME,
                PASSWORD,
                HOME_PORTALID,
                EMAIL,
                LATITUDE,
                LONGITUDE,
            },
        };

        // Update the document
        const result = await db
            .collection("vendor_user")
            .updateOne(query, updateOperation);

        console.log("result", result);

        if (result.modifiedCount === 1) {
            res.status(200).json({
                message: "User profile updated successfully.",
            });
        } else {
            console.error("No document updated");
            res.status(200).json({ message: "No changes done by you" });
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

// Define a route to fetch hospital data
app.get("/hospitals", (req, res) => {
    connection.query(
        "SELECT * FROM hospital_info where DOC_PRICE >= 1",
        (error, results) => {
            if (error) {
                console.error("Error executing query: " + error);
                res.status(500).json({ error: "Database error" });
            } else {
                res.json(results);
            }
        }
    );
});

// Define a route to fetch hospital details by ID
app.get("/hospital/:id", (req, res) => {
    const hospitalId = req.params.id;

    connection.query(
        "SELECT * FROM hospital_info WHERE Id = ?",
        [hospitalId],
        (error, results) => {
            if (error) {
                console.error("Error executing query: " + error);
                res.status(500).json({ error: "Database error" });
            } else if (results.length === 0) {
                res.status(404).json({ message: "Hospital not found" });
            } else {
                res.json(results[0]);
            }
        }
    );
});

// API endpoint to fetch procedures
app.get("/procedures/:id", (req, res) => {
    const id = req.params.id;

    const query = "SELECT * FROM hospital_procedures where HOSP_ID= ?";
    connection.query(query, [id], (error, results) => {
        if (error) {
            console.error("Error executing query: " + error);
            res.status(500).json({ error: "Database error" });
        } else {
            res.json(results);
        }
    });
});

app.post("/upload-reviews", (req, res) => {
    // Log the received data from the frontend
    console.log("Received data from the frontend:", req.body);

    const { User_Id, Username, selectedProcedure, Review, rating, hosp_id } =
        req.body;
    const Pubdate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date and time

    const selectQuery = `select * from hospital_review where USER_ID = ? and USERNAME = ? and SERVICE = ? and HOSPITAL_ID = ?`;

    connection.query(
        selectQuery,
        [User_Id, Username, selectedProcedure, hosp_id],
        (err, selectResult) => {
            if (err) {
                res.status(500).send(
                    "Error retrieving data from hospital_review " + err.message
                );
            } else {
                console.log("selectResult.length", selectResult.length);
                if (selectResult.length === 0) {
                    const query = `INSERT INTO hospital_review (USER_ID, USERNAME, SERVICE, REVIEW,RATING,HOSPITAL_ID, PUBDATE,SORTING) VALUES (?, ?, ?,?, ?,?, NOW(),CASE WHEN '${Username}' = 'admin' THEN 5 ELSE NULL END)`;
                    console.log("query", query);
                    connection.query(
                        query,
                        [
                            User_Id,
                            Username,
                            selectedProcedure,
                            Review,
                            rating,
                            hosp_id,
                        ],
                        (err) => {
                            if (err) {
                                console.error("Error submitting review:", err);
                                return res.status(500).json({
                                    error: "Review submission failed",
                                });
                            } else {
                                console.log("Review submitted successfully");
                                return res.status(200).json({
                                    message: "Review submitted successfully",
                                });
                            }
                        }
                    );
                } else {
                    console.log("Review already exists");
                    return res.status(200).json({
                        message: "Review already added by You for this service",
                    });
                }
            }
        }
    );
});

// reviews

app.get("/get/rating/reviews/:id", (req, res) => {
    const id = req.params.id;

    const query = `SELECT * FROM hospital_review where HOSPITAL_ID= ? ORDER BY SORTING DESC`;

    connection.query(query, [id], (error, results) => {
        if (error) {
            console.error("Error executing query: " + error);
            res.status(500).json({ error: "Database error" });
        } else {
            res.json(results);
        }
    });
});

app.get("/get/calculate/rating/:id", (req, res) => {
    const id = req.params.id;

    const query = `SELECT RATING FROM hospital_review where HOSPITAL_ID= ? `;

    connection.query(query, [id], (error, results) => {
        if (error) {
            console.error("Error executing query: " + error);
            res.status(500).json({ error: "Database error" });
        } else {
            res.json(results);
        }
    });
});

app.get("/hotels/:port/:parentport", async (req, res) => {
    try {
        const port = parseInt(req.params.port);
        const parentport = parseInt(req.params.parentport);

        console.log("port", port);
        console.log("parentport", parentport);
        const query = {
            $and: [
                {
                    $or: [
                        { PORTAL_ID: port },
                        { PORTAL_ID: parentport },
                        { PARENTPORTALID: port },
                    ],
                },
                {
                    VEND_CATEGRY: "Hotel",
                },
            ],
        };

        const results = await db.collection("kf_vendor").find(query).toArray();
        res.json(results);
    } catch (error) {
        console.error("Error executing query: " + error);
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/hotel/data/:id", (req, res) => {
    const vendId = req.params.id;

    connection.query(
        "SELECT * FROM HOTEL_INFO WHERE VEND_ID = ?",
        [vendId],
        (error, results) => {
            if (error) {
                console.error("Error executing query: " + error);
                res.status(500).json({ error: "Database error" });
            } else if (results.length === 0) {
                res.status(404).json({ message: "Hospital not found" });
            } else {
                res.json(results[0]);
            }
        }
    );
});

app.get("/hotel/services/:id", (req, res) => {
    const vendId = req.params.id;

    const query = "SELECT * FROM HOTEL_SERVICES where HOTEL_ID= ?";
    connection.query(query, [vendId], (error, results) => {
        if (error) {
            console.error("Error executing query: " + error);
            res.status(500).json({ error: "Database error" });
        } else {
            res.json(results);
        }
    });
});

// reviews

app.get("/get/hotel/rating/reviews/:id", (req, res) => {
    const id = req.params.id;

    const query = `SELECT * FROM HOTEL_REVIEW where HOTEL_ID= ? ORDER BY SORTING DESC`;

    connection.query(query, [id], (error, results) => {
        if (error) {
            console.error("Error executing query: " + error);
            res.status(500).json({ error: "Database error" });
        } else {
            res.json(results);
        }
    });
});

app.get("/Image", (req, res) => {
    const query = "SELECT ID,CATEGORY,BARD_KEYWORD FROM rai_keywords";
    connection.query(query, (error, results) => {
        if (error) {
            console.log(error);
            res.status(500).json({
                error: "Failed to fetch select box options",
            });
        } else {
            res.json(results);
        }
    });
});

// app.get('/registration/content/dropdown', (req, res) => {

//     const query = `SELECT ID,CATEGORY,BARD_KEYWORD FROM rai_keywords where STATUS='ACTIVE' ORDER BY CATEGORY ASC;`;

//     connection.query(query, (error, results) => {
//         if (error) {
//             console.log(error);
//             res.status(500).json({ error: 'Failed to fetch select box options' });
//         } else {
//             res.json(results);
//         }
//     });
// });

app.get("/registration/content/dropdown", (req, res) => {
    const query = `
        SELECT ID, NAME AS CATEGORY
        FROM KF_CATEGORY
        WHERE STATUS = 'ACTIVE'
    `;

    connection_trn.query(query, (error, results) => {
        if (error) {
            console.error("Database error:", error);
            return res
                .status(500)
                .json({ error: "Failed to fetch dropdown options" });
        }

        res.status(200).json(results);
    });
});

app.get("/registration/usercategory/dropdown", (req, res) => {
    const { mainCategoryId } = req.query;

    if (!mainCategoryId) {
        return res.status(400).json({ error: "mainCategoryId is required" });
    }

    const query = `
        SELECT USER_CATEGORY_ID, USER_CATEGORY_NAME 
        FROM USER_CATEGORY 
        WHERE MAIN_CATEGORY_ID = ? AND STATUS = 'ACTIVE'
    `;

    connection_trn.query(query, [mainCategoryId], (error, results) => {
        if (error) {
            console.error("Database error:", error);
            return res
                .status(500)
                .json({ error: "Failed to fetch user categories" });
        }

        res.status(200).json(results);
    });
});

app.get("/get/content/fromid", (req, res) => {
    const id = req.query.content_category_id;

    const query = "SELECT BARD_KEYWORD FROM rai_keywords WHERE ID = ?";
    connection.query(query, [id], (error, results) => {
        if (error) {
            console.log(error);
            return res
                .status(500)
                .json({ error: "Failed to fetch select box options" });
        } else {
            return res.json(results);
        }
    });
});

// Handle GET request to fetch data from image_upload table
// app.get('/imagedata', (req, res) => {
//     const userid = req.query.userid; // Get the userid from the query parameters

//     const query = `SELECT * FROM image_upload where userid=${userid} and category!='text' ORDER BY id desc`;

//     connection.query(query, (err, result) => {
//         if (err) {
//             console.error('Error fetching data from the database:', err);
//             res.sendStatus(500);
//         } else {
//             res.json(result);
//         }
//     });
// });

app.get("/imagedata", (req, res) => {
    const userid = req.query.userid; // Get the userid from the query parameters
    const page = req.query.page || 1; // Get the page number, default is 1
    const offset = (page - 1) * 5; // Calculate the offset

    const query = `SELECT COUNT(*) AS totalRows FROM image_upload WHERE userid = ? AND category != 'text'`;
    const dataQuery = `SELECT * FROM image_upload WHERE userid = ? AND category != 'text' ORDER BY id DESC LIMIT ?, 5`;

    connection.query(query, [userid], (err, countResult) => {
        if (err) {
            console.error("Error fetching total count from the database:", err);
            res.sendStatus(500);
        } else {
            const totalRows = countResult[0].totalRows;
            console.log("totalRows", totalRows);

            connection.query(dataQuery, [userid, offset], (err, result) => {
                if (err) {
                    console.error(
                        "Error fetching data from the database:",
                        err
                    );
                    res.sendStatus(500);
                } else {
                    res.json({ totalRows, data: result });
                }
            });
        }
    });
});

app.post("/upload/bard", upload.single("image"), function (req, res) {
    const imageFilePath = req.file.path;
    console.log("path", imageFilePath);
    const imagePathNew = imageFilePath.replace(/\\/g, "/");
    const imagePathNew1 = imagePathNew.replace(
        "/var/www/rafalin/mongo_react",
        ""
    );
    const imagePathWithPrefix = `..${imagePathNew1}`;

    console.log("path", imagePathWithPrefix);

    const category = req.body.category;
    const {
        story,
        storyLength,
        destination,
        userid,
        portalid,
        selectedOption,
        bardkey,
    } = req.body;
    //console.log("bardkey", bardkey)

    // const portalnamequery = `SELECT portalname AS pname FROM portal where portalid=${portalid}`;

    // // Execute the query to get the maximum USER_ID
    // connection.query(portalnamequery, (err, result) => {
    //   if (err) {
    //     return res.send(err);
    //   }

    //   // Calculate the new USER_ID by incrementing the maximum value by one
    //   const pname = result[0].pname;

    //   console.log("potralname", pname);

    // const barddata = selectedOption + ' ' + pname + ' ' + story;
    const barddata = story;

    // console.log("barddata", barddata);

    // const arg1 = 'can you write a few lines about india';

    const command = `python "/var/www/rafalin/bard/bard.py" "${barddata}" ${bardkey}`;

    //exec(command, (error, stdout, stderr)
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error.message}`);
            return res.status(500).json({ error: "Internal server error" });
        }
        if (stderr) {
            console.error(`Python script returned an error: ${stderr}`);
            return res.status(400).json({ error: "Bad request" });
        }
        console.log(`Python script output: ${stdout}`);
        const outputToStore = stdout;

        console.log(`Python script output: ${outputToStore}`);

        const query = `INSERT INTO image_upload (image, category, story, storylength, destination,userid,portalid,BARD_STORY) VALUES ( ?,?, ?, ?, ?, ?, ?,?)`;
        connection.query(
            query,
            [
                imagePathWithPrefix,
                category,
                story,
                storyLength,
                destination,
                userid,
                portalid,
                stdout,
            ],
            (err, result) => {
                if (err) {
                    console.error(
                        "Error inserting data into the database:",
                        err
                    );
                    res.sendStatus(500);
                } else {
                    const CALL_SP_QUERY = `CALL SP_InsertIntoActPointDly(${userid}, 2, ${portalid})`;

                    connection.query(CALL_SP_QUERY, (spErr, spResult) => {
                        if (spErr) {
                            return res.send(spErr);
                        } else {
                            return res.send("Data added successfully");
                        }
                    });
                }
            }
        );
        // });
    });
});

// app.post('/upload/none', upload_resume_smp.single('image'), function (req, res) {

//     const imageFilePath = req.file.path;
//     console.log("path", imageFilePath)
//     const imagePathNew = imageFilePath.replace(/\\/g, '/');
//     // const imagePathNew1 = imagePathNew.replace('/var/www/rafalin/mongo_react', '');
//     const isWin = process.platform === 'win32';

//     // Replace based on OS
//     let imagePathNew1;
//     if (isWin) {
//         imagePathNew1 = imagePathNew.replace('D:/myblocks/react trainee/Techieindex-New/public', '');
//     } else {
//         imagePathNew1 = imagePathNew.replace('/var/www/rafalin/mongo_react', '');
//     }
//     const imagePathWithPrefix = `..${imagePathNew1}`;

//     console.log("path", imagePathWithPrefix)

//     const category = req.body.category;
//     const { story, storyLength, destination, userid, portalid, selectedOption } = req.body;

//     const query = `INSERT INTO image_upload (image, category, story, storylength, destination,userid,portalid,BARD_STORY,DATE) VALUES ( ?,?, ?, ?, ?, ?, ?,?,NOW())`;
//     connection.query(query, [imagePathWithPrefix, category, story, storyLength, destination, userid, portalid, story], (err, result) => {
//         if (err) {
//             console.error('Error inserting data into the database:', err);
//             res.sendStatus(500);
//         } else {
//             const CALL_SP_QUERY = `CALL SP_InsertIntoActPointDly(${userid}, 2, ${portalid})`;

//             connection.query(CALL_SP_QUERY, (spErr, spResult) => {
//                 if (spErr) {
//                     return res.send(spErr);
//                 } else {
//                     return res.send('Data added successfully');
//                 }
//             });
//         }
//     });

// });

// app.post('/upload/none', upload_resume_smp.single('image'), async function (req, res) {
//     try {
//         const imageFilePath = req.file.path;
//         console.log("path", imageFilePath);

//         const imagePathNew = imageFilePath.replace(/\\/g, '/');
//         const isWin = process.platform === 'win32';

//         let imagePathNew1;
//         if (isWin) {
//             imagePathNew1 = imagePathNew.replace('D:/myblocks/react trainee/Techieindex-New/public', '');
//         } else {
//             imagePathNew1 = imagePathNew.replace('/var/www/rafalin/mongo_react', '');
//         }
//         const savedPath = `..${imagePathNew1}`; // original saved path

//         const { category, story, storyLength, destination, userid, portalid, firmid } = req.body;

//         // ✅ Check if watermark always add is set
//         const alwaysAdd = req.body.watermarkAlwaysAdd === "YES";

//         let finalImagePath = savedPath; // default if no python call

//         if (alwaysAdd) {
//             // 🔍 Query watermark
//             const watermarkQuery = `
//                 SELECT * FROM WATERMARKS_DETAILS
//                 WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
//                 LIMIT 1
//             `;
//             connection_trn.query(watermarkQuery, [userid, firmid], (err, wmResult) => {
//                 if (err) {
//                     console.error("❌ Watermark query error:", err);
//                     return res.status(500).json({ error: "DB error" });
//                 }

//                 const wmRow = Array.isArray(wmResult) ? wmResult[0] : wmResult;

//                 if (wmRow && ((wmRow.WATERMARK_TEXT && wmRow.WATERMARK_TEXT.trim() !== '') ||
//                     (wmRow.WATERMARK_PATH && wmRow.WATERMARK_PATH.trim() !== ''))) {

//                     console.log("💧 Active watermark found:", wmRow);
//                     const watermarkInfo = {
//                         WATERMARK_PATH: wmRow.WATERMARK_PATH,
//                         WATERMARK_TEXT: wmRow.WATERMARK_TEXT,
//                         WATERMARK_TEXT_COLOUR: wmRow.WATERMARK_TEXT_COLOUR,
//                     };

//                     const pythonCmd = isWin ? 'py' : 'python3';
//                     const scriptPath = isWin
//                         ? process.env.PY_LOGO_SCRIPT_PATH_WIN
//                         : process.env.PY_LOGO_SCRIPT_PATH_LINUX;

//                     const { spawn } = require('child_process');
//                     const python = spawn(pythonCmd, [
//                         scriptPath,
//                         savedPath, // input path
//                         JSON.stringify(watermarkInfo),
//                         firmid,
//                         userid
//                     ]);

//                     let pythonOutput = '';
//                     python.stdout.on('data', (data) => {
//                         pythonOutput += data.toString();
//                     });

//                     python.stderr.on('data', (data) => {
//                         console.error(`🐍 stderr: ${data}`);
//                     });

//                     python.on('close', (code) => {
//                         console.log(`🔚 Python exited with code ${code}`);
//                         if (pythonOutput.trim()) {
//                             // python should return final watermarked path
//                             finalImagePath = pythonOutput.trim();
//                         }

//                         // ✅ NOW insert into DB with final path
//                         insertIntoDB(finalImagePath);
//                     });

//                     python.on('error', (err) => {
//                         console.error("❌ Python script error:", err);
//                         return res.status(500).json({ error: "Python error" });
//                     });

//                 } else {
//                     // No active watermark, insert original
//                     insertIntoDB(finalImagePath);
//                 }
//             });
//         } else {
//             // No watermark requested
//             insertIntoDB(finalImagePath);
//         }

//         // ✅ Helper to insert into DB
//         function insertIntoDB(imagePath) {
//             const query = `INSERT INTO image_upload (image, category, story, storylength, destination, userid, portalid, BARD_STORY, DATE)
//                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

//             connection.query(query, [imagePath, category, story, storyLength, destination, userid, portalid, story], (err, result) => {
//                 if (err) {
//                     console.error('❌ Insert error:', err);
//                     return res.status(500).json({ error: "DB insert error" });
//                 }

//                 const CALL_SP_QUERY = `CALL SP_InsertIntoActPointDly(${userid}, 2, ${portalid})`;
//                 connection.query(CALL_SP_QUERY, (spErr, spResult) => {
//                     if (spErr) {
//                         return res.status(500).json({ error: "SP error" });
//                     }
//                     console.log("✅ Insert + SP done");
//                     // res.json({ success: true, path: imagePath });
//                     res.send('Data added successfully');
//                 });
//             });
//         }

//     } catch (error) {
//         console.error("❗ Upload error:", error);
//         return res.status(500).json({ error: "Internal error" });
//     }
// });

app.post(
    "/upload/none",
    upload_resume_smp.single("image"),
    async function (req, res) {
        try {
            console.log("📥 New upload request received at /upload/none");

            const isWin = process.platform === "win32";
            console.log(
                "💻 Platform detected:",
                isWin ? "Windows" : "Linux/Unix"
            );

            // File upload details
            if (!req.file) {
                console.error("❌ No file uploaded!");
                return res.status(400).json({ error: "No file uploaded" });
            }
            console.log("📂 Uploaded file:", req.file);
            console.log("body", req.body);

            const imageFilePath = req.file.path;
            console.log("🛠 Raw file path:", imageFilePath);

            const imagePathNew = imageFilePath.replace(/\\/g, "/");
            console.log("🔄 Normalized path:", imagePathNew);

            console.log("✅ Saved (relative) path for DB:", imagePathNew);

            const {
                category,
                story,
                storyLength,
                destination,
                userid,
                portalid,
                firmid,
            } = req.body;
            console.log("📝 Request body:", req.body);

            // ✅ Check if watermark always add is set
            const alwaysAdd = req.body.watermarkAlwaysAdd === "YES";
            console.log("💧 Watermark always add flag:", alwaysAdd);

            let finalImagePath = imagePathNew; // default if no python call
            const savedPath = imagePathNew;

            if (alwaysAdd) {
                console.log(
                    "🔍 Fetching watermark details for USERID:",
                    userid,
                    "FIRMID:",
                    firmid
                );

                const watermarkQuery = `
                SELECT * FROM WATERMARKS_DETAILS
                WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
                LIMIT 1
            `;

                connection_trn.query(
                    watermarkQuery,
                    [userid, firmid],
                    (err, wmResult) => {
                        if (err) {
                            console.error("❌ Watermark query error:", err);
                            return res.status(500).json({ error: "DB error" });
                        }

                        console.log("📊 Watermark query result:", wmResult);
                        const wmRow = Array.isArray(wmResult)
                            ? wmResult[0]
                            : wmResult;

                        if (
                            wmRow &&
                            ((wmRow.WATERMARK_TEXT &&
                                wmRow.WATERMARK_TEXT.trim() !== "") ||
                                (wmRow.WATERMARK_PATH &&
                                    wmRow.WATERMARK_PATH.trim() !== ""))
                        ) {
                            console.log("💧 Active watermark found:", wmRow);

                            const watermarkInfo = {
                                WATERMARK_PATH: wmRow.WATERMARK_PATH,
                                WATERMARK_TEXT: wmRow.WATERMARK_TEXT,
                                WATERMARK_TEXT_COLOUR:
                                    wmRow.WATERMARK_TEXT_COLOUR,
                            };

                            const pythonCmd = isWin ? "py" : "python3";
                            const scriptPath = isWin
                                ? process.env.PY_LOGO_SCRIPT_PATH_WIN
                                : process.env.PY_LOGO_SCRIPT_PATH_LINUX;

                            console.log(
                                "🐍 Running Python script:",
                                pythonCmd,
                                scriptPath
                            );
                            console.log("➡️ Args:", [
                                savedPath,
                                JSON.stringify(watermarkInfo),
                                firmid,
                                userid,
                            ]);

                            const { spawn } = require("child_process");
                            const python = spawn(pythonCmd, [
                                scriptPath,
                                savedPath, // input path
                                JSON.stringify(watermarkInfo),
                                firmid,
                                userid,
                            ]);

                            let pythonOutput = "";
                            python.stdout.on("data", (data) => {
                                console.log("🐍 stdout:", data.toString());
                                pythonOutput += data.toString();
                            });

                            python.stderr.on("data", (data) => {
                                console.error(`🐍 stderr: ${data}`);
                            });

                            python.on("close", (code) => {
                                console.log(
                                    `🔚 Python exited with code ${code}`
                                );
                                if (pythonOutput.trim()) {
                                    finalImagePath = pythonOutput.trim();
                                    console.log(
                                        "✅ Final watermarked image path:",
                                        finalImagePath
                                    );
                                } else {
                                    console.log(
                                        "⚠️ No Python output. Using original savedPath:",
                                        finalImagePath
                                    );
                                }

                                // ✅ NOW insert into DB with final path
                                insertIntoDB(finalImagePath);
                            });

                            python.on("error", (err) => {
                                console.error("❌ Python script error:", err);
                                return res
                                    .status(500)
                                    .json({ error: "Python error" });
                            });
                        } else {
                            console.log(
                                "ℹ️ No active watermark found. Proceeding without watermark."
                            );
                            insertIntoDB(finalImagePath);
                        }
                    }
                );
            } else {
                console.log(
                    "ℹ️ Watermark not requested. Inserting original path."
                );
                insertIntoDB(finalImagePath);
            }

            // ✅ Helper to insert into DB
            function insertIntoDB(imagePath) {
                const isWin = process.platform === "win32";
                console.log(
                    "💻 Platform detected:",
                    isWin ? "Windows" : "Linux/Unix"
                );

                let imagePathNew1;
                if (isWin) {
                    imagePathNew1 = imagePath.replace(
                        "D:/myblocks/react trainee/Techieindex-New/public",
                        ""
                    );
                } else {
                    imagePathNew1 = imagePath.replace(
                        "/var/www/rafalin/mongo_react",
                        ""
                    );
                }
                const savedPath = `..${imagePathNew1}`;

                console.log("🗄 Inserting into DB with path:", savedPath);

                const query = `INSERT INTO image_upload (image, category, story, storylength, destination, userid, portalid, BARD_STORY, DATE) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

                const params = [
                    savedPath,
                    category,
                    story,
                    storyLength,
                    destination,
                    userid,
                    portalid,
                    story,
                ];
                console.log("📥 Insert Query Params:", params);

                connection.query(query, params, (err, result) => {
                    if (err) {
                        console.error("❌ Insert error:", err);
                        return res
                            .status(500)
                            .json({ error: "DB insert error" });
                    }

                    console.log("✅ Insert successful. Result:", result);

                    const CALL_SP_QUERY = `CALL SP_InsertIntoActPointDly(${userid}, 2, ${portalid})`;
                    console.log("⚙️ Calling stored procedure:", CALL_SP_QUERY);

                    connection.query(CALL_SP_QUERY, (spErr, spResult) => {
                        if (spErr) {
                            console.error("❌ Stored Procedure error:", spErr);
                            return res.status(500).json({ error: "SP error" });
                        }

                        console.log(
                            "✅ Stored procedure executed successfully. Result:",
                            spResult
                        );
                        console.log("🎉 Upload + DB insert flow completed.");

                        res.json({ success: true, id: result.insertId });
                        res.send("Data added successfully");
                    });
                });
            }
        } catch (error) {
            console.error("❗ Unexpected upload error:", error);
            return res.status(500).json({ error: "Internal error" });
        }
    }
);

app.post("/approvestorydetails", (req, res) => {
    console.log("test", req.body.id);

    const QUERY = `SELECT BARD_STORY,image from image_upload where id=${req.body.id}`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/approvetextstorydetails", (req, res) => {
    console.log("test", req.body.id);

    const QUERY = `SELECT BARD_STORY,DOC_ID from image_upLoad where id=${req.body.id}`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/approvestory", (req, res) => {
    const id = req.body.id;
    const bardstory = req.body.bardStory;
    const categry = "USER_GENERATED";
    // Step 1: Retrieve image and bardStory from image_upload
    const selectQuery = `SELECT IMAGE, STORY,userid,portalid FROM image_upload WHERE id = ?`;

    connection.query(selectQuery, [id], (err, selectResult) => {
        if (err) {
            res.status(500).send(
                "Error retrieving data from image_upload: " + err.message
            );
        } else {
            if (selectResult.length === 0) {
                res.status(404).send(
                    "No record found in image_upload with the provided ID."
                );
            } else {
                const { IMAGE, STORY, userid, portalid } = selectResult[0];

                // Step 2: Update image_upload
                const imageUploadQuery = `UPDATE image_upload SET APPROVED = 'Y',BARD_STORY = ? WHERE id = ?`;

                connection.query(
                    imageUploadQuery,
                    [bardstory, id],
                    (err, imageUploadResult) => {
                        if (err) {
                            res.status(500).send(
                                "Error updating image_upload: " + err.message
                            );
                        } else {
                            // Step 3: Insert into kf_docmnt

                            const today = new Date();
                            const thirtyDaysFromToday = new Date(today);
                            thirtyDaysFromToday.setDate(today.getDate() + 30);

                            // Format dates in 'YYYY-MM-DD' format
                            // const sdate = today.toISOString().split('T')[0];
                            const edate = thirtyDaysFromToday
                                .toISOString()
                                .split("T")[0];

                            // Get current Indian time
                            // const pubdate = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

                            const kfDocmntQuery = `INSERT INTO kf_docmnt (IMAGE, DOC_TITL, DOC_DET,DOC_CATEGRY,DOC_SDATE,DOC_EDATE,DOC_PUBDATE,portalid,MEMBER_ID,DOC_PRICE) VALUES (?,?,?,?, NOW(), ?,NOW(),?,?,?)`;

                            connection.query(
                                kfDocmntQuery,
                                [
                                    IMAGE,
                                    STORY,
                                    bardstory,
                                    categry,
                                    edate,
                                    portalid,
                                    userid,
                                    3,
                                ],
                                (err, kfDocmntResult) => {
                                    if (err) {
                                        res.status(500).send(
                                            "Error inserting into kf_docmnt: " +
                                            err.message
                                        );
                                    } else {
                                        res.send(
                                            "Story approved and data inserted into kf_docmnt successfully."
                                        );
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    });
});

app.post("/updatetextstory", (req, res) => {
    const id = req.body.id;
    const bardstory = req.body.bardStory;

    const imageUploadQuery = `UPDATE image_upload SET BARD_STORY = ? WHERE id = ?`;

    connection.query(
        imageUploadQuery,
        [bardstory, id],
        (err, imageUploadResult) => {
            if (err) {
                res.status(500).send(
                    "Error updating image_upload: " + err.message
                );
            } else {
                // The update was successful.
                // You can choose to send a success response if needed.
                res.status(200).send("BARD_STORY updated successfully.");
            }
        }
    );
});

// app.post('/group/list', (req, res) => {

//     const QUERY = `SELECT * from vendor_social_acc where USERID=${req.body.userid} and FIRM_ID=${req.body.firmid}`
//     //console.log(QUERY )
//     connection.query(QUERY, (err, result) => {
//         //console.log(result);
//         if (err) {
//             res.send(err)
//         } else {
//             res.send(result)
//         }
//     })
// })

app.post("/group/list", (req, res) => {
    const pagelist = req.body.pagelist;
    console.log("pagelist", pagelist);

    // Extracting user ID and firm ID from request body
    const userId = req.body.userid;
    const firmId = req.body.firmid;

    // Creating an array to store the IDs from pagelist
    const ids = pagelist.map((item) => item.id);

    console.log("ids", ids.length);

    if (!pagelist || pagelist.length === 0) {
        console.log("Pagelist is empty");
        return res.send("Pagelist is empty");
    }

    // Constructing the SQL query to update rows
    const UPDATE_QUERY = `UPDATE vendor_social_acc SET STATUS = 'active' WHERE USERID = ${userId} AND FIRM_ID = ${firmId} AND URL_ID IN (${ids
        .map((id) => `'${id}'`)
        .join(",")})`;

    // Executing the update query
    connection.query(UPDATE_QUERY, (err, updateResult) => {
        if (err) {
            res.send(err);
        } else {
            //console.log("update", updateResult)

            const SELECT_NOT_EXIST_QUERY = `SELECT URL_ID FROM vendor_social_acc WHERE USERID = ${userId} AND FIRM_ID = ${firmId}`;

            // Executing the select query
            connection.query(SELECT_NOT_EXIST_QUERY, (err, existResult) => {
                if (err) {
                    res.send(err);
                } else {
                    const existingIds = existResult.map((item) => item.URL_ID);
                    //console.log("existingIds", existingIds);

                    // Filtering out IDs that don't exist in the database
                    const notExistIds = pagelist.filter(
                        (item) => !existingIds.includes(item.id)
                    );
                    //console.log("notExistIds", notExistIds);

                    updateExistingRows(
                        userId,
                        firmId,
                        existingIds,
                        ids,
                        (err, updateInactiveResult) => {
                            if (err) {
                                res.send(err);
                            } else {
                                // console.log("updateInactive", updateInactiveResult);

                                insertNewRows(
                                    userId,
                                    firmId,
                                    notExistIds,
                                    (err, insertResult) => {
                                        if (err) {
                                            res.send(err);
                                        } else {
                                            //console.log("insert", insertResult);

                                            const QUERY = `SELECT * from vendor_social_acc where USERID=${req.body.userid} and FIRM_ID=${req.body.firmid} and STATUS = 'active' `;
                                            //console.log(QUERY )
                                            connection.query(
                                                QUERY,
                                                (err, result) => {
                                                    //console.log(result);
                                                    if (err) {
                                                        res.send(err);
                                                    } else {
                                                        res.send(result);
                                                    }
                                                }
                                            );
                                        }
                                    }
                                );
                            }
                        }
                    );
                }
            });
        }
    });
});

function updateExistingRows(
    userId,
    firmId,
    existingIds,
    pagelistIds,
    callback
) {
    if (existingIds.length === 0) {
        // If there are no existing rows, directly call the callback with null
        callback(null);
        return;
    }

    // Find IDs that exist in the database but are not in the provided pagelist
    const notInPagelist = existingIds.filter((id) => !pagelistIds.includes(id));
    console.log("notInPagelist", notInPagelist);

    if (notInPagelist.length === 0) {
        // If all existing IDs are present in the pagelist, no need for update
        callback(null);
        return;
    }

    // Constructing the SQL query to update rows to inactive status
    const UPDATE_QUERY = `UPDATE vendor_social_acc SET STATUS = 'inactive' WHERE USERID = ${userId} AND FIRM_ID = ${firmId} AND URL_ID IN (${notInPagelist
        .map((id) => `'${id}'`)
        .join(",")})`;

    // Executing the update query
    connection.query(UPDATE_QUERY, (err, updateResult) => {
        if (err) {
            callback(err);
        } else {
            callback(null, updateResult);
        }
    });
}

function insertNewRows(userId, firmId, notExistIds, callback) {
    if (notExistIds.length === 0) {
        // If there are no new rows to insert, directly call the callback with null
        callback(null);
        return;
    }

    const INSERT_VALUES = notExistIds
        .map(
            (item) =>
                `(${userId}, ${firmId}, '${item.id}', 'active', 'https://www.facebook.com/profile.php?id=${item.id}','Page', '${item.name}')`
        )
        .join(",");

    const INSERT_QUERY = `INSERT INTO vendor_social_acc (USERID, FIRM_ID, URL_ID, STATUS, SOCIAL_URL,ACCOUNT_TYPE,URL_NAME) VALUES ${INSERT_VALUES}`;

    // Executing the insert query
    connection.query(INSERT_QUERY, (err, insertResult) => {
        if (err) {
            callback(err);
        } else {
            callback(null, insertResult);
        }
    });
}

app.post("/facebook/set/token", (req, res) => {
    console.log("test", req.body);
    const { id, PAGE_ACCESS_TOKEN, TOKEN_DATE } = req.body;

    const QUERY = `UPDATE vendor_social_acc SET PAGE_ACCESS_TOKEN= ?,TOKEN_DATE= NOW() WHERE ID = ?`;
    //console.log(QUERY )
    connection.query(QUERY, [PAGE_ACCESS_TOKEN, id], (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

//Rafalin Get image link
app.post("/get/image/link", (req, res) => {
    const QUERY = `SELECT * from  image_upload where id=${req.body.id} `;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

//Rafalin save facebook post history
app.post("/facebook/post/history", (req, res) => {
    let {
        url,
        id,
        portalid,
        firmid,
        type,
        group_page_url,
        page_token,
        TOKEN_DATE,
        userid,
    } = req.body;
    console.log("test", req.body);

    const insertUserQuery = `INSERT INTO smp_post_history (FIRM_ID, URL, DATE,PORTAL_ID, IMG_ID,PAGE_GROUP_TYPE,GROUP_PAGE_URL,PAGE_ACCESS_TOKEN,TOKEN_DATE,SOCIAL_MEDIA_NAME,USERID)
    VALUES ('${firmid}', '${url}', NOW(), '${portalid}', '${id}', '${type}', '${group_page_url}','${page_token}', NOW() ,'facebook','${userid}' )`;

    console.log("test", insertUserQuery);
    // Execute the query to insert the new record
    connection.query(insertUserQuery, (err, result) => {
        if (err) {
            return res.send(err);
        } else {
            return res.send("Data added successfully");
        }
    });
});

app.get("/post/history", (req, res) => {
    const id = req.query.id; // Get the userid from the query parameters
    const social_name = req.query.social_name;
    console.log("test", id);
    const query = `SELECT * FROM smp_post_history where IMG_ID=${id} && SOCIAL_MEDIA_NAME='${social_name}' `;

    connection.query(query, (err, result) => {
        if (err) {
            console.error("Error fetching data from the database:", err);
            res.sendStatus(500);
        } else {
            res.json(result);
        }
    });
});

app.post("/facebook/post/likes", (req, res) => {
    console.log("test", req.body.id);

    const s_id = req.body.s_id;
    const likes = req.body.likes;

    const QUERY = `UPDATE smp_post_history SET LIKES= ? WHERE ID = ?`;
    //console.log(QUERY )
    connection.query(QUERY, [likes, s_id], (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/facebook/post/comments", (req, res) => {
    console.log("test", req.body.id);

    const s_id = req.body.s_id;
    const comments = req.body.comments;

    const QUERY = `UPDATE smp_post_history SET COMMENT= ? WHERE ID = ?`;
    //console.log(QUERY )
    connection.query(QUERY, [comments, s_id], (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/facebook/update/pagetoken", (req, res) => {
    console.log("test", req.body);

    const id = req.body.id;
    const access_token = req.body.access_token;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Add 1 to month because it's 0-based, and pad with '0'
    const day = String(today.getDate()).padStart(2, "0"); // Pad with '0'
    const hours = String(today.getHours()).padStart(2, "0");
    const minutes = String(today.getMinutes()).padStart(2, "0");
    const seconds = String(today.getSeconds()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    console.log("formattedDate", formattedDate);

    const QUERY = `UPDATE smp_post_history SET PAGE_ACCESS_TOKEN= ? , TOKEN_DATE=? WHERE ID = ?`;
    console.log(QUERY);
    connection.query(
        QUERY,
        [access_token, formattedDate, id],
        (err, result) => {
            //console.log(result);
            if (err) {
                res.send(err);
            } else {
                res.send(result);
            }
        }
    );
});

app.post("/instagram-proxy", async (req, res) => {
    const encodedUrlVal = req.body.encodedUrlVal;
    console.log("encodedUrlVal", encodedUrlVal);
    const command = `python "C:/Users/b2/Desktop/react myblock.in/react raingauge webapp adding cookie/curl.py" "${encodedUrlVal}" `;

    //exec(command, (error, stdout, stderr)
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error.message}`);
            return res.status(500).json({ error: "Internal server error" });
        }
        if (stderr) {
            console.error(`Python script returned an error: ${stderr}`);
            return res.status(400).json({ error: "Bad request" });
        }
        console.log(`Python script output: ${stdout}`);
        res.send(stdout);
    });
});

//Rafalin Group List for Instagram
app.post("/group/list/for_insta", (req, res) => {
    const QUERY = `SELECT * from vendor_social_acc where USERID=${req.body.userid} and FIRM_ID=${req.body.firmid} and ACCOUNT_TYPE='Page'`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/instagram/post/history", (req, res) => {
    let { url, id, portalid, firmid, userid } = req.body;

    console.log("test", req.body);

    const insertUserQuery = `INSERT INTO smp_post_history (FIRM_ID, URL, DATE,PORTAL_ID, IMG_ID,SOCIAL_MEDIA_NAME,USERID)
    VALUES ('${firmid}', '${url}', NOW(), '${portalid}', '${id}', 'instagram','${userid}')`;

    console.log("test", insertUserQuery);
    // Execute the query to insert the new record
    connection.query(insertUserQuery, (err, result) => {
        if (err) {
            return res.send(err);
        } else {
            return res.send("Data added successfully");
        }
    });
});

app.get("/post/history/byid", (req, res) => {
    const id = req.query.id; // Get the userid from the query parameters

    console.log("test", id);
    const query = `SELECT * FROM smp_post_history where ID=${id}  `;

    connection.query(query, (err, result) => {
        if (err) {
            console.error("Error fetching data from the database:", err);
            res.sendStatus(500);
        } else {
            res.json(result);
        }
    });
});

app.get("/api/endpoint", (req, res) => {
    const userId = req.query.userId; // Retrieve the 'userId' from the query parameters

    console.log("Received User ID from frontend:", userId); // Log the received user ID

    if (!userId) {
        return res.status(400).json({ error: "userId is missing" });
    }

    // Your database query using 'userId' as 'resumeId'
    const query =
        "SELECT COUNT(*) AS point FROM act_point_dly WHERE resume_id = ?";
    console.log("executing query:", query);

    connection.query(query, [userId], (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            res.status(500).json({ error: "An error occurred" });
        } else {
            if (results[0] && results[0].point !== undefined) {
                const pointCount = results[0].point;
                console.log("Point count:", pointCount);

                // Log the entire results for debugging
                console.log("Full Query Results:", results);

                res.json({ point: pointCount });
            } else {
                // Handle the case when 'point' is not found or is undefined
                res.json({ point: 0 });
            }
        }
    });
});

// Route to fetch detailed data
app.get("/api/detailed-pointdata", (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: "userId is missing" });
    }

    // Your modified database query to fetch detailed data
    const query =
        "SELECT activity, insrt_dtm, points FROM act_point_dly WHERE resume_id = ? AND activity IS NOT NULL AND insrt_dtm IS NOT NULL AND points IS NOT NULL";

    connection.query(query, [userId], (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            res.status(500).json({ error: "An error occurred" });
        } else {
            res.json(results); // Send the rows of detailed data as JSON
        }
    });
});

app.post("/login/verify/email", async (req, res) => {
    try {
        const email = req.body.email;
        console.log("test", req.body.email);

        // Find a user with the provided username and password
        //const user = await db.collection('vendor_user').findOne({ EMAIL: email });
        //const user = await db.collection('vendor_user').findOne({ EMAIL: { $regex: new RegExp(email, 'i') } });
        const user = await db
            .collection("vendor_user")
            .findOne({ EMAIL: { $regex: new RegExp(`^${email}$`, "i") } });

        if (user) {
            // User found, send found response
            res.status(200).json({ message: "User found", user });
        } else {
            // User not found, send not found response
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/send-email", (req, res) => {
    const { to, subject, text, html } = req.body;
    console.log("test", req.body);

    // Nodemailer logic to send email
    const transporter = nodemailer.createTransport({
        host: "mail.myblocks.in",
        port: 465,
        secure: true,
        auth: {
            user: "listings@myblocks.in",
            pass: "Matix@1972123",
        },
        logger: true,
        debug: true,
        // tls: {
        //     rejectUnauthorized: false,
        // },
    });

    const mailOptions = {
        from: "listings@myblocks.in",
        to: to,
        subject: subject,
        text: text,
        html: html,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }
        //res.status(200).send('Email sent: ' + info.response);
        res.status(200).json({ message: "Email has been Sent" });
    });
});

app.post("/password/reset", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("test", req.body);

        const updateResult = await db
            .collection("vendor_user")
            .updateOne(
                { EMAIL: { $regex: new RegExp(email, "i") } },
                { $set: { PASSWORD: password } }
            );

        if (updateResult.modifiedCount > 0) {
            res.status(200).json({ message: "Password updated successfully" });
        } else {
            // No user found with the provided email, send not found response
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

// app.post("/business/login/details", (req, res) => {
//     // console.log(req.body.port);
//     //const { username, password } = req.body;
//     const QUERY = `select * from EMPLOY_REGISTRATION where USERNAME='${req.body.username}'and PASSWORD='${req.body.password}' `;

//     console.log(QUERY);
//     // console.log(res);
//     pmoConnection.query(QUERY, (err, result) => {
//         console.log(result);
//         console.log(err);
//         if (err) {
//             res.send(err);
//         } else {
//             res.send(result);
//         }
//     });
// });


app.post("/business/login/details", (req, res) => {
    // console.log(req.body.port);
    //const { username, password } = req.body;
    const QUERY = `select * from EMPLOY_REGISTRATION where USERNAME='${req.body.username}'and PASSWORD='${req.body.password}' `;

    console.log(QUERY);
    // console.log(res);
    pmoConnection.query(QUERY, (err, result) => {
        console.log(result);
        console.log(err);
        if (err) {
            res.send(err);
        } else {
            if (result && result.length > 0) {
                const user = result[0];
                const token = jwt.sign(
                    {
                        userid: user.EMPID,
                        username: user.USERNAME,
                        role: "business",
                    },
                    JWT_SECRET,
                    { expiresIn: "24h" }
                );
                res.json({ user: result, token: token });
            } else {
                res.send(result);
            }
        }
    });
});

// app.post('/employee/list', (req, res) => {
//     // console.log(req.body.port);
//     //const { username, password } = req.body;
//     const QUERY = `select * from EMPLOY_REGISTRATION where FIRM_ID=${req.body.firmid} && STATUS = "Active" `

//     console.log(QUERY);
//     // console.log(res);
//     pmoConnection.query(QUERY, (err, result) => {
//         console.log(result);
//         console.log(err);
//         if (err) {
//             res.send(err)
//         } else {
//             res.send(result)
//         }
//     })
// })

app.post("/employee/list", (req, res) => {
    const QUERY = `SELECT * FROM EMPLOY_REGISTRATION WHERE FIRM_ID = ? AND STATUS = "Active"`;

    console.log(QUERY);

    pmoConnection.query(QUERY, [req.body.firmid], (err, result) => {
        console.log(result);
        console.log(err);
        if (err) {
            res.send(err);
        } else {
            // Remove PHONE field from each employee object
            const sanitizedResult = result.map(({ PHONE, ...rest }) => rest);
            res.send(sanitizedResult);
        }
    });
});

app.post("/business/app/menu", (req, res) => {
    const QUERY = `SELECT * from smp_menu where ROLE_ID<=${req.body.role_id} and USER_TYPE='${req.body.category}' order by DISPLAY_SEQ asc`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

// GET endpoint to fetch PROJECT_ID and DESCRIPTION values
app.get("/projects", (req, res) => {
    const userid = req.query.userid; // Retrieve userid from URL query parameters
    console.log("UserID:", userid);

    // Use the retrieved userid in your query logic
    pmoConnection.query(
        "SELECT PROJECT_ID, DESCRIPTION FROM MY_PROJECT WHERE STATUS = ? AND EMP_ID = ?",
        ["Active", userid],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            res.json(results);
        }
    );
});

// app.get('/cr_ids', (req, res) => {
//     pmoConnection.query('SELECT CR_ID, TASK FROM CR_TABLE', (error, results) => {
//         if (error) {
//             console.error(error);
//             return res.status(500).json({ error: 'Internal Server Error' });
//         }

//         // Assuming 'results' is an array of objects with CR_ID and TASK fields
//         res.json(results);
//     });
// });

app.get("/cr_ids", (req, res) => {
    const userid = req.query.userid; // Retrieve userid from URL query parameters
    console.log("UserID:", userid);

    pmoConnection.query(
        "SELECT CR_ID, TASK FROM CR_TABLE WHERE EMP_ID = ?",
        [userid],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            // Assuming 'results' is an array of objects with CR_ID and TASK fields
            res.json(results);
        }
    );
});

app.get("/api/employee-report", (req, res) => {
    const { searchTerm } = req.query;

    if (searchTerm) {
        const query = `SELECT * FROM EMP_DLY_REPORT WHERE 
          EMP_NAME LIKE ? OR 
          REP_TYPE LIKE ? OR 
          DATE_FORMAT(CREATED_DATE, '%Y-%m-%d') LIKE ?`;

        const searchValue = `%${searchTerm}%`;

        pmoConnection.query(
            query,
            [searchValue, searchValue, searchValue],
            (error, results, fields) => {
                if (error) {
                    console.error("Error fetching employee reports:", error);
                    res.status(500).send("Error fetching employee reports");
                    return;
                }

                res.json(results);
            }
        );
    } else {
        // If searchTerm is empty or not provided, return all records
        const query = `SELECT * FROM EMP_DLY_REPORT`;

        pmoConnection.query(query, (error, results, fields) => {
            if (error) {
                console.error("Error fetching employee reports:", error);
                res.status(500).send("Error fetching employee reports");
                return;
            }

            res.json(results);
        });
    }
});

// ... (previous code remains unchanged)

app.post("/api/insert-employee-reports", (req, res) => {
    console.log("Received data from frontend:", req.body);
    const {
        createdDate,
        projectID,
        type,
        reportType,
        task,
        description,
        status,
        time,
        actionNumbers,
        resultNumbers,
        remarks,
        taskType,
        baseline,
        startTime,
        endTime,
        taskID,
        crID,
        percentage,
        emp_id,
        emp_name,
    } = req.body;

    if (!createdDate || !projectID || !emp_id || !emp_name) {
        console.log(
            "Data not received or missing required fields from the frontend"
        );
        return res
            .status(400)
            .json({ error: "Data not received or missing required fields" });
    }

    // Rest of your code for inserting into the database
    // ...

    const query = `INSERT INTO EMP_DLY_REPORT 
    (CREATED_DATE, PROJ_ID, TYPE, REP_TYPE, TASK, DESCRIPTION, STATUS, TIME, ACTION_NOS, RSLT_NOS, REMARKS, TASK_TYPE, TASK_BASE_LINE, START_TIME, END_TIME, TASK_ID, CR_ID, PERCENTAGE, EMP_ID, EMP_NAME,UPDATED_DATE)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,NOW())`;
    console.log("SQL Query:", query);
    pmoConnection.query(
        query,
        [
            createdDate,
            projectID,
            type,
            reportType,
            task,
            description,
            status,
            time,
            actionNumbers,
            resultNumbers,
            remarks,
            taskType,
            baseline,
            startTime,
            endTime,
            taskID,
            crID,
            percentage,
            emp_id,
            emp_name,
        ],
        (error, results) => {
            if (error) {
                console.error("Error inserting employee report:", error);
                return res
                    .status(500)
                    .json({ error: "Error inserting employee report" });
            }
            console.log("Employee report inserted successfully");
            return res
                .status(200)
                .json({ message: "Employee report inserted successfully" });
        }
    );
});

app.post("/techieindex/app/menu", (req, res) => {
    const QUERY = `SELECT * from smp_menu where ROLE_ID<=${req.body.role_id}`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

// app.post('/businessuser/signup/details', (req, res) => {
//     try {
//         // Retrieve the values from the request body
//         const { name, id, key, phone, email, portalid, selectedContentId, selectedUserCategoryId } = req.body;

//         const contentCategoryId = selectedContentId ? selectedContentId : null;

//         const userSubCategoryId =
//             selectedUserCategoryId && selectedUserCategoryId !== '' ? parseInt(selectedUserCategoryId) : null;

//         console.log("req.body", req.body);

//         // Check if the user with the given username already exists
//         pmoConnection.query(
//             'SELECT * FROM EMPLOY_REGISTRATION WHERE USERNAME = ?',
//             [id],
//             (usernameError, usernameRows) => {
//                 if (usernameError) {
//                     console.error('Error checking existing username:', usernameError);
//                     return res.status(500).json({ error: 'Internal Server Error while checking existing username' });
//                 }

//                 if (usernameRows && usernameRows.length > 0) {
//                     // Username found, send found response
//                     return res.status(403).json({ message: 'Username already exists', user: usernameRows[0] });
//                 } else {
//                     // Proceed to check the email after username check passes
//                     pmoConnection.query(
//                         'SELECT MAX(FIRM_ID) AS maxFirmId FROM EMPLOY_REGISTRATION',
//                         (firmIdError, firmIdResult) => {
//                             if (firmIdError) {
//                                 console.error('Error fetching max FIRM_ID:', firmIdError);
//                                 return res.status(500).json({ error: 'Internal Server Error while fetching max FIRM_ID' });
//                             }

//                             const maxFirmId = firmIdResult[0].maxFirmId || 0; // Default to 0 if no rows are found
//                             const newFirmId = maxFirmId + 1;

//                             // Check if the user with the given email already exists
//                             // const newFirmId = 5;

//                             pmoConnection.query(
//                                 'SELECT * FROM EMPLOY_REGISTRATION WHERE EMAIL = ?',
//                                 [email],
//                                 (emailError, userRows) => {
//                                     if (emailError) {
//                                         console.error('Error checking existing email:', emailError);
//                                         return res.status(500).json({ error: 'Internal Server Error while checking existing email' });
//                                     }
//                                     console.log("userRows", userRows);

//                                     if (userRows && userRows.length > 0) {
//                                         // Email found, send found response
//                                         return res.status(403).json({ message: 'Email already exists', user: userRows[0] });
//                                     } else {
//                                         // Email not found, insert the new user into the database
//                                         pmoConnection.query(
//                                             `INSERT INTO EMPLOY_REGISTRATION
//                                             (EMPNAME, USERNAME, PASSWORD, FIRM_ID, PHONE, EMAIL, APPDATE, CREATED_DATE, STATUS, HOME_PORTALID, CONTENT_CATEGORY_ID, USER_SUB_CATEGORY_ID)
//                                             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 'Inactive', ?, ?, ?)`,
//                                             [name, id, key, newFirmId, phone, email, portalid, contentCategoryId, userSubCategoryId],
//                                             (insertError, result) => {
//                                                 if (insertError) {
//                                                     console.error('Error adding new user:', insertError);
//                                                     return res.status(500).json({ error: 'Internal Server Error while adding new user' });
//                                                 }
//                                                 res.status(200).json({ message: 'User added successfully', result });
//                                             }
//                                         );
//                                     }
//                                 }
//                             );
//                         }
//                     );
//                 }
//             }
//         );
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).json({ message: 'An error occurred while processing your request.' });
//     }
// });

// ------------------ SIGNUP ENDPOINT ------------------
app.post("/businessuser/signup/details", (req, res) => {
    try {
        const {
            name,
            id,
            key,
            phone,
            email,
            portalid = 3025,
            selectedContentId,
            selectedUserCategoryId,
        } = req.body;

        // ---- validate required fields ----
        const errors = [];
        if (!name || !name.trim()) errors.push("Name is required");
        if (!id || !id.trim()) errors.push("Username is required");
        if (!key || !key.trim()) errors.push("Password is required");
        if (!phone || !String(phone).trim()) errors.push("Phone is required");
        if (!email || !String(email).trim()) errors.push("Email is required");

        // Only subcategory is mandatory; main can fall back to sub
        const subId = parseInt(selectedUserCategoryId, 10);
        let contentId = parseInt(selectedContentId, 10);
        if (isNaN(subId)) errors.push("Subcategory is required");

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(", ") });
        }

        if (isNaN(contentId)) {
            // Fallback: use subcategory ID as content category ID
            contentId = subId;
        }

        const username = id.trim();
        const phoneStr = String(phone).trim();
        const emailStr = String(email).trim();

        console.log("Signup data (sanitized):", {
            name: name.trim(),
            username,
            key: "[HIDDEN]",
            phone: phoneStr,
            email: emailStr,
            portalid,
            contentId,
            subId,
        });

        // ---- 1) Check duplicates (username/phone/email) ----
        pmoConnection.query(
            `SELECT 1 FROM EMPLOY_REGISTRATION 
       WHERE USERNAME = ? OR PHONE = ? OR EMAIL = ?
       LIMIT 1`,
            [username, phoneStr, emailStr],
            (dupeErr, dupeRows) => {
                if (dupeErr) {
                    console.error("DB error (dup check):", dupeErr);
                    return res.status(500).json({ error: "Database error" });
                }

                if (dupeRows && dupeRows.length > 0) {
                    return res
                        .status(409)
                        .json({ error: "User already exists" });
                }

                // ---- 2) Next Firm ID ----
                pmoConnection.query(
                    "SELECT MAX(FIRM_ID) AS maxFirmId FROM EMPLOY_REGISTRATION",
                    (maxErr, maxRows) => {
                        if (maxErr) {
                            console.error("DB error (firm id):", maxErr);
                            return res
                                .status(500)
                                .json({ error: "Database error" });
                        }

                        // const newFirmId = (maxRows?.[0]?.maxFirmId || 0) + 1;
                        const newFirmId = 5;

                        // ---- 3) Insert ----
                        const insertSql = `
              INSERT INTO EMPLOY_REGISTRATION 
              (EMPNAME, USERNAME, PASSWORD, FIRM_ID, PHONE, EMAIL, 
               APPDATE, CREATED_DATE, STATUS, HOME_PORTALID, 
               CONTENT_CATEGORY_ID, USER_SUB_CATEGORY_ID)
              VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 'Inactive', ?, ?, ?)
            `;

                        const params = [
                            name.trim(),
                            username,
                            key.trim(),
                            newFirmId,
                            phoneStr,
                            emailStr,
                            portalid,
                            contentId, // INT (main / content category id)
                            subId, // INT (user subcategory id)
                        ];

                        console.log("Insert params:", params);

                        pmoConnection.query(
                            insertSql,
                            params,
                            (insErr, result) => {
                                if (insErr) {
                                    console.error("DB error (insert):", insErr);
                                    return res
                                        .status(500)
                                        .json({ error: "Registration failed" });
                                }

                                return res.status(201).json({
                                    message: "Registration successful",
                                    firmId: newFirmId,
                                    empId: result?.insertId,
                                });
                            }
                        );
                    }
                );
            }
        );
    } catch (e) {
        console.error("Unexpected error (signup):", e);
        if (!res.headersSent) {
            return res.status(500).json({ error: "Server error" });
        }
    }
});

app.get("/get/firms", (req, res) => {
    connection.query(
        "SELECT FIRM_ID, FIRM_NAME FROM FIRM_DETAILS",

        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            res.json(results);
        }
    );
});

app.get("/get/inactive/users", (req, res) => {
    const firmid = req.query.firmid; // Retrieve userid from URL query parameters
    console.log("UserID:", firmid);

    pmoConnection.query(
        `SELECT * FROM EMPLOY_REGISTRATION where STATUS='Inactive' && FIRM_ID=${firmid}`,

        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            res.json(results);
        }
    );
});

app.get("/get/emails", (req, res) => {
    const userid = req.query.userid; // Retrieve userid from URL query parameters
    console.log("UserID:", userid);
    const firmid = req.query.firmid; // Retrieve userid from URL query parameters
    console.log("firmid:", firmid);

    // Use the retrieved userid in your query logic
    connection.query(
        `SELECT E_ID,EMAIL FROM EMAIL_CAMPAIGNING_LIST WHERE USERID = ? AND FIRMID = ? AND STATUS = 'Active'`,
        [userid, firmid],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            res.json(results);
        }
    );
});

app.get("/get/myemailinfo", (req, res) => {
    const userid = req.query.userid;
    console.log("UserID:", userid);
    const firmid = req.query.firmid;
    console.log("FirmID:", firmid);

    connection.query(
        `SELECT * FROM USER_EMAIL_DETAILS WHERE USERID = ? AND FIRMID = ? AND STATUS='Active'`,
        [userid, firmid],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            if (results.length === 1) {
                // If there is exactly one result, send it as a JSON response
                res.json(results);
            } else {
                // If no results or multiple results, send a response indicating that the email ID does not exist
                res.status(404).json({ error: "Email ID does not exist" });
            }
        }
    );
});

// app.post('/bulk-send-email', (req, res) => {
//     const { to, subject, html, email, password, host, port, secure, firmid, userid } = req.body;
//     console.log("test", req.body)

//     const transporter = nodemailer.createTransport({
//         //service: 'gmail',
//         host: host,
//         port: port,
//         secure: secure,
//         auth: {

//             user: email,
//             pass: password
//         },
//         // tls: {
//         //     rejectUnauthorized: false,
//         // },

//         logger: true,
//         debug: true,

//     });

//     const mailOptions = {
//         from: email,
//         to: to,
//         subject: subject,
//         html: html
//     };

//     transporter.sendMail(mailOptions, (error, info) => {
//         if (error) {
//             return res.status(500).send(error.toString());
//         }
//         //res.status(200).send('Email sent: ' + info.response);

//         const query = 'INSERT INTO USER_EMAIL_HISTORY (USERID, FIRMID, MAIL_FROM,MAIL_TO,SUBJECT,CONTENT,INSRT_DTM) VALUES (?, ?, ?, ?, ?, ?,NOW())'

//         connection.query(query, [userid, firmid, email, to, subject, html], (error, results, fields) => {
//             if (error) {
//                 console.error('Error:', error);

//             } else {
//                 console.log("results", results)
//                 res.status(200).json({ message: `Email has been Sent to ${to}` });

//             }
//         });
//     });
// });

app.post("/bulk-send-email", (req, res) => {
    const {
        to,
        subject,
        html,
        email,
        password,
        host,
        port,
        secure,
        firmid,
        userid,
        groupID,
        batchNum,
    } = req.body;

    const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure,
        auth: {
            user: email,
            pass: password,
        },
        tls: {
            rejectUnauthorized: false,
        },
        logger: true,
        debug: true,
    });

    const mailOptions = {
        from: email,
        to: to,
        subject: subject,
        html: html,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }

        // Insert email details with the provided batch number
        const insertQuery = `
            INSERT INTO USER_EMAIL_HISTORY 
            (USERID, FIRMID, MAIL_FROM, MAIL_TO, SUBJECT, CONTENT, GROUPID, BATCH_NUM, INSRT_DTM) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

        connection.query(
            insertQuery,
            [userid, firmid, email, to, subject, html, groupID, batchNum],
            (error, results) => {
                if (error) {
                    console.error("Error inserting email history:", error);
                    return res
                        .status(500)
                        .send("Error inserting email history");
                } else {
                    res.status(200).json({
                        message: `Email has been sent to ${to} with Batch Number ${batchNum}`,
                    });
                }
            }
        );
    });
});

app.get("/get/next-batch-number", (req, res) => {
    const { groupID } = req.query;

    if (!groupID) {
        return res.status(400).json({ error: "groupID is required" });
    }

    // Step 1: Check for the last batch number for the given groupID
    const checkBatchQuery =
        "SELECT MAX(BATCH_NUM) as maxBatch FROM USER_EMAIL_HISTORY WHERE GROUPID = ?";

    connection.query(checkBatchQuery, [groupID], (err, result) => {
        if (err) {
            console.error("Error fetching batch number:", err);
            return res.status(500).send("Error fetching batch number");
        }

        // Step 2: Determine the next batch number
        let nextBatchNum = 1; // Default to 1 if no batch exists
        if (result[0].maxBatch !== null) {
            nextBatchNum = result[0].maxBatch + 1; // Increment the last batch number
        }

        // Step 3: Send the next batch number in the response
        res.status(200).json({ batchNum: nextBatchNum });
    });
});

// app.post('/load/emails', (req, res) => {
//     const { uniqueEmails, userid, firmid } = req.body;

//     connection.beginTransaction((err) => {
//         if (err) {
//             console.error('Error starting transaction:', err);
//             res.status(500).send(err);
//             return;
//         }

//         // Execute each INSERT statement in the transaction
//         uniqueEmails.forEach((email) => {
//             const insertQuery = `INSERT INTO EMAIL_CAMPAIGNING_LIST (USERID, FIRMID, EMAIL) VALUES (?, ?, ?)`;
//             const values = [userid, firmid, email];

//             connection.query(insertQuery, values, (err, result) => {
//                 if (err) {
//                     console.error('Error inserting email into the database:', err);
//                     // Rollback the transaction on error
//                     connection.rollback(() => {
//                         res.status(500).send(err);
//                     });
//                 } else {
//                     console.log('Email inserted into the database successfully');
//                 }
//             });
//         });

//         // Commit the transaction
//         connection.commit((err) => {
//             if (err) {
//                 console.error('Error committing transaction:', err);
//                 // Rollback the transaction on error
//                 connection.rollback(() => {
//                     res.status(500).send(err);
//                 });
//             } else {
//                 console.log('Transaction committed successfully');
//                 res.status(200).send('Emails inserted into the database successfully');
//             }
//         });
//     });

// })

// Modified endpoint to handle email insertion with group ID
app.post("/load/emails", (req, res) => {
    const { uniqueEmails, userid, firmid, groupId } = req.body;

    console.log("UserID:", userid);
    console.log("FirmID:", firmid);

    connection.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            res.status(500).send(err);
            return;
        }

        // Execute each INSERT statement in the transaction
        uniqueEmails.forEach((email) => {
            const insertQuery = `INSERT INTO EMAIL_CAMPAIGNING_LIST (USERID, FIRMID, EMAIL, GROUP_ID) VALUES (?, ?, ?, ?)`;
            const values = [userid, firmid, email, groupId]; // Include group ID in the values

            connection.query(insertQuery, values, (err) => {
                if (err) {
                    console.error(
                        "Error inserting email into the database:",
                        err
                    );
                    // Rollback the transaction on error
                    db.rollback(() => {
                        res.status(500).send(err);
                    });
                } else {
                    console.log(
                        "Email inserted into the database successfully"
                    );
                }
            });
        });

        // Commit the transaction
        connection.commit((err) => {
            if (err) {
                console.error("Error committing transaction:", err);
                // Rollback the transaction on error
                connection.rollback(() => {
                    res.status(500).send(err);
                });
            } else {
                console.log("Transaction committed successfully");
                res.status(200).send(
                    "Emails inserted into the database successfully"
                );
            }
        });
    });
});

app.post("/add/sender/email", (req, res) => {
    const { userid, firmid, email, password } = req.body;
    const INSERT_QUERY = `INSERT INTO USER_EMAIL_DETAILS (USERID, FIRMID, EMAIL, PASSWORD) VALUES (?, ?, ?, ?)`;
    const values = [userid, firmid, email, password];

    connection.query(INSERT_QUERY, values, (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send("Data inserted successfully");
        }
    });
});

app.get("/get/mytemplates", (req, res) => {
    const userid = req.query.userid;
    console.log("UserID:", userid);
    const firmid = req.query.firmid;
    console.log("FirmID:", firmid);

    connection.query(
        "SELECT * FROM USER_EMAIL_TEMPLATES WHERE USERID = ? AND FIRMID = ?",
        [userid, firmid],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            } else {
                // If there is exactly one result, send it as a JSON response
                res.json(results);
            }
        }
    );
});

app.post("/save/current/template", (req, res) => {
    const { userid, firmid, emailSubject, emailContent } = req.body;
    const INSERT_QUERY = `INSERT INTO USER_EMAIL_TEMPLATES (USERID, FIRMID, SUBJECT, CONTENT,INSRT_DTM) VALUES (?, ?, ?, ?,NOW())`;
    const values = [userid, firmid, emailSubject, emailContent];

    connection.query(INSERT_QUERY, values, (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send("Data inserted successfully");
        }
    });
});

app.delete("/delete/template/:templateId", (req, res) => {
    const templateId = req.params.templateId;
    const DELETE_QUERY = "DELETE FROM USER_EMAIL_TEMPLATES WHERE T_ID = ?";

    connection.query(DELETE_QUERY, [templateId], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            if (result.affectedRows > 0) {
                res.status(200).send("Data deleted successfully");
            } else {
                res.status(404).send("Template not found");
            }
        }
    });
});

// New endpoint to handle group creation
// app.post("/load/groups", (req, res) => {
//     const { groupName,userid,firmid } = req.body;

//     const insertGroupQuery = `INSERT INTO EMAIL_GROUPS (GROUP_NAME,USERID,FIRMID) VALUES (?,?,?)`;
//     connection.query(insertGroupQuery, [groupName,userid,firmid], (err, result) => {
//       if (err) {
//         console.error("Error inserting group into the database:", err);
//         return res.status(500).send(err);
//       }
//       const groupId = result.insertId; // Get the ID of the newly created group
//       res.status(200).send({ groupId }); // Send back the group ID
//     });
//   });

app.post("/load/groups", (req, res) => {
    const { groupName, userid, firmid } = req.body;

    // First, check if the group name already exists for the same userid and firmid
    const checkGroupQuery = `SELECT * FROM EMAIL_GROUPS WHERE GROUP_NAME = ? AND USERID = ? AND FIRMID = ?`;
    connection.query(
        checkGroupQuery,
        [groupName, userid, firmid],
        (err, results) => {
            if (err) {
                console.error("Error checking group in the database:", err);
                return res.status(500).send(err);
            }

            if (results.length > 0) {
                // If group name already exists, send a response to the frontend
                return res.status(400).send({
                    message:
                        "Group name already exists. Please use another name.",
                });
            }

            // If no duplicates found, insert the new group into the database
            const insertGroupQuery = `INSERT INTO EMAIL_GROUPS (GROUP_NAME, USERID, FIRMID) VALUES (?, ?, ?)`;
            connection.query(
                insertGroupQuery,
                [groupName, userid, firmid],
                (err, result) => {
                    if (err) {
                        console.error(
                            "Error inserting group into the database:",
                            err
                        );
                        return res.status(500).send(err);
                    }
                    const groupId = result.insertId; // Get the ID of the newly created group
                    res.status(200).send({ groupId }); // Send back the group ID
                }
            );
        }
    );
});

app.get("/getEmailsByGroupId/:groupId", (req, res) => {
    const groupId = req.params.groupId;

    const query = `
        SELECT * 
        FROM EMAIL_CAMPAIGNING_LIST 
        WHERE GROUP_ID = ? AND STATUS = 'Active';
    `;

    connection.query(query, [groupId], (error, results) => {
        if (error) {
            console.error("Error fetching emails:", error);
            res.status(500).send("Server error");
        } else {
            res.json(results);
        }
    });
});

app.get("/api/user-email-details", (req, res) => {
    const { userid, firmid } = req.query; // Use req.query to access query parameters

    // Ensure that both userid and firmid are provided
    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ error: "userid and firmid are required" });
    }

    // Use parameterized query to prevent SQL injection
    const query =
        "SELECT * FROM USER_EMAIL_DETAILS WHERE USERID = ? AND FIRMID = ?";

    // Pass userid and firmid as parameters
    connection.query(query, [userid, firmid], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Fetch all email details
app.post("/api/user-email-details/update-status", (req, res) => {
    const { emId } = req.body;

    console.log("emId", emId);

    // Fetch USERID and FIRMID based on the given EM_ID
    const fetchQuery =
        "SELECT USERID, FIRMID FROM USER_EMAIL_DETAILS WHERE EM_ID = ?";
    connection.query(fetchQuery, [emId], (err, results) => {
        if (err || results.length === 0)
            return res.status(500).json({ error: err.message });

        const { USERID, FIRMID } = results[0];

        // Set the current row to 'Active' and others with the same USERID and FIRMID to 'Inactive'
        const updateQuery = `
              UPDATE USER_EMAIL_DETAILS
              SET STATUS = CASE WHEN EM_ID = ? THEN 'Active' ELSE 'Inactive' END
              WHERE USERID = ? AND FIRMID = ?`;

        connection.query(
            updateQuery,
            [emId, USERID, FIRMID],
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Status updated successfully!" });
            }
        );
    });
});

// const bcrypt = require("bcrypt");
// // Define the salt rounds for bcrypt
// const saltRounds = 10;

// POST route to insert email data into MySQL
// app.post("/insert-email", (req, res) => {
//     const { EMAIL, PASSWORD, HOST, PORT, SECURE, USERID, FIRMID } = req.body;

//     // Log received data for debugging
//     console.log("Received data:", req.body);

//     // Hash the password using bcrypt
//     // bcrypt.hash(PASSWORD, saltRounds, (err, hashedPassword) => {
//     //   if (err) {
//     //     console.error("Error hashing password:", err);
//     //     return res.status(500).send("Error hashing password");
//     //   }

//       // SQL query to insert data into MySQL
//       const query = `INSERT INTO USER_EMAIL_DETAILS (USERID, FIRMID, EMAIL, PASSWORD, HOST, PORT, SECURE)
//                      VALUES (?, ?, ?, ?, ?,?,?)`;

//       // Execute the SQL query
//       connection.query(
//         query,
//         [USERID, FIRMID, EMAIL, PASSWORD, HOST, PORT, SECURE],
//         (err, result) => {
//           if (err) {
//             console.error("Error inserting data into MySQL:", err); // Log the error
//             return res.status(500).send("Error inserting data into MySQL");
//           }
//           res.status(200).send("Data inserted successfully!");
//         }
//       );
//     // });
//   });

app.post("/insert-email", (req, res) => {
    const { EMAIL, PASSWORD, HOST, PORT, SECURE, USERID, FIRMID } = req.body;

    // Log received data for debugging
    console.log("Received data:", req.body);

    // Hash the password using bcrypt (Uncomment and implement this section if needed)
    // bcrypt.hash(PASSWORD, saltRounds, (err, hashedPassword) => {
    //   if (err) {
    //     console.error("Error hashing password:", err);
    //     return res.status(500).send("Error hashing password");
    //   }

    // SQL query to insert data into MySQL
    const insertQuery = `INSERT INTO USER_EMAIL_DETAILS (USERID, FIRMID, EMAIL, PASSWORD, HOST, PORT, SECURE) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;

    // Execute the SQL insert query
    connection.query(
        insertQuery,
        [USERID, FIRMID, EMAIL, PASSWORD, HOST, PORT, SECURE],
        (err, result) => {
            if (err) {
                console.error("Error inserting data into MySQL:", err); // Log the error
                return res.status(500).send("Error inserting data into MySQL");
            }

            const emId = result.insertId; // Get the inserted ID for the new email entry

            // Now update the status for the user and firm
            const updateQuery = `
              UPDATE USER_EMAIL_DETAILS
              SET STATUS = CASE 
                  WHEN EM_ID = ? THEN 'Active' 
                  ELSE 'Inactive' 
              END
              WHERE USERID = ? AND FIRMID = ?`;

            // Execute the SQL update query
            connection.query(updateQuery, [emId, USERID, FIRMID], (err) => {
                if (err) {
                    console.error("Error updating status in MySQL:", err);
                    return res
                        .status(500)
                        .send("Error updating status in MySQL");
                }

                res.status(200).send(
                    "Data inserted and status updated successfully!"
                );
            });
        }
    );
});

// app.get('/api/emails/grouped', (req, res) => {
//     const sqlQuery = `
//         SELECT BATCH_NUM, GROUPID, MAIL_FROM, MAIL_TO, SUBJECT, CONTENT
//         FROM USER_EMAIL_HISTORY
//         ORDER BY BATCH_NUM, GROUPID`;

//         connection.query(sqlQuery, (err, result) => {
//         if (err) throw err;
//         res.send(result);
//     });
// });

// app.get('/api/emails/grouped', (req, res) => {
//     const sqlQuery = `
//         SELECT BATCH_NUM, GROUPID, MAIL_FROM, MAIL_TO, SUBJECT, CONTENT, COUNT(*) as email_count
//         FROM USER_EMAIL_HISTORY
//         GROUP BY BATCH_NUM, GROUPID, SUBJECT, CONTENT
//         ORDER BY BATCH_NUM, GROUPID`;

//     connection.query(sqlQuery, (err, result) => {
//         if (err) throw err;
//         res.send(result);
//     });
// });

// app.get('/api/emails/grouped', (req, res) => {
//     const sqlQuery = `
//         SELECT BATCH_NUM, GROUPID,
//                GROUP_CONCAT(MAIL_FROM) AS MAIL_FROM_LIST,
//                GROUP_CONCAT(MAIL_TO) AS MAIL_TO_LIST,
//                SUBJECT, CONTENT, COUNT(*) AS email_count
//         FROM USER_EMAIL_HISTORY
//         GROUP BY BATCH_NUM, GROUPID, SUBJECT, CONTENT
//         ORDER BY BATCH_NUM, GROUPID`;

//     connection.query(sqlQuery, (err, result) => {
//         if (err) throw err;
//         res.send(result);
//     });
// });

app.get("/api/emails/grouped", (req, res) => {
    const sqlQuery = `
        SELECT ueh.BATCH_NUM, ueh.GROUPID, 
               eg.GROUP_NAME,
               GROUP_CONCAT(ueh.MAIL_FROM) AS MAIL_FROM_LIST, 
               GROUP_CONCAT(ueh.MAIL_TO) AS MAIL_TO_LIST, 
               ueh.SUBJECT, ueh.CONTENT, COUNT(*) AS email_count 
        FROM USER_EMAIL_HISTORY ueh
        JOIN EMAIL_GROUPS eg ON ueh.GROUPID = eg.GROUP_ID
        GROUP BY ueh.BATCH_NUM, ueh.GROUPID, eg.GROUP_NAME, ueh.SUBJECT, ueh.CONTENT 
        ORDER BY ueh.BATCH_NUM, ueh.GROUPID`;

    connection.query(sqlQuery, (err, result) => {
        if (err) throw err;
        res.send(result);
    });
});

app.get("/api/emailslist", (req, res) => {
    const { groupId, firmId, userId } = req.query;

    if (!groupId || !firmId || !userId) {
        return res.status(400).json({ message: "Missing parameters" });
    }

    const sql = `SELECT E_ID, EMAIL, STATUS FROM EMAIL_CAMPAIGNING_LIST WHERE GROUP_ID = ? AND FIRMID = ? AND USERID = ? `;
    connection.query(sql, [groupId, firmId, userId], (err, results) => {
        if (err) {
            return res
                .status(500)
                .json({ message: "Database error", error: err });
        }
        res.json(results);
    });
});

//   app.put('/api/emails/inactive/:id', (req, res) => {
//     const emailId = req.params.id;

//     const sql = 'UPDATE EMAIL_CAMPAIGNING_LIST SET STATUS = ? WHERE E_ID = ?';
//     connection.query(sql, ['Inactive', emailId], (err, results) => {
//       if (err) {
//         return res.status(500).json({ message: 'Database error', error: err });
//       }
//       res.json({ message: 'Email status updated to Inactive' });
//     });
//   });

// Endpoint to set an email status
app.put("/api/emails/status/:id", (req, res) => {
    const emailId = req.params.id;
    const { status } = req.body; // Expecting status in the request body

    if (status !== "Active" && status !== "Inactive") {
        return res.status(400).json({
            message: 'Invalid status value. Must be "Active" or "Inactive".',
        });
    }

    const sql = "UPDATE EMAIL_CAMPAIGNING_LIST SET STATUS = ? WHERE E_ID = ?";
    connection.query(sql, [status, emailId], (err, results) => {
        if (err) {
            return res
                .status(500)
                .json({ message: "Database error", error: err });
        }
        res.json({ message: `Email status updated to ${status}` });
    });
});

// app.get('/api/emails/sent', (req, res) => {
//     const groupId = req.query.groupid;
//     const batchNum = req.query.batch;

//     // Query to fetch emails based on groupid and batch
//     const query = `
//         SELECT MAIL_FROM AS MAIL_FROM_LIST,
//                MAIL_TO AS MAIL_TO_LIST,
//                SUBJECT,
//                CONTENT
//         FROM USER_EMAIL_HISTORY
//         WHERE GROUPID = ? AND BATCH_NUM = ?`;

//     connection.query(query, [groupId, batchNum], (error, results) => {
//         if (error) {
//             console.error('Error fetching emails:', error);
//             return res.status(500).json({ error: 'Internal server error' });
//         }
//         res.json(results);
//     });
// });

app.get("/get/businessuser/details", (req, res) => {
    const empid = req.query.empid;
    console.log("empid:", empid);

    pmoConnection.query(
        "SELECT * FROM EMPLOY_REGISTRATION WHERE EMPID = ? ",
        [empid],
        (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Internal Server Error" });
            } else {
                // If there is exactly one result, send it as a JSON response
                res.json(results);
            }
        }
    );
});

app.post("/activate/user", (req, res) => {
    const { empid, designation, roleid } = req.body;

    console.log("test", req.body);

    const QUERY = `UPDATE EMPLOY_REGISTRATION SET DESIGNATION= ?,Employee_Level=?,STATUS=? WHERE EMPID = ?`;
    //console.log(QUERY )
    pmoConnection.query(
        QUERY,
        [designation, roleid, "Active", empid],
        (err, result) => {
            //console.log(result);
            if (err) {
                res.send(err);
            } else {
                res.send("Updated");
            }
        }
    );
});

app.post("/techieindex/signup/details", (req, res) => {
    try {
        // Retrieve the values from the request body
        const { name, id, key, phone, email, type } = req.body;

        console.log("req.body", req.body);

        // Check if the user with the given email already exists
        if (email !== undefined && email !== null && email !== "") {
            connection.query(
                "SELECT * FROM TECHIEINDEX_USER WHERE EMAIL = ?",
                [email],
                (error, userRows) => {
                    if (error) {
                        console.error(error);
                        return res
                            .status(500)
                            .json({ error: "Internal Server Error" });
                    }

                    console.log("userRows", userRows);

                    if (userRows && userRows.length > 0) {
                        // User found, send found response
                        return res
                            .status(403)
                            .json({ message: "User found", user: userRows[0] });
                    } else {
                        // User not found, insert the new user into the database
                        insertUser();
                    }
                }
            );
        } else {
            // If email is empty, insert the new user into the database directly
            insertUser();
        }

        function insertUser() {
            connection.query(
                `INSERT INTO TECHIEINDEX_USER (NAME, USERNAME, PASSWORD, PHONE, EMAIL, CREATED_DATE, USER_TYPE,STATUS)
                VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
                [name, id, key, phone, email, type, "Inactive"],
                (insertError, result) => {
                    if (insertError) {
                        console.error(insertError);
                        return res
                            .status(500)
                            .json({ error: "Internal Server Error" });
                    }
                    const insertedUserId = result.insertId;
                    console.log("insertedUserId", insertedUserId);
                    res.status(201).json({
                        message: "Data added successfully",
                        insertedUserId,
                    });
                }
            );
        }
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/activate/techieindex/user", (req, res) => {
    const { id } = req.body;

    console.log("test", req.body);

    const QUERY = `UPDATE TECHIEINDEX_USER SET STATUS=? WHERE ID = ?`;
    //console.log(QUERY )
    connection.query(QUERY, ["Active", id], (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send("Activated");
        }
    });
});

app.post("/techieindex/activation/email", (req, res) => {
    const { to, subject, html, fromemail, password } = req.body;
    console.log("test", req.body);

    const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            // TODO: replace `user` and `pass` values from <https://forwardemail.net>
            user: fromemail,
            pass: password,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const mailOptions = {
        from: fromemail,
        to: to,
        subject: subject,
        html: html,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }
        //res.status(200).send('Email sent: ' + info.response);
        res.status(200).json({ message: `Email has been Sent to ${to}` });
    });
});

app.post("/upload/multiple/images", upload.array("images", 200), (req, res) => {
    // 'images' should match the field name in the FormData on the client side
    const files = req.files;

    const { userid, portalid, firmid } = req.body;

    if (!files) {
        return res.status(400).json({ message: "No files uploaded" });
    }

    const getMaxUserIdQuery = `SELECT MAX(MULTIPLE_IMAGE_ID) AS maxUserId FROM image_upload`;

    connection.query(getMaxUserIdQuery, (err, result) => {
        if (err) {
            return res.send(err);
        }

        let maxUserId = 0; // Default value if there are no valid rows in the result
        if (result.length > 0 && result[0].maxUserId !== null) {
            maxUserId = result[0].maxUserId;
        }

        const newUserId = maxUserId + 1;

        files.forEach((file, index) => {
            const tempFilePath = file.path;

            //console.log("tempFilePath", tempFilePath)

            const imagePathNew = tempFilePath.replace(/\\/g, "/");
            const imagePathNew1 = imagePathNew.replace(
                "/var/www/rafalin/mongo_react",
                ""
            );
            const imagePathWithPrefix = `..${imagePathNew1}`;

            //console.log("path", imagePathWithPrefix)

            const query = `INSERT INTO image_upload (image,userid,portalid,FIRMID,MULTIPLE_IMAGE_ID,DATE) VALUES ( ?,?, ?, ?, ?, NOW())`;

            connection.query(
                query,
                [imagePathWithPrefix, userid, portalid, firmid, newUserId],
                (err, result) => {
                    if (err) {
                        console.error(
                            "Error inserting data into the database:",
                            err
                        );
                        res.sendStatus(500);
                    } else {
                        const CALL_SP_QUERY = `CALL SP_InsertIntoActPointDly(${userid}, 2, ${portalid})`;

                        connection.query(CALL_SP_QUERY, (spErr, spResult) => {
                            if (spErr) {
                                return res.send(spErr);
                            } else {
                                console.log(
                                    "tempFilePath",
                                    imagePathWithPrefix
                                );
                            }
                        });
                    }
                }
            );
        });

        console.log("newUserId", newUserId);
        res.json({
            message: "Files uploaded successfully",
            newUserId: newUserId,
        });
    });
});

app.post("/multipleimages/get/image/link", (req, res) => {
    console.log("req.body.mid", req.body.mid);

    const QUERY = `SELECT * from  image_upload where MULTIPLE_IMAGE_ID=${req.body.mid} `;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        console.log("result", result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

// app.post('/smp/scheduling', async (req, res) => {

//     const url = req.body.url;
//     const sdate = req.body.sdate;
//     const stime = req.body.stime;
//     const userid = req.body.userid;
//     const firmid = req.body.firmid;

//     //console.log("encodedUrlVal", encodedUrlVal)
//     //const command = `python "/home/rafalin/smp_scheduler/facebook_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" `;
//     const command = `python3.7 "/home/rafalin/smp_scheduler/facebook_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" `;

//     //exec(command, (error, stdout, stderr)
//     exec(command, (error, stdout, stderr) => {
//         if (error) {
//             console.error(`Error executing Python script: ${error.message}`);
//             return res.status(500).json({ error: 'Internal server error' });
//         }
//         if (stderr) {
//             console.error(`Python script returned an error: ${stderr}`);
//             return res.status(400).json({ error: 'Bad request' });
//         }
//         console.log(`Python script output: ${stdout}`);
//         res.send(stdout)
//     })
// });

// app.post('/smp/scheduling', async (req, res) => {
//     try {
//         const url = req.body.url;
//         const sdate = req.body.sdate;
//         const stime = req.body.stime;
//         const userid = req.body.userid;
//         const firmid = req.body.firmid;

//         //const command = `python3.7 "C:/Users/b2/Desktop/react myblock.in/react trainee/smp_scheduler/facebook_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" `;
//         const command = `python3.7 "/home/rafalin/smp_scheduler/facebook_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" `;

//         const { stdout, stderr } = await exec(command);
//         console.log(`Python script output: ${stdout}`);
//         res.send(stdout);
//     } catch (error) {
//         console.error(`Error executing Python script: ${error.message}`);
//         return res.status(500).json({ error: 'Internal server error' });
//     }
// });

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

app.post("/smp/scheduling", async (req, res) => {
    try {
        const url = req.body.url;
        const sdate = req.body.sdate;
        const stime = req.body.stime;
        const userid = req.body.userid;
        const firmid = req.body.firmid;
        const image = req.body.image;
        const bardStory = req.body.bardStory;
        const type = req.body.type;
        let command = "";

        if (type === "facebook") {
            //command = `python "C:/Users/b2/Desktop/react myblock.in/react trainee/smp_scheduler/facebook_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" "${image}" "${bardStory}"  `;
            command = `python3.7 "/home/rafalin/smp_scheduler/facebook_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" "${image}" "${bardStory}" `;
        } else if (type === "instagram") {
            //command = `python "C:/Users/b2/Desktop/react myblock.in/react trainee/smp_scheduler/instagram_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" "${image}" "${bardStory}"  `;
            command = `python3.7 "/home/rafalin/smp_scheduler/instagram_scheduling_main.py" "${url}" "${sdate}" "${stime}" "${userid}" "${firmid}" `;
        }
        const { stdout, stderr } = await executeCommand(command);
        console.log(`Python script output: ${stdout}`);
        // res.send(stdout);
        res.send("Scheduled");
    } catch (error) {
        console.error(`Error executing Python script: ${error.message}`);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/canada-univ", (req, res) => {
    // Use the MySQL connection pool to execute a query to fetch all data
    connection.query(
        `SELECT * FROM RANKING WHERE Categry = 'University canada' ORDER BY Ranking;`,
        (error, results) => {
            if (error) {
                console.error("Error executing query:", error);
                res.status(500).send("Internal Server Error");
            } else {
                console.log("Fetched all data successfully:", results);
                res.json(results);
            }
        }
    );
});

// Endpoint to fetch all H1B visa list
app.get("/H1b", (req, res) => {
    // Use the MySQL connection pool to execute a query to fetch all data
    connection.query(
        `SELECT * FROM RANKING WHERE Categry = 'h1b' ORDER BY Ranking`,
        (error, results) => {
            if (error) {
                console.error("Error executing query:", error);
                res.status(500).send("Internal Server Error");
            } else {
                console.log("Fetched all data successfully:", results);
                res.json(results);
            }
        }
    );
});

// Endpoint to fetch all USA VC FIRMS
app.get("/UsaVC", (req, res) => {
    // Use the MySQL connection pool to execute a query to fetch all data
    connection.query(
        `SELECT * FROM RANKING WHERE Categry = 'Usa VC firm' ORDER BY Ranking;`,
        (error, results) => {
            if (error) {
                console.error("Error executing query:", error);
                res.status(500).send("Internal Server Error");
            } else {
                console.log("Fetched all data successfully:", results);
                res.json(results);
            }
        }
    );
});

app.post("/mysqlformat/local/vendorcategory/list", (req, res) => {
    // Define the MySQL query
    const query = `
        SELECT 
            CONFIG_ID, 
            CONFIG_DES, 
            CFG_PRNT_CD, 
            IMAGE 
        FROM 
            kf_doc_config 
        WHERE 
            DOC_CATEGRY_ID = 122 
        ORDER BY 
            CONFIG_ID DESC 
        LIMIT 4
    `;

    // Execute the query
    connection_trn.query(query, (error, results) => {
        if (error) {
            console.error("Error executing MySQL query:", error);
            res.status(500).json({
                message: "An error occurred while processing your request.",
            });
        } else {
            res.send(results);
        }
    });
});

app.post("/mysqlformat/local/vendorcategory/list/all", (req, res) => {
    // Define the MySQL query
    const query = `
        SELECT 
            CONFIG_ID, 
            CONFIG_DES, 
            CFG_PRNT_CD, 
            IMAGE 
        FROM 
            kf_doc_config 
        WHERE 
            DOC_CATEGRY_ID = 122 
        ORDER BY 
            CONFIG_ID DESC 
        
    `;

    // Execute the query
    connection_trn.query(query, (error, results) => {
        if (error) {
            console.error("Error executing MySQL query:", error);
            res.status(500).json({
                message: "An error occurred while processing your request.",
            });
        } else {
            res.send(results);
        }
    });
});

// app.get('/myblocks/startups', (req, res) => {
//     const site = req.query.site.toUpperCase(); // Convert the `site` parameter to uppercase
//     const portal = req.query.portal;
//     const cat_code = req.query.cat_code;
//     console.log('Site parameter:', site);
//     console.log('portal parameter:', portal);
//     console.log('cat_code parameter:', cat_code);

//     // Define the query
//     const query = `
//         SELECT
//             ST_ID,
//             Ranking,
//             employees,
//             company_name,
//             url,
//             city,
//             state,
//             country,
//             linkedin_url,
//             founded,
//             industry,
//             total_funding,
//             indeed_url,
//             growth_percentage
//         FROM
//             RANKING
//         WHERE
//             CATEGORY_ID = ?
//         and
//             PORTAL_ID = ?
//         and
//             UPPER(SITE_TYPE) LIKE ?
//         ORDER BY
//             Ranking
//     `;

//     // Use `%` for flexible pattern matching (partial match for site)
//     connection_trn.query(query, [cat_code,portal,`%${site}%`], (error, results) => {
//         if (error) {
//             console.error('Error executing query:', error);
//             res.status(500).send('Internal Server Error');
//         } else {
//             // console.log('Fetched all data successfully:', results);
//             res.json(results);
//         }
//     });
// });

// app.get('/myblocks/startups', (req, res) => {
//     const site = req.query.site.toUpperCase(); // Convert the `site` parameter to uppercase
//     const portal = req.query.portal;
//     const cat_code = req.query.cat_code;
//     console.log('Site parameter:', site);
//     console.log('portal parameter:', portal);
//     console.log('cat_code parameter:', cat_code);

//     // Define the query
//     const query = `
//         SELECT
//             r.ST_ID,
//             r.Ranking,
//             r.employees,
//             r.company_name,
//             r.url,
//             r.city,
//             r.state,
//             r.country,
//             r.linkedin_url,
//             r.founded,
//             r.industry,
//             r.total_funding,
//             r.indeed_url,
//             r.growth_percentage,
//             v.FB_FOLLOWER_COUNT,
//             v.FB_PAGE_URL,
//             v.INSTA_PAGE_URL,
//             v.INSTA_FOLLOWER_COUNT
//         FROM
//             RANKING r
//         LEFT JOIN
//             kf_vendor v
//         ON
//             r.VEND_ID = v.VEND_ID
//         WHERE
//             r.CATEGORY_ID = ?
//         AND
//             r.PORTAL_ID = ?
//         AND
//             UPPER(r.SITE_TYPE) LIKE ?
//         ORDER BY
//             r.Ranking
//     `;

//     // Use `%` for flexible pattern matching (partial match for site)
//     connection_trn.query(query, [cat_code, portal, `%${site}%`], (error, results) => {
//         if (error) {
//             console.error('Error executing query:', error);
//             res.status(500).send('Internal Server Error');
//         } else {
//             res.json(results);
//         }
//     });
// });

app.get("/myblocks/startups", (req, res) => {
    const site = req.query.site.toUpperCase(); // Convert the `site` parameter to uppercase
    const portal = req.query.portal;
    const cat_code = req.query.cat_code;
    console.log("Site parameter:", site);
    console.log("portal parameter:", portal);
    console.log("cat_code parameter:", cat_code);

    // Define the query
    const query = `
        SELECT 
            r.ST_ID, 
            r.Ranking, 
            r.employees, 
            r.company_name, 
            r.url, 
            r.city, 
            r.state, 
            r.country, 
            r.linkedin_url, 
            r.founded, 
            r.industry, 
            r.total_funding, 
            r.indeed_url, 
            r.growth_percentage,
            v.FB_FOLLOWER_COUNT, 
            v.FB_PAGE_URL, 
            v.INSTA_PAGE_URL, 
            v.INSTA_FOLLOWER_COUNT,
            v.LINKEDIN_PAGE_URL,
            v.LINKEDIN_FOLLOWER_COUNT

        FROM 
            RANKING r
        LEFT JOIN 
            kf_vendor v
        ON 
            r.VEND_ID = v.VEND_ID
        WHERE
            r.CATEGORY_ID = ?
        AND
            r.PORTAL_ID = ?
        AND         
            UPPER(r.SITE_TYPE) LIKE ?
        ORDER BY 
            r.Ranking
    `;

    // Use `%` for flexible pattern matching (partial match for site)
    connection_trn.query(
        query,
        [cat_code, portal, `%${site}%`],
        (error, results) => {
            if (error) {
                console.error("Error executing query:", error);
                res.status(500).send("Internal Server Error");
            } else {
                res.json(results);
            }
        }
    );
});

app.get("/tx/startups", (req, res) => {
    const { category, year } = req.query; // ✅ Accept from frontend

    // Build query dynamically based on filters
    let query = `
    SELECT 
      ST_ID, 
      Ranking, 
      employees, 
      company_name, 
      url, 
      city, 
      state, 
      country, 
      linkedin_url, 
      founded, 
      industry, 
      total_funding, 
      indeed_url, 
      growth_percentage 
    FROM 
      RANKING 
    WHERE 
      1=1
    AND STATUS = 'ACTIVE'

  `;

    // ✅ Add filters if present
    if (category) {
        query += ` AND Categry = ${connection.escape(category)}`;
    }

    if (year) {
        query += ` AND Rank_Year = ${connection.escape(year)}`;
    }

    query += ` ORDER BY Ranking`;

    // Execute the query
    connection.query(query, (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            return res.status(500).send("Internal Server Error");
        }
        console.log("Fetched filtered data successfully:", results);
        res.json(results);
    });
});

app.get("/myblocks/details", (req, res) => {
    const companyId = req.query.companyId;

    if (!companyId) {
        return res.status(400).send("Missing companyId in query parameters");
    }

    console.log("Received companyId:", companyId);

    const query = `
        SELECT 
            r.ST_ID,
            d.About,
            r.company_name,
            r.city,
            r.state,
            r.country,
            r.url,
            r.linkedin_url,
            r.founded,
            r.total_funding,
            r.employees,
            r.Ranking,
            v.FB_FOLLOWER_COUNT,
            v.INSTA_FOLLOWER_COUNT,
            v.LINKEDIN_FOLLOWER_COUNT
        FROM 
            RANKING r
        LEFT JOIN 
            RANKING_DETAILS d ON r.ST_ID = d.ST_ID
        LEFT JOIN 
            kf_vendor v ON r.VEND_ID = v.VEND_ID
        WHERE 
            r.ST_ID = ?`;

    // Execute the query
    connection_trn.query(query, [companyId], (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            res.status(500).send("Internal Server Error");
        } else {
            console.log("Fetched details successfully:", results);
            res.json(results[0]); // Send combined data as JSON
        }
    });
});

app.get("/tx/details", (req, res) => {
    const companyId = req.query.companyId;

    if (!companyId) {
        return res.status(400).send("Missing companyId in query parameters");
    }

    console.log("Received companyId:", companyId);

    const query = `
        SELECT 
            d.ST_ID,
            d.About,
            r.company_name,
            r.city,
            r.state,
            r.country,
            r.url,
            r.linkedin_url,
            r.founded,
            r.total_funding,
            r.employees,
            r.Ranking
        FROM 
            RANKING r
        LEFT JOIN 
            RANKING_DETAILS d ON r.ST_ID = d.ST_ID
        WHERE 
            r.ST_ID = ?`;

    // Execute the query
    connection.query(query, [companyId], (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            res.status(500).send("Internal Server Error");
        } else {
            console.log("Fetched details successfully:", results);
            res.json(results[0]); // Send combined data as JSON
        }
    });
});

// Endpoint to fetch all startups
// app.get('/startups', (req, res) => {
//     // Use the MySQL connection pool to execute a query to fetch all data
//     connection.query(
//         `SELECT ST_ID, Ranking,employees, company_name, url, city, state, country, linkedin_url, founded, industry, total_funding, indeed_url, growth_percentage FROM RANKING WHERE Categry = 'Startup' ORDER BY Ranking`,
//         (error, results) => {
//             if (error) {
//                 console.error('Error executing query:', error);
//                 res.status(500).send('Internal Server Error');
//             } else {
//                 console.log('Fetched all data successfully:', results);
//                 res.json(results);
//             }
//         }
//     );
// });

// Endpoint to fetch details for a specific company/university
// app.get('/details/:companyId', (req, res) => {
//     const companyId = req.params.companyId;
//     console.log('Received companyId:', companyId); // Add this line to log companyId
//     // Use the MySQL connection pool to execute a query to fetch details
//     connection.query(
//         'SELECT * FROM RANKING_DETAILS WHERE ST_ID = ?',
//         [companyId],
//         (error, results) => {
//             if (error) {
//                 console.error('Error executing query:', error);
//                 res.status(500).send('Internal Server Error');
//             } else {
//                 console.log('Fetched details successfully:', results[0]);
//                 res.json(results[0]);
//             }
//         }
//     );
// });

//for AdminAPP section Options
app.post("/Admin/app/menu", (req, res) => {
    const QUERY = `SELECT * from smp_menu where ROLE_ID<=${req.body.role_id} and USER_TYPE='${req.body.category}' and ADMIN_USER='${req.body.adminuser}'`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/user/app/menu", (req, res) => {
    const QUERY = `SELECT * from smp_menu where ROLE_ID<=${req.body.role_id} and ADMIN_USER='Basic'`;
    //console.log(QUERY )
    connection.query(QUERY, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

//adminuser
app.post("/admin/login/details", (req, res) => {
    // Use parameterized query to avoid SQL injection
    const QUERY = `SELECT * FROM EMPLOY_REGISTRATION WHERE USERNAME = '${req.body.username}' AND PASSWORD = '${req.body.password}' AND ADMIN_USER = 'Active'`;

    pmoConnection.query(QUERY, (err, result) => {
        console.log(result);
        console.log(err);
        if (err) {
            res.send(err);
        } else {
            if (result && result.length > 0) {
                const userData = result[0];
                const token = jwt.sign(
                    {
                        userid: userData.EMPID,
                        username: userData.USERNAME,
                        role: "admin",
                    },
                    JWT_SECRET,
                    { expiresIn: "24h" }
                );
                res.json({ user: result, token: token });
            } else {
                res.send(result);
            }
        }
    });
});

app.get("/kf_doc_Categry", async (req, res) => {
    try {
        // Define the query using the MongoDB driver for Node.js
        const query = {
            DOC_CATEGRY_ID: 144,
        };

        // Use the `find` method to retrieve documents that match the query
        const options = {
            projection: {
                CONFIG_DES: 1,
            },
        };

        const documents = await db
            .collection("kf_doc_config")
            .find(query, options)
            .toArray();

        if (documents.length > 0) {
            // Respond with the found documents
            res.json(documents);
        } else {
            // Handle the case where no documents were found
            res.status(404).json({ error: "No documents found" });
        }
    } catch (error) {
        // Handle any errors that occur during the query or response handling
        console.error(error);
        res.status(500).json({ error: "Failed to fetch select box options" });
    }
});

// //KF_DOCMNT_UPLOAD!
// app.post('/kf_docmnt_upload', upload.single('image'), async (req, res) => {
//     try {

//         const imageFilePath = req.file ? req.file.path : '';

//         const imagePathNew = imageFilePath.replace(/\\/g, '/');
//         const imagePathNew1 = imagePathNew.replace('/var/www/rafalin/mongo_react', '');
//         const imagePathWithPrefix = `..${imagePathNew1}`;

//         console.log("path", imagePathWithPrefix)

//         const usertype = req.body.usertype;
//         console.log("usertype", usertype)

//         let DOC_PRICE

//         if (usertype === 'USERAPP') {
//             DOC_PRICE = 1;
//         }
//         if (usertype === "BUSINESSAPP" || usertype === "ADMINAPP") {
//             DOC_PRICE = 2;
//         }
//         console.log("DOC_PRICE", DOC_PRICE)

//         const DOC_CATEGRY = req.body.DOC_CATEGRY;
//         let {
//             userid,
//             DOC_TITL,
//             DOC_DESC,
//             DOC_URL,
//             DOC_SDATE,
//             portalid,
//             vendorId, // Make sure this matches the key in req.body
//         } = req.body;

//         console.log('Received Form Data:', req.body); // Logging received form data

//         const parsedPortalId = parseInt(portalid, 10);

//         const maxDocIdResult = await db.collection('kf_docmnt').find({}, { DOC_ID: 1 }).sort({ DOC_ID: -1 }).limit(1).toArray();
//         const maxDocId = maxDocIdResult.length > 0 ? maxDocIdResult[0].DOC_ID : 0;

//         // Increment the max DOC_ID by 1
//         const newDocId = maxDocId + 1;

//         // Create a document (object) with the data to be inserted into MongoDB
//         const document = {
//             MEMBER_ID: userid,
//             DOC_ID: newDocId,
//             DOC_VEND_ID: vendorId,
//             DOC_TITL,
//             DOC_DESC,
//             DOC_URL,
//             DOC_CATEGRY,
//             DOC_SDATE,
//             DOC_PRICE: DOC_PRICE,
//             portalid: parsedPortalId,
//             image: imagePathWithPrefix,
//             DOC_STATUS: 1
//         };

//         // Insert the document into the 'kf_docmnt' collection
//         const result = await db.collection('kf_docmnt').insertOne(document);

//         console.log("result", result)
//         console.log("result.insertedCount", result.insertedCount)

//         if (result.insertedId) {
//             console.log('Data inserted successfully');
//             res.status(200).json({ message: 'Data inserted successfully', result });
//         } else {
//             console.error('Error inserting data into the database');
//             res.status(500).json({ error: 'Error inserting data into the database' });
//         }
//     } catch (error) {
//         console.error('Error inserting data into the database:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

app.post("/kf_docmnt_upload", upload.single("image"), async (req, res) => {
    try {
        const imageFilePath = req.file ? req.file.path : "";
        let imagePathWithPrefix = "";

        if (imageFilePath) {
            const imagePathNew = imageFilePath.replace(/\\/g, "/");
            const imagePathNew1 = imagePathNew.replace(
                "/var/www/rafalin/mongo_react",
                ""
            );
            imagePathWithPrefix = `..${imagePathNew1}`;
            console.log("path", imagePathWithPrefix);
        } else {
            imagePathWithPrefix = ""; // No image uploaded, store empty string
            console.log("path", imagePathWithPrefix);
        }

        const usertype = req.body.usertype;
        console.log("usertype", usertype);

        let DOC_PRICE;

        if (usertype === "USERAPP") {
            DOC_PRICE = 1;
        }
        if (usertype === "BUSINESSAPP" || usertype === "ADMINAPP") {
            DOC_PRICE = 3;
        }
        console.log("DOC_PRICE", DOC_PRICE);

        const DOC_CATEGRY = req.body.DOC_CATEGRY;
        let {
            userid,
            DOC_TITL,
            DOC_DESC,
            DOC_URL,
            DOC_SDATE,
            portalid,
            vendorId, // Make sure this matches the key in req.body
        } = req.body;

        console.log("Received Form Data:", req.body); // Logging received form data

        const parsedPortalId = parseInt(portalid, 10);

        const maxDocIdResult = await db
            .collection("kf_docmnt")
            .find({}, { DOC_ID: 1 })
            .sort({ DOC_ID: -1 })
            .limit(1)
            .toArray();
        const maxDocId =
            maxDocIdResult.length > 0 ? maxDocIdResult[0].DOC_ID : 0;

        // Increment the max DOC_ID by 1
        const newDocId = maxDocId + 1;

        const sDateObj = new Date(DOC_SDATE);

        // Calculate DOC_EDATE: 1 month after DOC_SDATE in string "YYYY-MM-DD"
        const eDateObj = new Date(sDateObj);
        eDateObj.setMonth(eDateObj.getMonth() + 1);
        const DOC_EDATE = eDateObj.toISOString().split("T")[0];

        // Calculate DOC_PUBDATE: current local time in string "YYYY-MM-DD HH:mm:ss"
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        const DOC_PUBDATE = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        // Create a document (object) with the data to be inserted into MongoDB
        const document = {
            MEMBER_ID: userid,
            DOC_ID: newDocId,
            DOC_VEND_ID: vendorId,
            DOC_TITL,
            DOC_DESC,
            DOC_URL,
            DOC_CATEGRY,
            DOC_SDATE: sDateObj,
            DOC_EDATE: DOC_EDATE,
            DOC_PUBDATE: DOC_PUBDATE,
            DOC_PRICE: DOC_PRICE,
            portalid: parsedPortalId,
            image: imagePathWithPrefix,
            DOC_STATUS: 1,
            DOC_PRI: 8
        };

        // Insert the document into the 'kf_docmnt' collection
        const result = await db.collection("kf_docmnt").insertOne(document);

        console.log("result", result);
        console.log("result.insertedCount", result.insertedCount);

        if (result.insertedId) {
            console.log("Data inserted successfully");
            res.status(200).json({
                message: "Data inserted successfully",
                result,
            });
        } else {
            console.error("Error inserting data into the database");
            res.status(500).json({
                error: "Error inserting data into the database",
            });
        }
    } catch (error) {
        console.error("Error inserting data into the database:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

//kfupdate-edit.
app.put("/kfupdate/:docId", upload.single("image"), async (req, res) => {
    try {
        const docId = parseInt(req.params.docId, 10);

        // Check if the document with the given DOC_ID exists
        const existingDoc = await db
            .collection("kf_docmnt")
            .findOne({ DOC_ID: docId });

        if (!existingDoc) {
            return res.status(404).json({ error: "Document not found" });
        }

        let imagePathWithPrefix = existingDoc.image;

        if (req.file && req.file.path) {
            const imageFilePath = req.file.path;
            const imagePathNew = imageFilePath.replace(/\\/g, "/");
            const imagePathNew1 = imagePathNew.replace(
                "/var/www/rafalin/mongo_react",
                ""
            );
            imagePathWithPrefix = `..${imagePathNew1}`;
        }

        // Update the existing document with the new data
        const updatedDoc = {
            MEMBER_ID: req.body.userid,
            DOC_TITL: req.body.DOC_TITL,
            DOC_DESC: req.body.DOC_DESC,
            DOC_URL: req.body.DOC_URL,
            DOC_CATEGRY: req.body.DOC_CATEGRY,
            DOC_SDATE: req.body.DOC_SDATE,
            portalid: parseInt(req.body.portalid, 10),
            image: req.file ? imagePathWithPrefix : existingDoc.image, // Use the existing image if not updated
            DOC_STATUS: 1,
        };

        // Perform the update
        const result = await db
            .collection("kf_docmnt")
            .updateOne({ DOC_ID: docId }, { $set: updatedDoc });

        if (result.modifiedCount > 0) {
            console.log("Data updated successfully");
            res.status(200).json({
                message: "Data updated successfully",
                result,
            });
        } else {
            console.error("No document updated");
            res.status(500).json({ error: "No document updated" });
        }
    } catch (error) {
        console.error("Error updating data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// kf_DOCMNT_delete.
app.delete("/kfDOC_MNT_delete/:docId", async (req, res) => {
    try {
        const docId = parseInt(req.params.docId, 10);

        // Check if the document with the given DOC_ID exists
        const existingDoc = await db
            .collection("kf_docmnt")
            .findOne({ DOC_ID: docId });

        if (!existingDoc) {
            return res.status(404).json({ error: "Document not found" });
        }

        // Update the existing document's DOC_PRICE to 0
        const resultUpdate = await db
            .collection("kf_docmnt")
            .updateOne({ DOC_ID: docId }, { $set: { DOC_PRICE: 0 } });

        if (resultUpdate.modifiedCount > 0) {
            console.log("DOC_PRICE updated successfully to 0");
        } else {
            console.error("No document updated for DOC_PRICE");
        }

        // Send a success message without waiting for the delete operation
        console.log("Data updated successfully");
        res.status(200).json({
            message: "Data updated successfully",
            resultUpdate,
        });
    } catch (error) {
        console.error("Error updating data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Add a new route to handle document approval
app.put("/kf-docmnt-approve/:docId", async (req, res) => {
    try {
        const docId = parseInt(req.params.docId, 10);

        // Check if the document with the given DOC_ID exists
        const existingDoc = await db
            .collection("kf_docmnt")
            .findOne({ DOC_ID: docId });

        if (!existingDoc) {
            return res.status(404).json({ error: "Document not found" });
        }

        // Update the existing document's DOC_PRICE to 5
        const resultUpdate = await db
            .collection("kf_docmnt")
            .updateOne({ DOC_ID: docId }, { $set: { DOC_PRICE: 5 } });

        if (resultUpdate.modifiedCount > 0) {
            console.log("DOC_PRICE updated successfully to 5");
            res.status(200).json({
                message: "Document approved successfully",
                resultUpdate,
            });
        } else {
            console.error("No document updated for DOC_PRICE");
            res.status(500).json({
                error: "No document updated for DOC_PRICE",
            });
        }
    } catch (error) {
        console.error("Error approving document:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/fetch_kf_vendor_Data", async (req, res) => {
    try {
        const portalid = req.query.portalid;
        const userid = req.query.userid;

        if (!portalid || !userid) {
            return res.status(400).json({
                error: "Both portalid and userid are required in the query parameters",
            });
        }

        console.log("Received portalid:", portalid);
        console.log("Received userid:", userid);

        const query = {
            PORTAL_ID: parseInt(portalid), // Ensure the portalid is converted to a number
            MEMBERID: parseInt(userid),
            DOC_PRICE: { $gt: 0 },
        };

        const options = {
            sort: { VEND_ID: -1 },
        };

        const documents = await db
            .collection("kf_vendor")
            .find(query)
            .sort(options.sort)
            .toArray();

        if (documents.length > 0) {
            res.json(documents);
        } else {
            console.log(
                `No documents found for portalid: ${portalid} and userid: ${userid} and DOC_PRICE: 5`
            );
            res.status(404).json({ error: "No documents found" });
        }
    } catch (error) {
        console.error(
            "Error fetching data from the kf_vendor collection:",
            error
        );
        res.status(500).json({
            error: "Failed to fetch data from the kf_vendor collection",
        });
    }
});

//KF_Vendor vend_categry's
app.get("/KF_vendor-categry", async (req, res) => {
    try {
        // Define the MongoDB query using the MongoDB driver for Node.js
        const query = { DOC_CATEGRY_ID: 122 };

        // Use the `find` method to retrieve documents that match the query
        const options = {
            projection: {
                CONFIG_DES: 1,
            },
        };

        const documents = await db
            .collection("kf_doc_config")
            .find(query, options)
            .toArray();

        // Respond with the found documents
        res.json(documents);
    } catch (error) {
        // Handle any errors that may occur during the query or response handling
        console.error(error);
        res.status(500).json({ error: "Failed to fetch select box options" });
    }
});

app.post(
    "/kf_vendor_upload",
    upload.single("selectedImage"),
    async (req, res) => {
        try {
            const VEND_TITL = req.body.VEND_TITL;
            const imageFilePath = req.file ? req.file.path : "";
            const VEND_CATEGRY = req.body.VEND_CATEGRY;
            const email = req.body.email;
            const phone = parseInt(req.body.phone);
            const portalid = parseInt(req.body.portalid);
            const VEND_SDATE = new Date(req.body.VEND_SDATE);
            const userid = parseInt(req.body.userid, 10);

            const usertype = req.body.usertype;
            console.log("usertype", usertype);

            let DOC_PRICE;

            if (usertype === "USERAPP") {
                DOC_PRICE = 1;
            }
            if (usertype === "BUSINESSAPP" || usertype === "ADMINAPP") {
                DOC_PRICE = 2;
            }
            console.log("DOC_PRICE", DOC_PRICE);

            console.log("Received values from the frontend:");
            console.log("VEND_TITL:", VEND_TITL);
            console.log("VEND_CATEGRY:", VEND_CATEGRY);
            console.log("email:", email);
            console.log("phone:", phone);
            console.log("portalid:", portalid);
            console.log("userid:", userid);

            const imagePathNew = imageFilePath.replace(/\\/g, "/");
            const imagePathNew1 = imagePathNew.replace(
                "/var/www/rafalin/mongo_react",
                ""
            );
            const imagePathWithPrefix = `..${imagePathNew1}`;

            console.log("path", imagePathWithPrefix);

            const maxVendIdResult = await db
                .collection("kf_vendor")
                .find({}, { VEND_ID: 1 })
                .sort({ VEND_ID: -1 })
                .limit(1)
                .toArray();
            const maxVendId =
                maxVendIdResult.length > 0 ? maxVendIdResult[0].VEND_ID : 0;

            // Increment the max DOC_ID by 1
            const newVendId = maxVendId + 1;
            console.log("new VEND_ID:", newVendId);

            // Define the new document to insert into the 'kf_vendor' collection
            const documentToInsert = {
                VEND_ID: newVendId,
                MEMBERID: userid,
                VEND_TITL: VEND_TITL,
                VEND_DESC: req.body.VEND_DESC,
                VEND_SDATE: VEND_SDATE,
                VEND_CATEGRY: VEND_CATEGRY,
                phone: phone,
                email: email,
                IMAGE: imagePathWithPrefix,
                PORTAL_ID: portalid,
                DOC_PRICE: DOC_PRICE,
            };

            // Use the `insertOne` method to insert the new document into the 'kf_vendor' collection
            const result = await db
                .collection("kf_vendor")
                .insertOne(documentToInsert);
            console.log("result", result);

            if (result.insertedId) {
                // The document was inserted successfully
                console.log("Data inserted successfully");
                res.status(200).json({ message: "Data inserted successfully" });
            } else {
                // Some other error occurred during insertion
                res.status(500).json({ message: "Error inserting data" });
            }
        } catch (error) {
            // Handle any errors that may occur during the insert operation or response handling
            console.error("Error during file upload:", error);
            res.status(500).json({ error: "Error during file upload" });
        }
    }
);

app.put(
    "/kf_vendor_update/:VEND_ID",
    upload.single("selectedImage"),
    async (req, res) => {
        try {
            const VEND_ID = parseInt(req.params.VEND_ID, 10);

            // Check if the vendor with the given VEND_ID exists
            const existingVendor = await db
                .collection("kf_vendor")
                .findOne({ VEND_ID: VEND_ID });

            if (!existingVendor) {
                return res.status(404).json({ error: "Vendor not found" });
            }

            let imagePathWithPrefix = existingVendor.image;

            if (req.file && req.file.path) {
                const imageFilePath = req.file.path;
                const imagePathNew = imageFilePath.replace(/\\/g, "/");
                const imagePathNew1 = imagePathNew.replace(
                    "/var/www/rafalin/mongo_react",
                    ""
                );
                imagePathWithPrefix = `..${imagePathNew1}`;
            }
            const VEND_SDATE = new Date(req.body.VEND_SDATE);

            // Update the existing vendor with the new data
            const updatedVendor = {
                MEMBERID: parseInt(req.body.userid, 10),
                VEND_TITL: req.body.VEND_TITL,
                VEND_DESC: req.body.VEND_DESC,
                VEND_SDATE: VEND_SDATE,
                VEND_CATEGRY: req.body.VEND_CATEGRY,
                phone: parseInt(req.body.phone, 10),
                email: req.body.email,
                PORTAL_ID: parseInt(req.body.portalid, 10),
                image: req.file ? imagePathWithPrefix : existingVendor.image, // Use the existing image if not updated
            };

            // Perform the update
            const result = await db
                .collection("kf_vendor")
                .updateOne({ VEND_ID: VEND_ID }, { $set: updatedVendor });

            if (result.modifiedCount > 0) {
                console.log("Data updated successfully");
                res.status(200).json({
                    message: "Data updated successfully",
                    result,
                });
            } else {
                console.error("No document updated");
                res.status(500).json({ error: "No document updated" });
            }
        } catch (error) {
            console.error("Error updating data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

//kf_vendor_delete-
app.put("/kf_vendor_DELETE/:VEND_ID", async (req, res) => {
    try {
        const VEND_ID = parseInt(req.params.VEND_ID, 10);

        // Check if the document with the given VEND_ID exists
        const existingVendor = await db
            .collection("kf_vendor")
            .findOne({ VEND_ID });

        if (!existingVendor) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        // Update the existing vendor's DOC_PRICE to 0
        const resultUpdate = await db
            .collection("kf_vendor")
            .updateOne({ VEND_ID }, { $set: { DOC_PRICE: 0 } });

        if (resultUpdate.modifiedCount > 0) {
            console.log("Vendor soft-deleted successfully");
            res.status(200).json({
                message: "Vendor soft-deleted successfully",
                resultUpdate,
            });
        } else {
            console.error("No vendor soft-deleted");
            res.status(500).json({ error: "No vendor soft-deleted" });
        }
    } catch (error) {
        console.error("Error soft-deleting vendor:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/login/verify/email/employuser", async (req, res) => {
    try {
        const email = req.body.email;
        console.log("test", req.body.email);

        pmoConnection.query(
            "SELECT * FROM EMPLOY_REGISTRATION WHERE EMAIL = ?",
            [email],
            (error, results, fields) => {
                if (error) {
                    console.error("Error:", error);
                    res.status(500).json({
                        message:
                            "An error occurred while processing your request.",
                    });
                } else {
                    if (results.length > 0) {
                        // User found, send found response
                        res.status(200).json({
                            message: "User found",
                            user: results[0],
                        });
                    } else {
                        // User not found, send not found response
                        res.status(404).json({ message: "User not found" });
                    }
                }
            }
        );
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/password/reset/employusers", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("test", req.body);

        pmoConnection.query(
            "UPDATE EMPLOY_REGISTRATION SET PASSWORD = ? WHERE EMAIL = ?",
            [password, email],
            (error, results, fields) => {
                if (error) {
                    console.error("Error:", error);
                    res.status(500).json({
                        message:
                            "An error occurred while processing your request.",
                    });
                } else {
                    if (results.affectedRows > 0) {
                        // Password updated successfully
                        res.status(200).json({
                            message: "Password updated successfully",
                        });
                    } else {
                        // No user found with the provided email, send not found response
                        res.status(404).json({ message: "User not found" });
                    }
                }
            }
        );
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/login/verify/email/techieindex", async (req, res) => {
    try {
        const email = req.body.email;
        const usertype = req.body.usertype;
        console.log("test", req.body);

        connection.query(
            "SELECT * FROM TECHIEINDEX_USER WHERE EMAIL = ? AND USER_TYPE = ?",
            [email, usertype],
            (error, results, fields) => {
                if (error) {
                    console.error("Error:", error);
                    res.status(500).json({
                        message:
                            "An error occurred while processing your request.",
                    });
                } else {
                    if (results.length > 0) {
                        // User found, send found response
                        res.status(200).json({
                            message: "User found",
                            user: results[0],
                        });
                    } else {
                        // User not found, send not found response
                        res.status(404).json({ message: "User not found" });
                    }
                }
            }
        );
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/send/password/reset/email/tx", (req, res) => {
    const { to, subject, text, html } = req.body;
    console.log("test", req.body);

    // Nodemailer logic to send email
    const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            // TODO: replace `user` and `pass` values from <https://forwardemail.net>
            user: "techieindexmedia15@gmail.com",
            pass: "rgtn dstl bogv upic",
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const mailOptions = {
        from: "techieindexmedia15@gmail.com",
        to: to,
        subject: subject,
        text: text,
        html: html,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }
        //res.status(200).send('Email sent: ' + info.response);
        res.status(200).json({ message: "Email has been Sent" });
    });
});

app.post("/password/reset/techieindex", async (req, res) => {
    try {
        const { email, password, usertype } = req.body;
        console.log("password reset tx", req.body);

        connection.query(
            "UPDATE TECHIEINDEX_USER SET PASSWORD = ? WHERE EMAIL = ? AND USER_TYPE = ?",
            [password, email, usertype],
            (error, results, fields) => {
                if (error) {
                    console.error("Error:", error);
                    res.status(500).json({
                        message:
                            "An error occurred while processing your request.",
                    });
                } else {
                    if (results.affectedRows > 0) {
                        // Password updated successfully
                        res.status(200).json({
                            message: "Password updated successfully",
                        });
                    } else {
                        // No user found with the provided email, send not found response
                        res.status(404).json({ message: "User not found" });
                    }
                }
            }
        );
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.get("/fetch_Leaders_data", async (req, res) => {
    try {
        const portalid = req.query.portalid;

        console.log("Received portalid:", portalid);

        const query = {
            portalid: parseInt(portalid),
            DOC_PRICE: { $gt: 2 },
        };

        const options = {
            sort: { intrvw_id: -1 },
        };

        const documents = await db
            .collection("interview")
            .find(query)
            .sort(options.sort)
            .toArray();

        if (documents.length > 0) {
            res.json(documents);
        } else {
            console.log(`No documents found for portalid: ${portalid}`);
            res.status(404).json({ error: "No documents found" });
        }
    } catch (error) {
        console.error(
            "Error fetching data from the interview collection:",
            error
        );
        res.status(500).json({
            error: "Failed to fetch data from the interview collection",
        });
    }
});

// Backend API for Editing Leaders
app.put(
    "/Leaders_Edit/:intrvw_id",
    upload.single("image"),
    async (req, res) => {
        try {
            const intrvw_id = parseInt(req.params.intrvw_id, 10);
            console.log("name:", req.body.interviewPerson);

            // Check if the vendor with the given intrvw_id exists
            const existingLeader = await db
                .collection("interview")
                .findOne({ intrvw_id: intrvw_id });

            if (!existingLeader) {
                console.error("Leader not found for intrvw_id:", intrvw_id);
                return res.status(404).json({ error: "Leader not found" });
            }

            let imagePathWithPrefix = existingLeader.image;

            if (req.file && req.file.path) {
                const imageFilePath = req.file.path;
                const imagePathNew = imageFilePath.replace(/\\/g, "/");
                const imagePathNew1 = imagePathNew.replace(
                    "/var/www/rafalin/mongo_react",
                    ""
                );
                imagePathWithPrefix = `..${imagePathNew1}`;
            }

            // Update the existing vendor with the new data only if it's different
            const updatedLeader = {
                vendorId: parseInt(req.body.userid, 10),
                interviewPerson: req.body.interviewPerson,
                designation: req.body.designation,
                companyName: req.body.companyName,
                aboutPerson: req.body.aboutPerson,
                portalid: parseInt(req.body.portalid, 10),
                photo: req.file ? imagePathWithPrefix : existingLeader.photo,
            };

            // Check if the new data is different from the existing data
            const isDataDifferent =
                JSON.stringify(existingLeader) !==
                JSON.stringify(updatedLeader);

            if (isDataDifferent) {
                // Perform the update
                const result = await db
                    .collection("interview")
                    .updateOne(
                        { intrvw_id: intrvw_id },
                        { $set: updatedLeader }
                    );

                console.log("Query Criteria:", { intrvw_id: intrvw_id });
                console.log("Existing Leader:", existingLeader);
                console.log("Update Result:", result);

                if (result.modifiedCount > 0) {
                    console.log("Data updated successfully");
                    return res
                        .status(200)
                        .json({ message: "Data updated successfully", result });
                } else {
                    console.error("No document updated");
                    return res
                        .status(500)
                        .json({ error: "No document updated" });
                }
            } else {
                console.log("Data is the same, no update needed");
                return res
                    .status(200)
                    .json({ message: "Data is the same, no update needed" });
            }
        } catch (error) {
            console.error("Error updating data:", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

app.post("/Leaders_data_upload", upload.single("image"), async (req, res) => {
    try {
        const interviewPerson = req.body.interviewPerson;
        const imageFilePath = req.file ? req.file.path : "";
        const designation = req.body.designation;
        const companyName = req.body.companyName;
        const aboutPerson = req.body.aboutPerson;
        const portalid = parseInt(req.body.portalid);
        const userid = parseInt(req.body.userid, 10);

        console.log("Received values from the frontend:");
        console.log("VEND_TITL:", interviewPerson);
        console.log("VEND_CATEGRY:", designation);
        console.log("email:", companyName);
        console.log("phone:", aboutPerson);
        console.log("portalid:", portalid);
        console.log("userid:", userid);

        const imagePathNew = imageFilePath.replace(/\\/g, "/");
        //const imagePathNew1 = imagePathNew.replace('E:/MyBlocks/myblocks code/frontend_mongo/public', '');
        const imagePathNew1 = imagePathNew.replace(
            "/var/www/rafalin/mongo_react",
            ""
        );
        const imagePathWithPrefix = `..${imagePathNew1}`;

        console.log("path", imagePathWithPrefix);

        const maxintrvw_idResult = await db
            .collection("interview")
            .find({}, { intrvw_id: 1 })
            .sort({ intrvw_id: -1 })
            .limit(1)
            .toArray();
        const maxintrvw_id =
            maxintrvw_idResult.length > 0 ? maxintrvw_idResult[0].intrvw_id : 0;

        // Increment the max DOC_ID by 1
        const newintrvw_id = maxintrvw_id + 1;
        console.log("new intrvw_id:", newintrvw_id);

        // Define the new document to insert into the 'kf_vendor' collection
        const documentToInsert = {
            intrvw_id: newintrvw_id,
            vendorId: userid,
            interviewPerson: interviewPerson,
            designation: designation,
            companyName: companyName,
            aboutPerson: aboutPerson,
            photo: imagePathWithPrefix,
            portalid: portalid,
            DOC_PRICE: 5,
        };

        // Use the `insertOne` method to insert the new document into the 'kf_vendor' collection
        const result = await db
            .collection("interview")
            .insertOne(documentToInsert);
        console.log("result", result);

        if (result.insertedId) {
            // The document was inserted successfully
            console.log("Data inserted successfully");
            res.status(200).json({ message: "Data inserted successfully" });
        } else {
            // Some other error occurred during insertion
            res.status(500).json({ message: "Error inserting data" });
        }
    } catch (error) {
        // Handle any errors that may occur during the insert operation or response handling
        console.error("Error during file upload:", error);
        res.status(500).json({ error: "Error during file upload" });
    }
});

//Leaders_delete-
app.put("/Leaders_DELETE/:intrvw_id", async (req, res) => {
    try {
        const intrvw_id = parseInt(req.params.intrvw_id, 10);

        // Check if the document with the given intrvw_id exists
        const existingVendor = await db
            .collection("interview")
            .findOne({ intrvw_id });

        if (!existingVendor) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        // Update the existing vendor's DOC_PRICE to 0
        const resultUpdate = await db
            .collection("interview")
            .updateOne({ intrvw_id }, { $set: { DOC_PRICE: 0 } });

        if (resultUpdate.modifiedCount > 0) {
            console.log("Leader deleted successfully");
            res.status(200).json({
                message: "Leaders deleted successfully",
                resultUpdate,
            });
        } else {
            console.error("No Leader deleted");
            res.status(500).json({ error: "No Leader deleted" });
        }
    } catch (error) {
        console.error("Error deleting Leader:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/page-log-ip", async (req, res) => {
    try {
        const ipAddress =
            req.ip ||
            req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress;

        console.log("User IP Address:", ipAddress);
        console.log("req.ip", req.ip);
        console.log(
            "req.headers[x-forwarded-for]",
            req.headers["x-forwarded-for"]
        );
        console.log("req.socket.remoteAddress", req.socket.remoteAddress);

        currentURL = req.body.currentURL;
        userLocale = req.body.userLocale;
        // console.log('req body page-log-ip', req.body);
        const visitedDateTime = new Date();

        const documentToInsert = {
            USER_IP: ipAddress,
            REQ_URL: currentURL,
            LOCALE: userLocale,
            VISITED_BY: req.body.visitedBy,
            LATITUDE: req.body.latitude,
            LONGITUDE: req.body.longitude,
            BROWSER: req.body.browser,
            USERID: req.body.userid,
            FIRMID: req.body.firmid,
            PORTALID: req.body.portalid,
            VISITED_DATE_TIME: visitedDateTime,
        };

        console.log("a", documentToInsert);

        const result = await db
            .collection("PAGE_LOG")
            .insertOne(documentToInsert);
        console.log("result", result);

        if (result.insertedId) {
            // The document was inserted successfully
            console.log("Page Log inserted successfully");
            res.status(200).json({ message: "Page Log inserted successfully" });
        } else {
            // Some other error occurred during insertion
            res.status(500).json({ message: "Error inserting Page Log" });
        }
    } catch (error) {
        // Handle any errors that may occur during the insert operation or response handling
        console.error("Error during Page Log adding:", error);
        res.status(500).json({ error: "Error during Page Log adding" });
    }
});

app.post("/top/health/links", async (req, res) => {
    try {
        // Assuming you have a MongoDB connection object named 'db'
        // const db = req.db; // or however you get your MongoDB connection object

        // MongoDB query
        const query = {
            type: "HEALTH.COM",
            headerdisplay: { $ne: "" },
            status: "ACTIVE",
        };

        const projection = {
            _id: 0,
            portalid: 1,
            headerdisplay: 1,
        };

        // Execute the query
        const result = await db
            .collection("portal")
            .find(query)
            .project(projection)
            .toArray();
        console.log(result);
        res.send(result);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/hide/emails", (req, res) => {
    const { selectedemailids } = req.body;

    console.log("selectedemailids", selectedemailids);

    const placeholders = selectedemailids.map(() => "?").join(", ");

    const QUERY = `UPDATE EMAIL_CAMPAIGNING_LIST SET STATUS = 'Inactive' WHERE E_ID IN (${placeholders})`;

    //console.log(QUERY )
    connection.query(QUERY, selectedemailids, (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send("Hidden Sucessfully");
        }
    });
});

app.get("/fetch_pagelog_data", async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Set hours, minutes, seconds, and milliseconds to 0

        // Construct the query to match documents with today's date in VISITED_DATE_TIME
        const query = {
            VISITED_DATE_TIME: {
                $gte: today, // Greater than or equal to today's date
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Less than tomorrow's date
            },
            REQ_URL: {
                $not: {
                    $regex: /localhost|\/smpmainpage/,
                },
            },
        };

        const options = {
            sort: { VISITED_DATE_TIME: -1 }, // Assuming you want to sort by the visited date time
        };

        const documents = await db
            .collection("PAGE_LOG")
            .find(query)
            .sort(options.sort)
            .toArray();

        if (documents.length > 0) {
            res.json(documents);
        } else {
            console.log(`No documents found for portalid: ${portalid}`);
            res.status(404).json({ error: "No documents found" });
        }
    } catch (error) {
        console.error(
            "Error fetching data from the PAGE_LOG collection:",
            error
        );
        res.status(500).json({
            error: "Failed to fetch data from the PAGE_LOG collection",
        });
    }
});

app.get("/fetch_pagelog_url_count", async (req, res) => {
    try {
        const datetype = req.query.datetype;
        console.log("datetype".datetype);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Set hours, minutes, seconds, and milliseconds to 0

        // Construct the query to match documents with today's date in VISITED_DATE_TIME
        const query = {
            REQ_URL: {
                $not: {
                    $regex: /localhost|\/smpmainpage/,
                },
            },
        };

        if (datetype === "today") {
            query.VISITED_DATE_TIME = {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            };
        }

        const pipeline = [
            { $match: query },
            { $group: { _id: "$REQ_URL", count: { $sum: 1 } } }, // Group by REQ_URL and count occurrences
            { $sort: { count: -1 } }, // Sort by count in descending order
        ];

        const documents = await db
            .collection("PAGE_LOG")
            .aggregate(pipeline)
            .toArray();

        if (documents.length > 0) {
            res.json(documents);
        } else {
            console.log(`No documents found for portalid: ${portalid}`);
            res.status(404).json({ error: "No documents found" });
        }
    } catch (error) {
        console.error(
            "Error fetching data from the PAGE_LOG collection:",
            error
        );
        res.status(500).json({
            error: "Failed to fetch data from the PAGE_LOG collection",
        });
    }
});

app.post("/create/folder/hospitals", (req, res) => {
    const portalid = req.body.portalid;
    const userid = req.body.userid;

    const folderPath = path.join(
        "/var/www/rafalin/mongo_react/images/vendors/hospitals/",
        portalid
    );

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    const folderPath1 = path.join(
        "/var/www/rafalin/mongo_react/images/vendors/hospitals/",
        portalid,
        userid
    );

    if (!fs.existsSync(folderPath1)) {
        fs.mkdirSync(folderPath1);
    }
    console.log("path==", folderPath1);

    res.send({
        status: "success",
        message: "Folder created successfully",
    });
});

const baseImagePath = "/var/www/rafalin/mongo_react/images/vendors/hospitals/";

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        const { portalid, userid } = req.body;
        const imagePath = path.join(baseImagePath, portalid, userid);

        // Create the destination folder if it doesn't exist
        if (!fs.existsSync(imagePath)) {
            fs.mkdirSync(imagePath, { recursive: true });
        }

        cb(null, imagePath);
    },
    filename: (req, file, cb) => {
        const { originalname } = file;
        const currentDate = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
        const newName = `${path.parse(originalname).name}_${currentDate}_${req.body.portalid
            }_${req.body.userid}${path.extname(originalname)}`;

        cb(null, newName);
    },
});

const upload2 = multer({
    dest: "path2/",
    storage: storage2,
});

app.post("/submit-hospital", upload2.single("Image"), async (req, res) => {
    const { portalid, userid, formData } = req.body;

    console.log("formData", formData);
    const Name = req.body.Name;
    const Place = req.body.Place;
    const Address = req.body.Address;
    const Phone = req.body.Phone;
    const Doctors = req.body.Doctors;
    const Nursing_staffs = req.body.Nursing_staffs;
    const Other_staffs = req.body.Other_staffs;
    const Bed_no = req.body.Bed_no;
    console.log("Received file:", req.file);

    try {
        const dataToInsert = {
            ...formData,
            DOC_PRICE: 4,
            NAME: Name,
            PLACE: Place,
            ADDRESS: Address,
            PHONE: Phone,
            DOCTORS: Doctors,
            NURSING_STAFFS: Nursing_staffs,
            OTHER_STAFFS: Other_staffs,
            BED_NO: Bed_no,
            MEMBERID: userid,
            PORTALID: portalid,
            // image: imagePathWithPrefix,
            IMAGE: req.file
                ? path.join(
                    "..",
                    "images",
                    "vendors",
                    "hospitals",
                    portalid,
                    userid,
                    req.file.filename
                )
                : null,
        };
        const query = "INSERT INTO hospital_info SET ?";

        connection.query(query, dataToInsert, (error, results) => {
            if (error) {
                console.error(
                    "Error inserting data into Hospital_info:",
                    error
                );
                res.status(500).json({ error: "Internal Server Error" });
                return;
            }
            console.log("Form data saved to Hospital_info table:", results);

            res.status(200).json({ message: "Form submitted successfully!" });
        });
    } catch (error) {
        console.error("Error saving form data:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update the /get-hospital-data API endpoint to accept Portalid and Memberid as query parameters
app.get("/get-hospital-data", (req, res) => {
    const { Portalid, Memberid } = req.query;
    const query =
        "SELECT * FROM hospital_info WHERE PORTALID = ? AND MEMBERID = ? AND DOC_PRICE >= 1";

    connection.query(query, [Portalid, Memberid], (error, results) => {
        if (error) {
            console.error("Error fetching hospital data:", error);
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            res.status(200).json(results);
        }
    });
});

// Handle the request to update hospital data
app.post("/edit-hospital/:Id", upload2.single("Image"), async (req, res) => {
    const hospitalId = req.params.Id;
    console.log("id:", hospitalId);

    // Extract form fields from req.body directly
    const {
        portalid,
        userid,
        Name,
        Place,
        Address,
        Phone,
        Doctors,
        Nursing_staffs,
        Other_staffs,
        Bed_no,
        image,
    } = req.body;
    const imagePath = req.file
        ? path.join(
            "..",
            "images",
            "vendors",
            "hospitals",
            portalid,
            userid,
            req.file.filename
        )
        : null;

    try {
        // Include userid in the formData
        const dataToUpdate = {
            NAME: Name,
            PLACE: Place,
            ADDRESS: Address,
            PHONE: Phone,
            DOCTORS: Doctors,
            NURSING_STAFFS: Nursing_staffs,
            OTHER_STAFFS: Other_staffs,
            BED_NO: Bed_no,

            // Memberid: userid,
            // Portalid: portalid,
        };

        // Only update the image if it is not null
        if (imagePath) {
            dataToUpdate.image = imagePath;
        }

        console.log("datatoupdate=", dataToUpdate);

        // Update the hospital_info table
        const updateQuery = "UPDATE hospital_info SET ? WHERE ID = ?";
        connection.query(
            updateQuery,
            [dataToUpdate, hospitalId],
            (error, results) => {
                if (error) {
                    console.error(
                        "Error updating data in Hospital_info:",
                        error
                    );
                    res.status(500).json({ error: "Internal Server Error" });
                    return;
                }

                console.log(
                    "Hospital data updated in Hospital_info table:",
                    results
                );
                res.status(200).json({
                    message: "Hospital data updated successfully!",
                });
            }
        );
    } catch (error) {
        console.error("Error updating hospital data:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Assuming you have an endpoint like /delete-hospital/:id
app.post("/delete-hospital/:Id", (req, res) => {
    const hospitalId = req.params.Id;

    // Update the DOC_PRICE to 0 for the specified hospital id
    const updateQuery = "UPDATE hospital_info SET DOC_PRICE = 0 WHERE Id = ?";

    connection.query(
        updateQuery,
        [hospitalId],
        (updateError, updateResults) => {
            if (updateError) {
                console.error("Error deleting hospital data:", updateError);
                res.status(500).json({ error: "Internal Server Error" });
            } else {
                console.log(
                    "Hospital data delete successfully:",
                    updateResults
                );
                res.status(200).json({
                    message: "Hospital data delete successfully!",
                });
            }
        }
    );
});

app.get("/get-dropdown-options", (req, res) => {
    const query = `SELECT DISTINCT questions FROM portal_problems WHERE questions IS NOT NULL AND questions != '';`;
    connection.query(query, (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            res.status(500).send("Internal Server Error");
        } else {
            const dropdownOptions = results.map((row) => row.questions);
            res.status(200).json(dropdownOptions);
        }
    });
});

app.post("/submit-question", async (req, res) => {
    const { typedQuestion, portalid, userid, username, selectedDropdownValue } =
        req.body;
    console.log("typedQ:", typedQuestion, "dropvalue:", selectedDropdownValue);
    console.log("portid:", portalid, "userid:", userid);

    // Get the current date and time in the MySQL datetime format
    const formattedDate = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

    console.log("PID:", portalid);

    if (!db) {
        console.error("MongoDB connection not established.");
        res.status(500).send("Internal Server Error");
        return;
    }

    // Assuming you have a MongoDB collection named 'portal' in the 'nrkindex_prod' database
    const collection = db.collection("portal");

    try {
        // Construct the dynamic aggregation pipeline
        const aggregationPipeline = [
            {
                $match: {
                    portalid: Number(portalid), // Convert portalid to a number if it's not already
                },
            },
            {
                $project: {
                    _id: 0,
                    parentportalid: 1,
                },
            },
        ];

        // Execute the aggregation pipeline
        const result = await collection
            .aggregate(aggregationPipeline)
            .toArray();

        // Assuming the result is an array with one document
        const parentportalid =
            result.length > 0 ? result[0].parentportalid : null;
        console.log("PPID:", parentportalid);

        // Assuming you have a table named 'portal_problems'
        const query =
            "INSERT INTO portal_problems (MEMBERID, PORTALID, NAME, QUESTIONS, TYPED_QUESTIONS,PARENTPORTALID, ADDED_DATE) VALUES (?,?, ?, ?, ?, ?,  NOW())";

        // Check if typedQuestion or selectedDropdownValue is truthy before inserting
        const valuesToInsert = [userid, portalid, username];

        if (selectedDropdownValue) {
            valuesToInsert.push(selectedDropdownValue);
        } else {
            valuesToInsert.push(null); // or replace with a default value if needed
        }

        if (typedQuestion) {
            valuesToInsert.push(typedQuestion);
        } else {
            valuesToInsert.push(null); // or replace with a default value if needed
        }

        if (parentportalid) {
            valuesToInsert.push(parentportalid);
        } else {
            valuesToInsert.push(null); // or replace with a default value if needed
        }

        //valuesToInsert.push(formattedDate);

        connection.query(query, valuesToInsert, (error, results) => {
            if (error) {
                console.error("Error executing query:", error);
                res.status(500).send("Internal Server Error");
            } else {
                res.status(200).send("Question submitted successfully");
            }
        });
    } catch (error) {
        console.error("Error executing MongoDB aggregation pipeline:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Add this route to your backend
app.get("/get-added-questions", (req, res) => {
    const { portalid } = req.headers;
    const { page, pageSize } = req.query;

    // Calculate the offset based on the page and pageSize
    const offset = (page - 1) * pageSize;

    const query =
        "SELECT * FROM portal_problems WHERE PORTALID = ? ORDER BY ADDED_DATE DESC LIMIT ?, ?";

    connection.query(
        query,
        [portalid, offset, parseInt(pageSize)],
        (error, results) => {
            if (error) {
                console.error("Error executing query:", error);
                res.status(500).send("Internal Server Error");
            } else {
                res.json(results);
            }
        }
    );
});

app.get("/get-active-questions", async (req, res) => {
    const { page, pageSize } = req.query;
    const offset = (page - 1) * pageSize;

    const portalid = req.headers.portalid;
    console.log("PID:", portalid);

    if (!db) {
        console.error("MongoDB connection not established.");
        res.status(500).send("Internal Server Error");
        return;
    }

    // Assuming you have a MongoDB collection named 'portal' in the 'nrkindex_prod' database
    const collection = db.collection("portal");

    try {
        // Construct the dynamic aggregation pipeline
        const aggregationPipeline = [
            {
                $match: {
                    portalid: Number(portalid), // Convert portalid to a number if it's not already
                },
            },
            {
                $project: {
                    _id: 0,
                    parentportalid: 1,
                },
            },
        ];

        // Execute the aggregation pipeline
        const result = await collection
            .aggregate(aggregationPipeline)
            .toArray();

        // Assuming the result is an array with one document
        const parentportalid =
            result.length > 0 ? result[0].parentportalid : null;
        console.log("PPID:", parentportalid);

        const query =
            "SELECT * FROM portal_problems WHERE PARENTPORTALID = ? ORDER BY ADDED_DATE DESC LIMIT ?, ?";

        connection.query(
            query,
            [parentportalid, offset, parseInt(pageSize)],
            (error, results) => {
                if (error) {
                    console.error("Error executing query:", error);
                    res.status(500).send("Internal Server Error");
                } else {
                    res.json(results);
                }
            }
        );
    } catch (error) {
        console.error("Error executing MongoDB aggregation pipeline:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/fetch-portal-parent", async (req, res) => {
    const { portalid } = req.query;

    if (!db) {
        console.error("MongoDB connection not established.");
        res.status(500).send("Internal Server Error");
        return;
    }

    // Assuming you have a MongoDB collection named 'portal' in the 'nrkindex_prod' database
    const collection = db.collection("portal");

    try {
        // Construct the dynamic aggregation pipeline
        const aggregationPipeline = [
            {
                $match: {
                    portalid: Number(portalid), // Convert portalid to a number if it's not already
                },
            },
            {
                $project: {
                    _id: 0,
                    parentportalid: 1,
                },
            },
        ];

        // Execute the aggregation pipeline
        const result = await collection
            .aggregate(aggregationPipeline)
            .toArray();

        // Assuming the result is an array with one document
        let parentportalid =
            result.length > 0 ? result[0].parentportalid : null;
        console.log("PPID:", parentportalid);

        if (parentportalid === 0) {
            parentportalid = 3025;
        }

        try {
            // Check if parentportalid exists
            if (parentportalid) {
                // Find the document in the portal collection with the matching parentportalid
                const parentPortalDocument = await collection.findOne({
                    portalid: parentportalid,
                });

                // Check if the parent portal document exists
                if (parentPortalDocument) {
                    const parentPortalName = parentPortalDocument.portalname;
                    console.log("parentPortalName:", parentPortalName);

                    const resultLength = result.length;

                    // Send back both result and length in the response
                    res.json({ parentPortalName, resultLength });
                } else {
                    // If the parent portal document does not exist, handle the case accordingly
                    res.status(404).send("Parent portal not found");
                }
            } else {
                // If parentportalid is null or undefined, handle the case accordingly
                res.status(404).send("Parent portal id not provided");
            }
        } catch (error) {
            console.error(
                "Error executing MongoDB aggregation pipeline:",
                error
            );
            res.status(500).send("Internal Server Error");
        }
    } catch (error) {
        console.error("Error executing MongoDB aggregation pipeline:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/facebook/otp", authenticateToken, async (req, res) => {
    const encodedUrlVal = req.body.encodedUrlVal;
    console.log("encodedUrlVal", encodedUrlVal);
    //const command = `python "C:/Users/b2/Desktop/facebook api review/facebook_auth.py" `;
    const command = `python3.7 "/home/rafalin/facebook_temp_otp_script/facebook_auth.py" `;

    //exec(command, (error, stdout, stderr)
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error.message}`);
            return res.status(500).json({ error: "Internal server error" });
        }
        if (stderr) {
            console.error(`Python script returned an error: ${stderr}`);
            return res.status(400).json({ error: "Bad request" });
        }
        console.log(`Python script output: ${stdout}`);
        res.send(stdout);
    });
});



app.get("/facebook/otp2", authenticateToken, async (req, res) => {
    const encodedUrlVal = req.body.encodedUrlVal;
    console.log("encodedUrlVal", encodedUrlVal);
    //const command = `python "C:/Users/b2/Desktop/facebook api review/facebook_auth.py" `;
    const command = `python3.7 "/home/rafalin/facebook_temp_otp_script/facebook_auth2.py" `;

    //exec(command, (error, stdout, stderr)
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error.message}`);
            return res.status(500).json({ error: "Internal server error" });
        }
        if (stderr) {
            console.error(`Python script returned an error: ${stderr}`);
            return res.status(400).json({ error: "Bad request" });
        }
        console.log(`Python script output: ${stdout}`);
        res.send(stdout);
    });
});



app.post("/news/headlines/entertainment/mobile", async (req, res) => {
    try {
        const port = parseInt(req.body.port);
        const parentport = parseInt(req.body.parentport);

        const query = {
            $and: [
                {
                    $or: [
                        { portalid: port },
                        { portalid: parentport },
                        { parentportalid: port },
                    ],
                },
                {
                    $or: [{ DOC_CATEGRY: "news" }, { DOC_CATEGRY: "News" }],
                },
                {
                    DOC_PRICE: { $gt: 2 },
                },
            ],
        };

        const options = {
            sort: { DOC_ID: -1 },
            limit: 20,
        };

        // Find documents that match the given query and apply the options for sorting and limiting
        const documents = await db
            .collection("kf_docmnt")
            .find(query, options)
            .toArray();
        //const documents = await db.collection('kf_docmnt').find().toArray();
        //res.status(200).json(documents);
        res.send(documents);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.get("/api/populate/editprofile", async (req, res) => {
    try {
        let MyblocksId = req.query.MyblocksId;
        MyblocksId = parseInt(MyblocksId, 10);
        console.log("Received User ID:", MyblocksId); // Log the received user ID

        // Define the MongoDB query to find the document where `MyblocksId` matches MyblockId
        const query = { MyblocksId: MyblocksId };

        // Use the `findOne` method to retrieve the first document that matches the query
        const document = await db.collection("doc_patient").findOne(query);

        console.log("document", document);

        res.json({ document });
    } catch (error) {
        console.error("Error fetching link:", error);
        res.status(500).json({
            error: "An error occurred while fetching the link.",
        });
    }
});

app.post("/update/profile/info", async (req, res) => {
    let { id, name, age, gender, hospitalName, phone, patientId, MyblocksId } =
        req.body;

    // Construct the URL with the patientId
    const updatedUrl = `http://61.2.142.91:8082/camp_test/quick.php?id=${patientId}`;

    console.log("Received data from the frontend:");
    console.log("Name:", name);
    console.log("Age:", age);
    console.log("Gender:", gender);
    console.log("Hospital Name:", hospitalName);
    console.log("phone:", phone);
    console.log("Patient ID:", patientId);
    console.log("Myblocks ID:", MyblocksId);
    console.log("Updated URL:", updatedUrl);

    const document = {
        Name: name,
        Age: parseInt(age, 10),
        Gender: gender,
        Hos_name: hospitalName,
        phone: parseInt(phone, 10),
        patientId: parseInt(patientId, 10),
        MyblocksId: parseInt(MyblocksId, 10),
        Url: updatedUrl,
    };
    try {
        // Perform the update
        const result = await db
            .collection("doc_patient")
            .updateOne({ _id: new ObjectId(id) }, { $set: document });

        console.log("result", result);

        if (result.modifiedCount > 0) {
            console.log("Data updated successfully");
            res.status(200).json({
                message: "Data updated successfully",
                result,
            });
        } else {
            console.error("No document updated");
            res.status(200).json({ message: "No changes done by you" });
        }
    } catch (error) {
        console.error("Error updating data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/api/top-points", async (req, res) => {
    const portalid = req.query.portalid;
    console.log("portalid", portalid);

    // if (isNaN(portalid) || typeof portalid !== 'string') {
    //     console.error("Portal ID is not a valid number");
    // }

    const MYSQL_QUERY = `
    SELECT RESUME_ID, SUM(POINTS) AS points
    FROM act_point_dly
    WHERE INSRT_DTM >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY RESUME_ID
    ORDER BY points DESC  
    `;

    connection.query(MYSQL_QUERY, async (mysqlErr, mysqlResult) => {
        if (mysqlErr) {
            console.error("Error executing MySQL query: ", mysqlErr);
            res.status(500).json({ error: "Internal server error" });
        } else {
            // Get the user names from MongoDB
            const resumeIDs = mysqlResult.map((row) => row.RESUME_ID);

            console.log("resumeIDs", resumeIDs);

            try {
                console.log("portalid inside", portalid);

                const users = await db
                    .collection("vendor_user")
                    .find({
                        USER_ID: { $in: resumeIDs },
                        HOME_PORTALID: parseInt(portalid),
                    })
                    .toArray();

                // Map user IDs to user names

                // console.log("users", users)
                const userMap = {};
                users.forEach((user) => {
                    if (user.NAME !== "Unknown User") {
                        // Skip Unknown User
                        userMap[user.USER_ID] = user.NAME;
                    }
                });

                // Filter out Unknown Users
                const filteredResults = mysqlResult.filter(
                    (row) => userMap[row.RESUME_ID]
                );

                // Take top 20 from the filtered results
                const top20Results = filteredResults.slice(0, 20);

                // Combine filtered results from MySQL and MongoDB
                const combinedResult = top20Results.map((row) => ({
                    RESUME_ID: row.RESUME_ID,
                    points: row.points,
                    user_name: userMap[row.RESUME_ID],
                }));

                res.json(combinedResult);
            } catch (findErr) {
                console.error("Error querying MongoDB: ", findErr);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    });
});

app.post("/fetchPortalName", async (req, res) => {
    let { homePortalId } = req.body;

    console.log("homePortalId", homePortalId);

    homePortalId = parseInt(homePortalId);

    try {
        // Query to fetch portal name based on homePortalId
        const query = { portalid: homePortalId };

        // Find document that matches the given query
        const result = await db.collection("portal").findOne(query);

        // Check if portal name was found
        if (!result) {
            res.status(500).json({ error: "Portal not found" });
            return;
        }

        const portalName = result.portalname;
        res.status(200).json({ portalName });
    } catch (error) {
        // If an error occurs, log it and send a server error response
        console.error("Error fetching portal name:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post(
    "/upload-resume",
    upload_resume_smp.single("pdf"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).send({ message: "No file uploaded" });
            }
            res.send({ message: "File uploaded successfully", file: req.file });
        } catch (err) {
            res.status(500).send({
                message: "Server error",
                error: err.message,
            });
        }
    }
);

// app.post('/run-python-script', (req, res) => {
//     const { pdfPath } = req.body; // Ensure pdfPath is correctly extracted from the request body
//     console.log('PDF Path:', pdfPath);

//     // Execute the Python script with the uploaded resume path as an argument
//     const pythonProcess = spawn('python3.7', ['/home/rafalin/python_files/career/ats.py', pdfPath]);

//     // Handle success or error
//     pythonProcess.stdout.on('data', (data) => {
//         console.log(`stdout: ${data}`);
//     });

//     pythonProcess.stderr.on('data', (data) => {
//         console.error(`stderr: ${data}`);
//     });

//     pythonProcess.on('close', (code) => {
//         console.log(`child process exited with code ${code}`);
//         res.sendStatus(200); // Respond to the frontend
//     });
// });

app.post("/run-python-script", (req, res) => {
    const { pdfPath, userid } = req.body; // Ensure pdfPath and userid are correctly extracted from the request body

    console.log("Request Body:", req.body); // Log the entire request body
    console.log("PDF Path:", pdfPath);
    console.log("User ID:", userid);

    if (!pdfPath || !userid) {
        return res.status(400).send("Missing pdfPath or userid");
    }

    // Execute the Python script with the uploaded resume path as an argument
    const pythonProcess = spawn("python3.7", [
        "/home/rafalin/python_files/career/ats.py",
        pdfPath,
        userid,
    ]);

    // Handle success or error
    pythonProcess.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on("close", (code) => {
        console.log(`child process exited with code ${code}`);
        if (code !== 0) {
            return res.status(500).send("Failed to run Python script");
        }
        res.sendStatus(200); // Respond to the frontend
    });
});

app.get("/api/fbengagementslist", (req, res) => {
    const category = req.query.Category;
    const portalid = req.query.portalid;

    // Query to select data from the database
    const sql = `SELECT * FROM facebook_posts_from_pages_groups WHERE CATEGORY = ? and PORTALID = ?`;
    connection.query(sql, [category, portalid], (err, result) => {
        if (err) {
            console.error("Error fetching data:", err);
            res.status(500).json({
                error: "Error fetching data. Please try again later.",
            });
        } else {
            console.log("Data fetched:", result);
            res.status(200).json(result);
        }
    });
});

app.get("/get/best/post", (req, res) => {
    const category = req.query.Category;
    const portalid = req.query.portalid;

    // Query to select data from the database
    const sql = `SELECT CAPTION, (LIKES + COMMENTS_COUNT + SHARES) AS TOTAL_INTERACTIONS FROM  facebook_posts_from_pages_groups WHERE CATEGORY = ? and PORTALID = ? ORDER BY TOTAL_INTERACTIONS DESC LIMIT 1 `;
    connection.query(sql, [category, portalid], (err, result) => {
        if (err) {
            console.error("Error fetching data:", err);
            res.status(500).json({
                error: "Error fetching data. Please try again later.",
            });
        } else {
            console.log("Data fetched:", result);
            res.status(200).json(result);
        }
    });
});

app.post("/userprofile_business_user", async (req, res) => {
    try {
        const userId = parseInt(req.body.userid);

        const query = `SELECT * from EMPLOY_REGISTRATION where EMPID = ?`;

        pmoConnection.query(query, [userId], (err, results) => {
            if (err) {
                console.error("Error fetching user profile:", err);
                res.status(500).json({ error: "Failed to fetch user profile" });
                return;
            }
            res.json(results);
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/profile/Update_business_user", async (req, res) => {
    try {
        // Updated profile data from the request body
        let {
            EMPNAME,
            USERNAME,
            PASSWORD,
            HOME_PORTALID,
            EMAIL,
            EMPID,
            LATITUDE,
            LONGITUDE,
        } = req.body.updatedUser; // Assuming these fields are sent from the frontend

        const userId = parseInt(EMPID);

        // Check if the EMAIL already exists in the database
        const emailCheckQuery =
            "SELECT * FROM EMPLOY_REGISTRATION WHERE EMAIL = ? AND EMPID <> ?";
        pmoConnection.query(emailCheckQuery, [EMAIL, userId], (err, rows) => {
            if (err) {
                console.error("Error checking email existence:", err);
                res.status(500).json({
                    error: "Failed to check email existence",
                });
                return;
            }

            if (rows.length > 0) {
                // If there's already a matching email (other than the current user), return an error
                res.status(400).json({
                    error: "Email already exists in the database.",
                });
            } else {
                // Proceed with the update query
                const updateQuery = `UPDATE EMPLOY_REGISTRATION SET EMPNAME = ?, USERNAME = ?, PASSWORD = ?, HOME_PORTALID = ?, EMAIL = ?, LATITUDE = ?, LONGITUDE = ? WHERE EMPID = ?`;
                const values = [
                    EMPNAME,
                    USERNAME,
                    PASSWORD,
                    HOME_PORTALID,
                    EMAIL,
                    LATITUDE,
                    LONGITUDE,
                    userId,
                ];

                pmoConnection.query(
                    updateQuery,
                    values,
                    (updateErr, result) => {
                        if (updateErr) {
                            console.error(
                                "Error updating user profile:",
                                updateErr
                            );
                            res.status(500).json({
                                error: "Failed to update user profile",
                            });
                        } else {
                            if (result.changedRows === 1) {
                                res.status(200).json({
                                    message:
                                        "User profile updated successfully.",
                                });
                            } else {
                                console.error("No document updated");
                                res.status(200).json({
                                    message: "No changes done by you",
                                });
                            }
                        }
                    }
                );
            }
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
});

app.post("/fetchPortalName_business_user", async (req, res) => {
    let { homePortalId } = req.body;

    console.log("homePortalId", homePortalId);

    homePortalId = parseInt(homePortalId);

    try {
        // Query to fetch portal name based on homePortalId
        const query = { portalid: homePortalId };

        // Find document that matches the given query
        const result = await db.collection("portal").findOne(query);

        // Check if portal name was found
        if (!result) {
            res.status(500).json({ error: "Portal not found" });
            return;
        }

        // const portalName = result.portalname;
        res.status(200).json({ result });
    } catch (error) {
        // If an error occurs, log it and send a server error response
        console.error("Error fetching portal name:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/pindex/validate", (req, res) => {
    const query = `SELECT PARENT_ID, AI_PROGRAM FROM ai_master WHERE PROD_PY_PATH IS NOT NULL AND PARENT_ID IS NOT NULL and AI_TYPE='PIndex'`;

    connection_trn.query(query, (err, results) => {
        if (err) {
            return res
                .status(500)
                .json({ error: "Database query failed", details: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No eligible records found" });
        }

        // Send back all records that match the criteria
        return res.json(results);
    });
});

app.get("/cindex/validate", (req, res) => {
    const query = `SELECT PARENT_ID, AI_PROGRAM FROM ai_master WHERE PROD_PY_PATH IS NOT NULL AND PARENT_ID IS NOT NULL and AI_TYPE='CIndex'`;

    connection_trn.query(query, (err, results) => {
        if (err) {
            return res
                .status(500)
                .json({ error: "Database query failed", details: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No eligible records found" });
        }

        // Send back all records that match the criteria
        return res.json(results);
    });
});

app.get("/api/parameters/:selectedTest/:testid", (req, res) => {
    const selectedTest = req.params.selectedTest; // Capture the value from the URL parameter
    const testid = req.params.testid; // Capture the value from the URL parameter
    console.log(`Received value from frontend: ${selectedTest}`);
    console.log(`Received value from testid: ${testid}`);
    const query = `SELECT NAME as name, units, procedure_category FROM procedure_type WHERE Parent="${testid}" and STATUS='ACTIVE';`;
    connection_trn.query(query, (error, results) => {
        if (error) {
            console.error("Error fetching data:", error); // Log error to console
            res.status(500).send(error.message);
        } else {
            // Log the received value
            console.log(results); // Display fetched values in the console
            res.json(results); // Send fetched values as a JSON response
        }
    });
});

async function handleAi_v3(
    res,
    values,
    selectedTest,
    testid,
    userid,
    username,
    portalid,
    parameters
) {
    try {
        const query = `SELECT PROD_PY_PATH FROM ai_master WHERE PARENT_ID = ?`;
        const results = await queryDatabase(query, [testid]);

        if (!results || results.length === 0 || !results[0].PROD_PY_PATH) {
            console.error("Python script path not found for the given testid");
            return res
                .status(404)
                .json({ error: "Python script path not found" });
        }

        const pythonScriptPath = results[0].PROD_PY_PATH;
        const pythonArgs = values.map((val) =>
            val === null || val === "" ? "" : val.toString()
        );
        const scriptDir = path.dirname(pythonScriptPath);

        console.log("Executing Python script with args:", [
            pythonScriptPath,
            ...pythonArgs,
        ]);

        const pythonProcess = spawn(
            "python3.7",
            [pythonScriptPath, ...pythonArgs],
            {
                cwd: scriptDir,
            }
        );

        let receivedData = "";
        let errorData = "";

        pythonProcess.stdout.on("data", (data) => {
            receivedData += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            errorData += data.toString().trim();
        });

        pythonProcess.on("error", (err) => {
            console.error("Error spawning Python process:", err);
            return res.status(500).json({
                error: "Error spawning Python process",
                details: err.message,
            });
        });

        pythonProcess.on("close", async (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                console.error(`Python script stderr:\n${errorData}`);
                return res.status(500).json({
                    error: `Python script error occurred with code ${code}`,
                    details:
                        errorData ||
                        "No error details received from Python script",
                });
            }

            const resultValue = receivedData.trim(); // Ensuring clean output
            console.log(`Python script exited with code ${code}`);
            console.log(`Received Data from Python: ${resultValue}`);

            // Insert the result into AI_RESULTS table
            const insertQuery = `
                INSERT INTO AI_RESULTS 
                (ML_CODE_NAME, ML_CODE_ID, RESULT, USERID, USERNAME, PORTALID, RESULTS_DATE) 
                VALUES (?, ?, ?, ?, ?, ?, CURDATE())
            `;

            try {
                const insertResults = await queryDatabase(insertQuery, [
                    selectedTest,
                    testid,
                    resultValue,
                    userid,
                    username,
                    portalid,
                ]);

                console.log(
                    "Inserted result into AI_RESULTS:",
                    insertResults.insertId
                );
                await insertProcedureResult(
                    parameters,
                    values,
                    testid,
                    insertResults.insertId,
                    resultValue,
                    res
                );
            } catch (err) {
                console.error("Error inserting into AI_RESULTS:", err);
                return res
                    .status(500)
                    .json({ error: "Database insertion failed" });
            }
        });
    } catch (err) {
        console.error("Error during AI processing:", err);
        return res.status(500).json({
            error: "Internal server error during AI processing",
            details: err.message,
        });
    }
}

async function queryDatabase(query, params) {
    return new Promise((resolve, reject) => {
        connection_trn.query(query, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
}

async function insertProcedureResult(
    parameters,
    values,
    testid,
    resultId,
    resultValue,
    res
) {
    const procedure_report_id = 1;
    const PARENT_ID = testid;
    const RESULT_ID = resultId;
    const source = "Labcode";
    const date = new Date();

    const insertQuery = `
        INSERT INTO procedure_result( 
        procedure_report_id, PARENT_ID, RESULT_ID,result_code,result_text,
        date, result, source) VALUES (?, ?, ?, ?, ?, ?, ?,?)
    `;

    let completed = 0;
    let hasError = false;

    for (let i = 0; i < parameters.length; i++) {
        const param = parameters[i];
        const value = values[i] || "";
        const result_code = param.procedure_category || "";

        const valuesArray = [
            procedure_report_id,
            PARENT_ID,
            RESULT_ID,
            result_code,
            param.name,
            date,
            value,
            source, // source
        ];

        try {
            await queryDatabase(insertQuery, valuesArray);
            completed++;
            if (completed === parameters.length && !hasError) {
                console.log("All data executed and inserted successfully");

                // return res.status(200).json({
                //     success: true,
                //     message: 'All data executed and inserted successfully'
                // });
                res.status(200).send(resultValue);
            }
        } catch (err) {
            console.error("Insert failed:", err);
            if (!hasError) {
                hasError = true;
                return res.status(500).json({
                    success: false,
                    message: "Insert error",
                    error: err,
                });
            }
        }
    }
}

app.post("/api/submit", async (req, res) => {
    const {
        parameters,
        values,
        portalid,
        userid,
        username,
        selectedTest,
        testid,
    } = req.body;

    console.log("Received values from frontend:", req.body);
    console.log("User portalid:", portalid);
    console.log("User id:", userid);
    console.log("User name:", username);
    console.log("parameters:", parameters);

    // Call the handleAi_v3 function to run the Python script and get the result
    await handleAi_v3(
        res,
        values,
        selectedTest,
        testid,
        userid,
        username,
        portalid,
        parameters
    );
});

// async function handleAi_v3(res, values, selectedTest, testid, userid, username, portalid) {
// const query = `SELECT PROD_PY_PATH FROM ai_master WHERE PARENT_ID = ?`;
// connection_trn.query(query, [testid], (error, results) => {
//     if (error) {
//         console.error('Database error:', error);
//         res.status(500).json({ error: 'Database error occurred' });
//         return;
//     }

//     if (!results || results.length === 0 || !results[0].PROD_PY_PATH) {
//         console.error('Python script path not found for the given testid');
//         res.status(404).json({ error: 'Python script path not found' });
//         return;
//     }

//     const pythonScriptPath = results[0].PROD_PY_PATH;
//     const pythonArgs = values.map((val) => (val === null || val === '' ? '' : val.toString()));
//     const scriptDir = path.dirname(pythonScriptPath);

//     console.log('Executing Python script with args:', [pythonScriptPath, ...pythonArgs]);

//     const pythonProcess = spawn('python3.7', [pythonScriptPath, ...pythonArgs], {
//             cwd: scriptDir,
//         });

//         let receivedData = '';
//         let errorData = '';

//         pythonProcess.stdout.on('data', (data) => {
//             receivedData += data.toString();
//         });

//         pythonProcess.stderr.on('data', (data) => {
//             errorData += data.toString().trim();
//         });

//         pythonProcess.on('error', (err) => {
//             console.error('Error spawning Python process:', err);
//             res.status(500).json({ error: 'Error spawning Python process', details: err.message });
//         });

//         pythonProcess.on('close', (code) => {
//             if (code !== 0) {
//                 console.error(`Python script exited with code ${code}`);
//                 console.error(`Python script stderr:\n${errorData}`);
//                 res.status(500).json({
//                     error: `Python script error occurred with code ${code}`,
//                     details: errorData || 'No error details received from Python script',
//                 });
//                 return;
//             }

//             const resultValue = receivedData.trim(); // Ensuring clean output
//             console.log(`Python script exited with code ${code}`);
//             console.log(`Received Data from Python: ${resultValue}`);

//             // Insert the result into AI_RESULTS table
//             const insertQuery = `
//                 INSERT INTO AI_RESULTS
//                 (ML_CODE_NAME, ML_CODE_ID, RESULT, USERID, USERNAME, PORTALID, RESULTS_DATE)
//                 VALUES (?, ?, ?, ?, ?, ?, CURDATE())
//             `;

//             connection_trn.query(
//                 insertQuery,
//                 [selectedTest, testid, resultValue, userid, username, portalid],
//                 (insertError, insertResults) => {
//                     if (insertError) {
//                         console.error('Error inserting into AI_RESULTS:', insertError);
//                         res.status(500).json({ error: 'Database insertion failed' });
//                         return;
//                     }

//                     console.log('Inserted result into AI_RESULTS:', insertResults.insertId);
//                     res.status(200).send(resultValue);
//                 }
//             );
//         });
//     });
// }

// app.post('/api/submit', async (req, res) => {
//     const { values, portalid, userid, username, selectedTest, testid } = req.body;
//     console.log('Received values from frontend:', req.body);
//     console.log('User portalid:', portalid);
//     console.log('User id:', userid);
//     console.log('User name:', username);

//     await handleAi_v3(res, values, selectedTest, testid, userid, username, portalid);
// });

// app.post('/generate-summary', async (req, res) => {

//     const story = req.body.story;
//     const model = req.body.model;

//     const url = 'http://61.2.142.91:8434/api/generate';
//     const headers = { 'Content-Type': 'application/json' };

//     console.log("story", story)

//     // Define the payload
//     const payload = {
//         model: model,
//         prompt: `Summarize the following text in plain text without using numbered bullets or any special formatting,Summarize the text in plain English. The summary should be in English: ${story}`
//     };

//     try {
//         const response = await axios.post(url, payload, { headers, responseType: 'stream' });

//         let buffer = '';

//         res.status(200);

//         response.data.on('data', (chunk) => {
//             buffer += chunk.toString();

//             // Process buffer to handle complete JSON objects
//             let boundary = buffer.indexOf('\n');
//             while (boundary > -1) {
//                 const line = buffer.substring(0, boundary).trim();
//                 buffer = buffer.substring(boundary + 1);

//                 if (line) {
//                     try {
//                         const lineJson = JSON.parse(line);
//                         if (lineJson.response) {
//                             // Send each part of the response to the client
//                             process.stdout.write(lineJson.response);

//                             res.write(lineJson.response);

//                         }
//                     } catch (jsonErr) {
//                         console.error(`Failed to parse JSON line: ${jsonErr}`);
//                         console.error(`Response line content: ${line}`);
//                     }
//                 }

//                 boundary = buffer.indexOf('\n');
//                 // console.log(lineJson.response)
//             }
//         });

//         response.data.on('end', () => {
//             if (buffer) {
//                 // console.log(buffer)
//                 res.write(buffer);
//             }
//             res.end(); // End the response when streaming is complete
//         });
//     } catch (error) {
//         console.error('Error occurred:', error.message);
//         if (error.response) {
//             console.error('Response status:', error.response.status);
//             console.error('Response data:', error.response.data);
//         }
//         res.status(500).send('An error occurred while generating the summary.');
//     }
// });

app.get("/api/watermark-status", (req, res) => {
    const { userid, firmid } = req.query;

    // Validate input
    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ error: "Missing required parameters: userid or firmid" });
    }

    const sql = `
      SELECT * 
      FROM WATERMARKS_DETAILS 
      WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
    `;

    connection.query(sql, [userid, firmid], (err, results) => {
        if (err) {
            console.error("Error executing query:", err);
            return res.status(500).json({ error: "Database query error" });
        }

        console.log("watermark_status", results);

        // Check if any results were returned
        if (results.length > 0) {
            res.json({ hasActiveWatermark: true });
        } else {
            res.json({ hasActiveWatermark: false });
        }
    });
});

// Promisify MySQL connection methods
// connection_trn.query = util.promisify(connection_trn.query);
// connection_trn.beginTransaction = util.promisify(connection_trn.beginTransaction);
// connection_trn.commit = util.promisify(connection_trn.commit);
// connection_trn.rollback = util.promisify(connection_trn.rollback);

const addDailyTasks = async (
    scheduleId,
    startDate,
    endDate,
    taskToAutomate,
    connection
) => {
    try {
        console.log("addDailyTasks called with:", {
            scheduleId,
            startDate,
            endDate,
            taskToAutomate,
        });

        const queryPromise = util.promisify(connection.query).bind(connection);

        // Generate all dates in the range
        const datesInRange = [];
        let currentDate = new Date(startDate);
        const endDateObj = new Date(endDate);

        while (currentDate <= endDateObj) {
            const formattedDate = currentDate.toISOString().split("T")[0];
            datesInRange.push(formattedDate); // Format 'YYYY-MM-DD'
            currentDate.setDate(currentDate.getDate() + 1);
        }
        console.log("Generated dates in range:", datesInRange);

        if (taskToAutomate === "holiday_image") {
            console.log("Processing holiday_image tasks...");

            // Query holidays in the range
            const holidaysQuery = `
                SELECT DATE_FORMAT(h.DATE, '%Y-%m-%d') AS DATE, h.H_ID, c.CAPTION_ID 
                FROM HOLIDAY_DAYS_LIST h
                LEFT JOIN CAPTIONS c ON h.H_ID = c.HOLIDAY_ID AND c.FOR_HOLIDAY = 'Y'
                WHERE h.DATE BETWEEN ? AND ?
            `;
            const holidays = await queryPromise(holidaysQuery, [
                startDate,
                endDate,
            ]);
            console.log("Fetched holidays:", holidays);

            if (holidays.length === 0) {
                console.log("No holidays found in the specified range.");
                return { success: true, message: "No holidays found." };
            }

            // Fetch a pool of random holiday images
            const randomImagesQuery = `
                SELECT IMAGE_ID 
                FROM IMAGE_DETAILS 
                WHERE IMAGE_SOURCE = 'HOLIDAY LIST'
            `;
            const randomImages = await queryPromise(randomImagesQuery);
            let imagePool = randomImages.map((img) => img.IMAGE_ID);
            console.log("Fetched random holiday image pool:", imagePool);

            if (imagePool.length === 0) {
                throw new Error("No holiday images found in IMAGE_DETAILS.");
            }

            // Ensure we don't reuse image IDs
            // if (holidays.length > imagePool.length) {
            //     throw new Error("Not enough unique holiday images to assign to each task.");
            // }

            // Prepare holiday tasks
            const holidayTasks = holidays.map((holiday) => {
                const dayName = new Date(holiday.DATE)
                    .toLocaleDateString("en-US", { weekday: "long" })
                    .toUpperCase();

                // Assign a unique `HOLIDAY_IMAGE_ID` and remove it from the pool
                const randomIndex = Math.floor(
                    Math.random() * imagePool.length
                );
                const randomImageID = imagePool[randomIndex];
                imagePool.splice(randomIndex, 1); // Remove the assigned image ID

                return [
                    scheduleId,
                    taskToAutomate,
                    dayName,
                    holiday.H_ID,
                    holiday.CAPTION_ID || null,
                    randomImageID,
                ];
            });

            // Insert holiday tasks
            const insertHolidayTasksQuery = `
                INSERT INTO TASK_PARAMETERS (SCHEDULE_ID, TASK_TO_AUTOMATE, DAY, HOLIDAY_ID, CAPTION_ID, HOLIDAY_IMAGE_ID)
                VALUES ?
            `;
            console.log("Inserting holiday tasks:", holidayTasks);
            await queryPromise(insertHolidayTasksQuery, [holidayTasks]);
        } else if (["my_image", "category_image"].includes(taskToAutomate)) {
            console.log("Processing tasks for my_image or category_image...");

            const tasksFor7Days = datesInRange.slice(0, 7).map((date) => {
                const dayName = new Date(date)
                    .toLocaleDateString("en-US", { weekday: "long" })
                    .toUpperCase();
                return [
                    scheduleId,
                    taskToAutomate,
                    dayName,
                    null, // No holiday ID
                    null, // No caption ID
                    null, // No holiday image ID
                ];
            });

            // Insert 7-day tasks
            const insert7DayTasksQuery = `
                INSERT INTO TASK_PARAMETERS (SCHEDULE_ID, TASK_TO_AUTOMATE, DAY, HOLIDAY_ID, CAPTION_ID, HOLIDAY_IMAGE_ID)
                VALUES ?
            `;
            console.log("Inserting 7-day tasks:", tasksFor7Days);
            await queryPromise(insert7DayTasksQuery, [tasksFor7Days]);
        } else {
            console.log(`Unknown taskToAutomate: ${taskToAutomate}`);
            throw new Error(`Invalid taskToAutomate value: ${taskToAutomate}`);
        }

        console.log("addDailyTasks completed successfully.");
        return { success: true, message: "Daily tasks added successfully." };
    } catch (error) {
        console.error("Error in addDailyTasks:", error);
        throw error;
    }
};

app.post("/api/schedule", async (req, res) => {
    const {
        userid,
        firmid,
        portalid,
        scheduleType,
        startDate,
        endDate,
        postingTime,
        dayOfWeek,
        imageOption,
        watermarkConfig,
    } = req.body;

    let conn;
    try {
        conn = await connection_trn.getPromisifiedConnection(); // 👈 acquire from pool

        await conn.beginTransaction();
        console.log("Transaction started.");

        const insertScheduleQuery = `
      INSERT INTO USER_SCHEDULES (USER_ID, FIRMID, PORTALID, SCHEDULE_TYPE, START_DATE, END_DATE, POSTING_TIME, USE_LOGO) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const scheduleResult = await conn.query(insertScheduleQuery, [
            userid,
            firmid,
            portalid,
            scheduleType,
            startDate,
            endDate,
            postingTime,
            watermarkConfig,
        ]);
        const scheduleId = scheduleResult.insertId;

        if (scheduleType === "DAILY") {
            await addDailyTasks(
                scheduleId,
                startDate,
                endDate,
                imageOption,
                conn
            );
        } else if (scheduleType === "WEEKLY" || scheduleType === "MONTHLY") {
            await addWeeklyOrMonthlyTasks(
                startDate,
                endDate,
                scheduleId,
                scheduleType,
                conn,
                imageOption,
                dayOfWeek
            );
        }

        await conn.commit();
        res.json({
            message: "Schedule and task parameters added successfully",
            id: scheduleId,
        });
    } catch (error) {
        console.error("Error in schedule creation:", error);
        if (conn) await conn.rollback();
        res.status(500).json({
            error: "Failed to create schedule. Please try again.",
        });
    } finally {
        if (conn) conn.release(); // release back to pool
    }
});

// app.post("/api/schedule", async (req, res) => {
//     const {
//         userid, firmid, portalid, scheduleType, startDate, endDate, postingTime, dayOfWeek, imageOption, watermarkConfig
//     } = req.body;

//     console.log("Received schedule creation request:", req.body);

//     try {
//         await connection_trn.beginTransaction();
//         console.log("Transaction started.");

//         // Insert new schedule into USER_SCHEDULES
//         const insertScheduleQuery = `
//             INSERT INTO USER_SCHEDULES (USER_ID, FIRMID, PORTALID, SCHEDULE_TYPE, START_DATE, END_DATE, POSTING_TIME, USE_LOGO)
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `;
//         console.log("Insert schedule query:", insertScheduleQuery);
//         const scheduleResult = await connection_trn.query(insertScheduleQuery, [
//             userid, firmid, portalid, scheduleType, startDate, endDate, postingTime, watermarkConfig
//         ]);
//         const scheduleId = scheduleResult.insertId;
//         console.log("Inserted schedule. Schedule ID:", scheduleId);

//         if (scheduleType === "DAILY") {
//             console.log("Adding daily tasks...");
//             await addDailyTasks(scheduleId, startDate, endDate, imageOption, connection_trn);
//         } else if (scheduleType === "WEEKLY" || scheduleType === "MONTHLY") {
//             console.log("Adding weekly/monthly tasks...");
//             await addWeeklyOrMonthlyTasks(startDate, endDate, scheduleId, scheduleType, connection_trn, imageOption, dayOfWeek);
//         }

//         await connection_trn.commit();
//         console.log("Transaction committed.");
//         res.json({ message: "Schedule and task parameters added successfully", id: scheduleId });
//     } catch (error) {
//         console.error("Error in schedule creation:", error);
//         await connection_trn.rollback();
//         res.status(500).json({ error: "Failed to create schedule. Please try again." });
//     }
// });

const addWeeklyOrMonthlyTasks = async (
    startDate,
    endDate,
    scheduleId,
    taskType,
    connection,
    imageOption,
    dayOfWeek
) => {
    try {
        console.log("addWeeklyOrMonthlyTasks called with:", {
            startDate,
            endDate,
            scheduleId,
            taskType,
            imageOption,
            dayOfWeek,
        });

        const queryPromise = util.promisify(connection.query).bind(connection);

        if (imageOption === "holiday_image") {
            console.log(
                "Image option is holiday_image. Adding tasks only for holidays."
            );

            const holidayQuery = `
                SELECT 
                    h.DATE AS holiday_date, 
                    h.H_ID, 
                    c.CAPTION_ID, 
                    GROUP_CONCAT(i.IMAGE_ID) AS holiday_image_ids
                FROM HOLIDAY_DAYS_LIST h
                LEFT JOIN CAPTIONS c ON h.H_ID = c.HOLIDAY_ID AND c.FOR_HOLIDAY = 'Y'
                LEFT JOIN IMAGE_DETAILS i ON i.IMAGE_SOURCE = 'HOLIDAY LIST'
                WHERE h.DATE BETWEEN ? AND ?
                GROUP BY h.DATE, h.H_ID, c.CAPTION_ID
            `;

            const holidayResults = await queryPromise(holidayQuery, [
                startDate,
                endDate,
            ]);
            console.log("Fetched holiday details:", holidayResults);

            if (holidayResults.length === 0) {
                console.log("No holidays found in the specified range.");
                return { success: true, message: "No holidays found." };
            }

            for (const holiday of holidayResults) {
                const { holiday_date, H_ID, CAPTION_ID, holiday_image_ids } =
                    holiday;
                const imageIds = holiday_image_ids
                    ? holiday_image_ids.split(",")
                    : [];

                if (imageIds.length === 0) {
                    console.warn(
                        `No images available for holiday on ${holiday_date}. Skipping.`
                    );
                    continue;
                }

                const selectedImageId =
                    imageIds[Math.floor(Math.random() * imageIds.length)]; // Randomly select an image

                const insertTaskQuery = `
                    INSERT INTO TASK_PARAMETERS (
                        SCHEDULE_ID, 
                        TASK_TO_AUTOMATE, 
                        DAY, 
                        HOLIDAY_ID, 
                        CAPTION_ID, 
                        HOLIDAY_IMAGE_ID
                    )
                    VALUES (?, 'holiday_image', ?, ?, ?, ?)
                `;

                console.log("Inserting holiday task:", {
                    scheduleId,
                    day: new Date(holiday_date)
                        .toLocaleString("en-US", { weekday: "long" })
                        .toUpperCase(),
                    holidayId: H_ID,
                    captionId: CAPTION_ID,
                    holidayImageId: selectedImageId,
                });

                await queryPromise(insertTaskQuery, [
                    scheduleId,
                    new Date(holiday_date)
                        .toLocaleString("en-US", { weekday: "long" })
                        .toUpperCase(),
                    H_ID,
                    CAPTION_ID,
                    selectedImageId,
                ]);
            }

            console.log("All holiday tasks added successfully.");
            return {
                success: true,
                message: "Holiday tasks added successfully.",
            };
        } else {
            // Weekly or Monthly logic
            let taskLabel;
            if (taskType === "MONTHLY") {
                // Consolidate months into a label
                const startMonth = new Date(startDate).toLocaleString("en-US", {
                    month: "long",
                    year: "numeric",
                });
                const endMonth = new Date(endDate).toLocaleString("en-US", {
                    month: "long",
                    year: "numeric",
                });
                taskLabel = `Monthly tasks: ${startMonth} - ${endMonth}`;
            } else if (taskType === "WEEKLY") {
                // Consolidate weeks into a label
                const startWeek = new Date(startDate).toLocaleDateString(
                    "en-US"
                );
                const endWeek = new Date(endDate).toLocaleDateString("en-US");
                taskLabel = `Weekly tasks: ${startWeek} - ${endWeek}`;
            } else {
                console.log(`Invalid taskType: ${taskType}`);
                throw new Error(`Invalid taskType: ${taskType}`);
            }

            // Insert a single task with dayOfWeek for weekly or monthly schedules
            const insertTaskQuery = `
                INSERT INTO TASK_PARAMETERS (
                    SCHEDULE_ID, 
                    TASK_TO_AUTOMATE, 
                    DAY
                )
                VALUES (?, ?, ?)
            `;

            console.log("Inserting task with label:", {
                scheduleId,
                imageOption,
                dayOfWeek,
            });
            await queryPromise(insertTaskQuery, [
                scheduleId,
                imageOption,
                dayOfWeek,
            ]);

            console.log(`Task entry added successfully for ${taskLabel}.`);
            return {
                success: true,
                message: `Task entry added successfully for ${taskLabel}.`,
            };
        }
    } catch (error) {
        console.error("Error in addWeeklyOrMonthlyTasks:", error);
        throw error;
    }
};

app.get("/api/vendorcomments", (req, res) => {
    const { VEND_ID, VEND_TITL } = req.query;

    // Build the SQL query based on provided search parameters
    let sql = `
      SELECT vc.*, kv.VEND_TITL
      FROM vendorcomments vc
      JOIN kf_vendor kv ON vc.VEND_ID = kv.VEND_ID
      WHERE 1 = 1
    `;

    if (VEND_ID) sql += ` AND vc.VEND_ID = ${mysql.escape(VEND_ID)}`;
    if (VEND_TITL)
        sql += ` AND kv.VEND_TITL LIKE ${mysql.escape("%" + VEND_TITL + "%")}`;

    connection_trn.query(sql, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

app.post("/api/vendorcomments/getVENDID", async (req, res) => {
    const { VEND_TITL } = req.body;

    try {
        // Query to fetch VEND_ID based on VEND_TITL
        const fetchVendIdSql =
            "SELECT VEND_ID FROM kf_vendor WHERE VEND_TITL = ?";

        connection_trn.query(
            fetchVendIdSql,
            [VEND_TITL],
            (err, vendIdResults) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (vendIdResults.length === 0) {
                    return res
                        .status(404)
                        .json({ error: "Vendor title not found" });
                }

                // Return the VEND_ID to the frontend
                const vendId = vendIdResults[0].VEND_ID;
                res.status(200).json({ VEND_ID: vendId });
            }
        );
    } catch (err) {
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

app.post("/api/vendorcomments/adddata", (req, res) => {
    const formData = req.body;
    console.log("formData", formData);
    const query = `INSERT INTO vendorcomments (PRODUCT, COMMUNICATION_METHOD, COMMUNICATION_RESPONSE, CONTACT_PERSON, DEPARTMENT, CONTACT, NEXT_ACTION, NEXT_DATE, STATUS, COMMENTS, COMPANYID, VEND_ID, PDATE, OWNER, PHONE, EMAIL, VENDOR_NAME, CONTACT_LEVEL)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`;

    connection_trn.query(
        query,
        [
            formData.PRODUCT,
            formData.COMMUNICATION_METHOD,
            formData.COMMUNICATION_RESPONSE,
            formData.CONTACT_PERSON,
            formData.DEPARTMENT,
            formData.CONTACT,
            formData.NEXT_ACTION,
            formData.NEXT_DATE,
            formData.STATUS,
            formData.COMMENTS,
            formData.COMPANYID,
            formData.VEND_ID,
            formData.OWNER,
            formData.PHONE,
            formData.EMAIL,
            formData.VENDOR_NAME,
            formData.CONTACT_LEVEL,
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res
                    .status(500)
                    .json({ error: "Failed to add vendor data." });
            }
            res.json({ message: "Vendor data added successfully." });
        }
    );
});

// Route to fetch competitors
app.get("/api/competitors/:id", (req, res) => {
    const companyId = req.params.id; // Extract company ID from URL params
    console.log("Fetching competitors for company ID:", companyId);

    const query = "SELECT * FROM COMPA_COMPETITORS WHERE COMPET_COMPANY_ID = ?";

    connection_trn.query(query, [companyId], (err, results) => {
        if (err) {
            console.error("Error executing query:", err.message);
            res.status(500).json({
                error: "Failed to fetch competitors data.",
            });
        } else {
            console.log("Competitors fetched successfully:", results);
            res.json(results);
        }
    });
});

// Promisify the query method
connection_trn.query = util.promisify(connection_trn.query);

app.get("/combined-info", async (req, res) => {
    const companyId = req.query.companyId; // Get the companyId from query parameter
    console.log(
        "Received request for /combined-info with companyId:",
        companyId
    );

    if (!companyId) {
        console.error("Company ID is missing in the request.");
        return res.status(400).json({ error: "Company ID is required." });
    }

    try {
        console.log("Fetching followers of competitors...");
        const followersQuery = `
      SELECT 
        SMP_FOLLOWERS.*, 
        COMPA_COMPANIES.NAME AS COMPANY_NAME
      FROM 
        SMP_FOLLOWERS
      INNER JOIN 
        COMPA_COMPANIES 
        ON SMP_FOLLOWERS.COMPANY_ID = COMPA_COMPANIES.ID
      WHERE 
        SMP_FOLLOWERS.COMPANY_ID IN (
          SELECT COMPANY_ID 
          FROM COMPA_COMPETITORS 
          WHERE COMPET_COMPANY_ID = ?
        );
    `;
        const followersRows = await connection_trn.query(followersQuery, [
            companyId,
        ]);
        console.log("Followers of competitors fetched:", followersRows);

        console.log("Fetching company and follower information...");
        const companyInfoQuery = `
      SELECT 
        cc.ID,
        cc.NAME,
        cc.WEBSITE,
        cc.INDUSTRY,
        sf.FB_PAGE_URL,
        sf.FB_FOLLOWER_COUNT,
        sf.INSTA_PAGE_URL,
        sf.INSTA_FOLLOWER_COUNT,
        sf.LINKEDIN_PAGE_URL,
        sf.LINKEDIN_FOLLOWER_COUNT,
        sf.GOOGLE_REVIEW_URL,
        sf.GOOGLE_REVIEW_COUNT,
        sf.TIKTOK_PAGE_URL,
        sf.TIKTOK_FOLLOWER_COUNT,
        sf.SNAPCHAT_PAGE_URL,
        sf.SNAPCHAT_FOLLOWER_COUNT,
        sf.STATUS,
        sf.ISNRT_DTM
      FROM COMPA_COMPANIES cc
      JOIN SMP_FOLLOWERS sf ON cc.ID = sf.COMPANY_ID
      WHERE cc.ID = ?;
    `;
        const companyInfoRows = await connection_trn.query(companyInfoQuery, [
            companyId,
        ]);
        console.log("Company info fetched:", companyInfoRows);

        if (companyInfoRows.length === 0) {
            console.error("Company not found for ID:", companyId);
            return res.status(404).json({ error: "Company not found." });
        }

        console.log("Generating SWOT prompt...");
        let prompt = generateSWOTPrompt(companyInfoRows, followersRows);
        console.log("SWOT Prompt generated:", prompt);

        console.log("Starting interaction with Ollama API...");
        const swotAnalysis = await getSWOTAnalysis(prompt);
        console.log("SWOT analysis result:", swotAnalysis);

        console.log("Sending combined response...");
        res.json({
            followers: followersRows,
            companyInfo: companyInfoRows,
            swotAnalysis: swotAnalysis,
        });
    } catch (error) {
        console.error("Error occurred during processing:", error);
        res.status(500).send("Server error");
    }
});

// Function to generate SWOT prompt
function generateSWOTPrompt(companyInfoRows, followersRows) {
    console.log(
        "Generating SWOT prompt with companyInfoRows:",
        companyInfoRows,
        "and followersRows:",
        followersRows
    );

    const companyData = companyInfoRows[0]; // Assuming we only have one company in companyInfoRows

    let prompt = `Generate a SWOT analysis for the company based on its performance compared to its competitors. The company's details are as follows:\n`;

    prompt += `Company Name: ${companyData.NAME}\n`;
    prompt += `Industry: ${companyData.INDUSTRY}\n\n`;

    prompt += `Company: ${companyData.NAME}\n`;
    prompt += `- Facebook Follower Count: ${companyData.FB_FOLLOWER_COUNT}\n`;
    prompt += `- Instagram Follower Count: ${companyData.INSTA_FOLLOWER_COUNT}\n`;
    prompt += `- LinkedIn Follower Count: ${companyData.LINKEDIN_FOLLOWER_COUNT}\n`;
    prompt += `- Google Review Count: ${companyData.GOOGLE_REVIEW_COUNT}\n`;
    prompt += `- TikTok Follower Count: ${companyData.TIKTOK_FOLLOWER_COUNT}\n`;
    prompt += `- Snapchat Follower Count: ${companyData.SNAPCHAT_FOLLOWER_COUNT}\n\n`;

    prompt += `Now comparing with competitors:\n\n`;

    followersRows.forEach((competitor) => {
        prompt += `Competitor: ${competitor.COMPANY_NAME}\n`;
        prompt += `- Facebook Follower Count: ${competitor.FB_FOLLOWER_COUNT}\n`;
        prompt += `- Instagram Follower Count: ${competitor.INSTA_FOLLOWER_COUNT}\n`;
        prompt += `- LinkedIn Follower Count: ${competitor.LINKEDIN_FOLLOWER_COUNT}\n`;
        prompt += `- TikTok Follower Count: ${competitor.TIKTOK_FOLLOWER_COUNT}\n`;
        prompt += `- Snapchat Follower Count: ${competitor.SNAPCHAT_FOLLOWER_COUNT}\n\n`;
    });

    console.log("SWOT prompt constructed:", prompt);
    return prompt;
}

// Function to get SWOT analysis from Ollama API
async function getSWOTAnalysis(prompt) {
    const OLLAMA_API_URL = "http://61.2.142.91:8434/api/chat";
    const HEADERS = { "Content-Type": "application/json" };

    console.log("Sending request to Ollama API with prompt:", prompt);
    try {
        const response = await axios.post(
            OLLAMA_API_URL,
            {
                model: "llama3.1",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: prompt },
                ],
                stream: false,
            },
            { headers: HEADERS }
        );

        console.log("Ollama API response received:", response.data);
        return (
            response.data.message?.content ||
            "SWOT analysis could not be generated."
        );
    } catch (error) {
        console.error("Error generating SWOT analysis:", error);
        return "Error generating SWOT analysis";
    }
}

app.get("/api/competitor-followers/:companyId", async (req, res) => {
    const companyId = req.params.companyId;

    console.log("Fetching competitor followers for companyId:", companyId);

    try {
        // Query for the company data
        const companyQuery = `
      SELECT 
        cc.ID,
        cc.NAME,
        cc.WEBSITE,
        cc.INDUSTRY,
        sf.FB_PAGE_URL,
        sf.FB_FOLLOWER_COUNT,
        sf.INSTA_PAGE_URL,
        sf.INSTA_FOLLOWER_COUNT,
        sf.LINKEDIN_PAGE_URL,
        sf.LINKEDIN_FOLLOWER_COUNT,
        sf.GOOGLE_REVIEW_URL,
        sf.GOOGLE_REVIEW_COUNT,
        sf.TIKTOK_PAGE_URL,
        sf.TIKTOK_FOLLOWER_COUNT,
        sf.SNAPCHAT_PAGE_URL,
        sf.SNAPCHAT_FOLLOWER_COUNT,
        sf.STATUS,
        sf.ISNRT_DTM
      FROM COMPA_COMPANIES cc
      JOIN SMP_FOLLOWERS sf ON cc.ID = sf.COMPANY_ID
      WHERE cc.ID = ?;
    `;
        const companyData = await connection_trn.query(companyQuery, [
            companyId,
        ]);

        // Query for the competitors' followers data
        const competitorsQuery = `
      SELECT 
        sf.*, 
        cc.NAME AS COMPANY_NAME
      FROM 
        SMP_FOLLOWERS sf
      INNER JOIN 
        COMPA_COMPANIES cc ON sf.COMPANY_ID = cc.ID
      WHERE 
        sf.COMPANY_ID IN (
          SELECT COMPANY_ID 
          FROM COMPA_COMPETITORS 
          WHERE COMPET_COMPANY_ID = ?
        );
    `;
        const competitorsData = await connection_trn.query(competitorsQuery, [
            companyId,
        ]);

        console.log("Fetched competitor followers data:", competitorsData);

        // Respond with the fetched data
        res.json({
            success: true,
            data: {
                company: companyData[0], // Return the first row of the company data
                competitors: competitorsData,
            },
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({
            success: false,
            message: "Database query failed",
        });
    }
});

// // Add company, competitor, and followers endpoint
// app.post('/add-company-with-competitor-and-followers', (req, res) => {
//     const {
//       companyId, // COMPET_COMPANY_ID
//       competitor,
//       followers,
//     } = req.body;

//     console.log("Received request body:", req.body);

//     // Validate input fields
//     if (!companyId || !competitor || !followers) {
//       console.error('Missing required fields: companyId, competitor, or followers');
//       return res.status(400).json({ error: 'Missing required fields: companyId, competitor, or followers' });
//     }

//     const {
//       competitorName,
//       competitorWebsite,
//       competitorIndustry,
//     } = competitor;

//     const {
//       fbPageUrl,
//       fbFollowerCount,
//       instaPageUrl,
//       instaFollowerCount,
//       linkedinPageUrl,
//       linkedinFollowerCount,
//       smpGoogleReviewUrl,
//       googleReviewCount,
//       tiktokPageUrl,
//       tiktokFollowerCount,
//       snapchatPageUrl,
//       snapchatFollowerCount

//     } = followers;

//     // Validate required fields
//     if (
//       !competitorName ||
//       !competitorWebsite ||
//       !competitorIndustry ||
//       !fbPageUrl ||
//       !instaPageUrl ||
//       !smpGoogleReviewUrl
//     ) {
//       console.error('Missing required competitor or follower fields');
//       return res.status(400).json({ error: 'Missing required competitor or follower fields' });
//     }

//     try {
//       console.log('Starting transaction...');

//       connection_trn.beginTransaction((err) => {
//         if (err) {
//           console.error('Failed to start transaction:', err.message);
//           return res.status(500).json({ error: 'Failed to start transaction', details: err.message });
//         }

//         // Insert company into COMPA_COMPANIES
//         console.log('Inserting into COMPA_COMPANIES with data:', [competitorName, competitorWebsite, competitorIndustry]);
//         connection_trn.query(
//           'INSERT INTO COMPA_COMPANIES (NAME, WEBSITE, INDUSTRY) VALUES (?, ?, ?)',
//           [competitorName, competitorWebsite || null, competitorIndustry || null],
//           (err, companyResult) => {
//             if (err) {
//               console.error('Error inserting company:', err.message);
//               return connection_trn.rollback(() => {
//                 return res.status(500).json({ error: 'Error adding company', details: err.message });
//               });
//             }

//             const newCompanyId = companyResult.insertId; // New company ID
//             console.log('Company inserted successfully with companyId:', newCompanyId);

//             // Insert competitor into COMPA_COMPETITORS
//             console.log('Inserting competitor with companyId:', newCompanyId, 'and competCompanyId:', companyId);
//             connection_trn.query(
//               'INSERT INTO COMPA_COMPETITORS (NAME, WEBSITE, FB_URL, INSTA_URL, GOGL_RVW_URL, INDUSTRY, COMPANY_ID, COMPET_COMPANY_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
//               [
//                 competitorName,
//                 competitorWebsite || null,
//                 fbPageUrl || null,
//                 instaPageUrl || null,
//                 smpGoogleReviewUrl || null,
//                 competitorIndustry || null,
//                 newCompanyId, // COMPANY_ID from the new company
//                 companyId,    // COMPET_COMPANY_ID from req.body
//               ],
//               (err) => {
//                 if (err) {
//                   console.error('Error inserting competitor:', err.message);
//                   return connection_trn.rollback(() => {
//                     return res.status(500).json({ error: 'Error adding competitor', details: err.message });
//                   });
//                 }

//                 console.log('Competitor inserted successfully.');

//                 // Insert followers into SMP_FOLLOWERS
//                 console.log('Inserting followers data for companyId:', newCompanyId);
//                 connection_trn.query(
//                   'INSERT INTO SMP_FOLLOWERS (COMPANY_ID, FB_PAGE_URL, FB_FOLLOWER_COUNT, INSTA_PAGE_URL, INSTA_FOLLOWER_COUNT, LINKEDIN_PAGE_URL, LINKEDIN_FOLLOWER_COUNT, GOOGLE_REVIEW_URL, GOOGLE_REVIEW_COUNT, TIKTOK_PAGE_URL, TIKTOK_FOLLOWER_COUNT, SNAPCHAT_PAGE_URL, SNAPCHAT_FOLLOWER_COUNT, STATUS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
//                   [
//                     newCompanyId, // COMPANY_ID from the new company
//                     fbPageUrl || null,
//                     fbFollowerCount || 0,
//                     instaPageUrl || null,
//                     instaFollowerCount || 0,
//                     linkedinPageUrl || null,
//                     linkedinFollowerCount || 0,
//                     smpGoogleReviewUrl || null,
//                     googleReviewCount || 0,
//                     tiktokPageUrl || null,
//                     tiktokFollowerCount || 0,
//                     snapchatPageUrl || null,
//                     snapchatFollowerCount || 0,
//                      'ACTIVE',
//                   ],
//                   (err) => {
//                     if (err) {
//                       console.error('Error inserting followers:', err.message);
//                       return connection_trn.rollback(() => {
//                         return res.status(500).json({ error: 'Error adding followers', details: err.message });
//                       });
//                     }

//                     console.log('Followers data inserted successfully.');

//                     // Commit the transaction
//                     connection_trn.commit((err) => {
//                       if (err) {
//                         console.error('Error committing transaction:', err.message);
//                         return connection_trn.rollback(() => {
//                           return res.status(500).json({ error: 'Failed to commit transaction', details: err.message });
//                         });
//                       }
//                       console.log('Transaction committed successfully.');
//                       res.status(201).json({
//                         message: 'Company, competitor, and followers added successfully',
//                         companyId: newCompanyId,
//                       });
//                     });
//                   }
//                 );
//               }
//             );
//           }
//         );
//       });
//     } catch (error) {
//       console.error('Unexpected error occurred:', error.message);
//       res.status(500).json({
//         error: 'Unexpected error occurred while adding company, competitor, and followers',
//         details: error.message,
//       });
//     }
//   });

app.post("/add-company-with-competitor-and-followers", (req, res) => {
    const { companyId, competitor, followers } = req.body;

    if (!companyId || !competitor || !followers) {
        return res.status(400).json({
            error: "Missing required fields: companyId, competitor, or followers",
        });
    }

    const { competitorName, competitorWebsite, competitorIndustry } =
        competitor;

    const {
        fbPageUrl,
        fbFollowerCount,
        instaPageUrl,
        instaFollowerCount,
        linkedinPageUrl,
        linkedinFollowerCount,
        smpGoogleReviewUrl,
        googleReviewCount,
        tiktokPageUrl,
        tiktokFollowerCount,
        snapchatPageUrl,
        snapchatFollowerCount,
    } = followers;

    if (
        !competitorName ||
        !competitorWebsite ||
        !competitorIndustry ||
        !fbPageUrl ||
        !instaPageUrl ||
        !smpGoogleReviewUrl
    ) {
        return res
            .status(400)
            .json({ error: "Missing required competitor or follower fields" });
    }

    // Insert into COMPA_COMPANIES
    const insertCompanyQuery =
        "INSERT INTO COMPA_COMPANIES (NAME, WEBSITE, INDUSTRY) VALUES (?, ?, ?)";
    connection_trn.query(
        insertCompanyQuery,
        [competitorName, competitorWebsite || null, competitorIndustry || null],
        (err, companyResult) => {
            if (err) {
                console.error("Error inserting company:", err.message);
                return res.status(500).json({
                    error: "Error adding company",
                    details: err.message,
                });
            }

            const newCompanyId = companyResult.insertId;

            // Insert into COMPA_COMPETITORS
            const insertCompetitorQuery =
                "INSERT INTO COMPA_COMPETITORS (NAME, WEBSITE, FB_URL, INSTA_URL, GOGL_RVW_URL, INDUSTRY, COMPANY_ID, COMPET_COMPANY_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            const competitorValues = [
                competitorName,
                competitorWebsite || null,
                fbPageUrl || null,
                instaPageUrl || null,
                smpGoogleReviewUrl || null,
                competitorIndustry || null,
                newCompanyId,
                companyId,
            ];

            connection_trn.query(
                insertCompetitorQuery,
                competitorValues,
                (err) => {
                    if (err) {
                        console.error(
                            "Error inserting competitor:",
                            err.message
                        );
                        return res.status(500).json({
                            error: "Error adding competitor",
                            details: err.message,
                        });
                    }

                    // Insert into SMP_FOLLOWERS
                    const insertFollowersQuery =
                        "INSERT INTO SMP_FOLLOWERS (COMPANY_ID, FB_PAGE_URL, FB_FOLLOWER_COUNT, INSTA_PAGE_URL, INSTA_FOLLOWER_COUNT, LINKEDIN_PAGE_URL, LINKEDIN_FOLLOWER_COUNT, GOOGLE_REVIEW_URL, GOOGLE_REVIEW_COUNT, TIKTOK_PAGE_URL, TIKTOK_FOLLOWER_COUNT, SNAPCHAT_PAGE_URL, SNAPCHAT_FOLLOWER_COUNT, STATUS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    const followerValues = [
                        newCompanyId,
                        fbPageUrl || null,
                        fbFollowerCount || 0,
                        instaPageUrl || null,
                        instaFollowerCount || 0,
                        linkedinPageUrl || null,
                        linkedinFollowerCount || 0,
                        smpGoogleReviewUrl || null,
                        googleReviewCount || 0,
                        tiktokPageUrl || null,
                        tiktokFollowerCount || 0,
                        snapchatPageUrl || null,
                        snapchatFollowerCount || 0,
                        "ACTIVE",
                    ];

                    connection_trn.query(
                        insertFollowersQuery,
                        followerValues,
                        (err) => {
                            if (err) {
                                console.error(
                                    "Error inserting followers:",
                                    err.message
                                );
                                return res.status(500).json({
                                    error: "Error adding followers",
                                    details: err.message,
                                });
                            }

                            res.status(201).json({
                                message:
                                    "Company, competitor, and followers added successfully",
                                companyId: newCompanyId,
                            });
                        }
                    );
                }
            );
        }
    );
});

app.get("/api/tools", (req, res) => {
    console.log("Fetching tools from database...");
    const query = `SELECT t.NAME, t.DESCRIPTION FROM COMPA_TOOLS t`;

    connection_trn.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching tools:", err);
            return res.status(500).json({ error: "Error fetching tools" });
        }
        console.log("Tools fetched successfully:", results);
        res.json(results);
    });
});

app.post("/api/check-firmid", (req, res) => {
    const { firmid } = req.body;

    if (!firmid) {
        return res.status(400).json({ error: "Firm ID is required." });
    }

    const query = "SELECT 1 FROM COMPA_COMPANIES WHERE ID = ?";

    connection_trn.query(query, [firmid], (err, results) => {
        if (err) {
            console.error("Error querying the database:", err);
            return res.status(500).json({ error: "Internal server error." });
        }

        if (results.length > 0) {
            // Firm ID exists
            return res.json({ exists: true });
        } else {
            // Firm ID does not exist
            return res.json({ exists: false });
        }
    });
});

// Assuming `connection_trn` is your MySQL connection
app.post("/api/add-followers", (req, res) => {
    const data = req.body;

    // Query to insert company details into the COMPA_COMPANIES table
    const companyQuery = `
      INSERT INTO COMPA_COMPANIES 
      (ID, NAME, WEBSITE, INDUSTRY) 
      VALUES (?, ?, ?, ?)
    `;
    const companyValues = [
        data.companyId,
        data.companyName,
        data.CompanyWebsite,
        data.companyType,
    ];

    // Query to insert social media details into the SMP_FOLLOWERS table
    const followersQuery = `
      INSERT INTO SMP_FOLLOWERS 
      (COMPANY_ID,  FB_PAGE_URL, FB_FOLLOWER_COUNT, INSTA_PAGE_URL, INSTA_FOLLOWER_COUNT, 
      LINKEDIN_PAGE_URL, LINKEDIN_FOLLOWER_COUNT, GOOGLE_REVIEW_URL, GOOGLE_REVIEW_COUNT, 
      TIKTOK_PAGE_URL, TIKTOK_FOLLOWER_COUNT, SNAPCHAT_PAGE_URL, SNAPCHAT_FOLLOWER_COUNT) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const followersValues = [
        data.companyId,
        data.fbPageUrl,
        data.fbFollowerCount,
        data.instaPageUrl,
        data.instaFollowerCount,
        data.linkedinPageUrl,
        data.linkedinFollowerCount,
        data.googleReviewUrl,
        data.googleReviewCount,
        data.tiktokPageUrl,
        data.tiktokFollowerCount,
        data.snapchatPageUrl,
        data.snapchatFollowerCount,
    ];

    // Insert company details first
    connection_trn.query(companyQuery, companyValues, (err, result) => {
        if (err) {
            console.error("Error inserting company data:", err);
            return res
                .status(500)
                .json({ error: "Failed to insert company data." });
        }

        // Insert social media followers data after the company insert
        connection_trn.query(followersQuery, followersValues, (err, result) => {
            if (err) {
                console.error("Error inserting follower data:", err);
                return res
                    .status(500)
                    .json({ error: "Failed to insert follower data." });
            }

            res.json({ message: "Data added successfully!" });
        });
    });
});

// app.post('/check-llm', (req, res) => {
//     const { USERID, FIRMID, selectedLlm } = req.body;

//     console.log('Received request to check LLM:', { USERID, FIRMID, selectedLlm });

//     const query = `
//       SELECT COUNT(*) AS count FROM LLM_DETAILS
//       WHERE USERID = ? AND FIRMID = ? AND LLM_PROVIDER = ?
//     `;

//     console.log('Executing query:', query);
//     console.log('Query parameters:', [USERID, FIRMID, selectedLlm]);

//     connection_trn.query(query, [USERID, FIRMID, selectedLlm], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err);
//             return res.status(500).json({ success: false, message: 'Internal Server Error' });
//         }

//         console.log('Query results:', results);

//         if (results[0].count > 0) {
//             console.log('Record found, count:', results[0].count);
//             return res.status(200).json({ success: true, message: 'Record exists' });
//         }

//         console.log('Record not found, count:', results[0].count);
//         return res.status(200).json({ success: false, message: 'Record does not exist' });
//     });
// });

app.post("/check-llm", (req, res) => {
    const { USERID, FIRMID, selectedLlm } = req.body;

    console.log("Received request to check LLM:", {
        USERID,
        FIRMID,
        selectedLlm,
    });

    const query = `
      SELECT API_KEY FROM API_KEY_MANAGER
      WHERE USERID = ? AND FIRMID = ? AND LLM_PROVIDER = ? AND STATUS = 'ACTIVE'
    `;

    console.log("Executing query:", query);
    console.log("Query parameters:", [USERID, FIRMID, selectedLlm]);

    connection_trn.query(
        query,
        [USERID, FIRMID, selectedLlm],
        (err, results) => {
            if (err) {
                console.error("Error executing query:", err);
                return res
                    .status(500)
                    .json({ success: false, message: "Internal Server Error" });
            }

            console.log("Query results:", results);

            if (results.length > 0 && results[0].API_KEY) {
                const apiKey = results[0].API_KEY;

                console.log("API Key saved to session:", apiKey);
                return res
                    .status(200)
                    .json({ success: true, message: "Record exists", apiKey });
            }

            console.log("Record not found");
            return res
                .status(200)
                .json({ success: false, message: "Record does not exist" });
        }
    );
});

// app.post('/generate', async (req, res) => {
//     const { diseases, confirmedLlm, USERID, FIRMID, num_samples = 100 } = req.body;

//     console.log("confirmedLlm", confirmedLlm)

//     // Split the comma-separated input into individual disease names
//     let diseaseList = diseases.split(',').map(disease => disease.trim());
//     console.log(`[INFO] Diseases received: ${diseaseList}`);

//     // Process each disease name with typo-js
//     diseaseList = diseaseList.map(disease => {
//         if (!dictionary.check(disease)) { // Check if the disease name is misspelled
//             const suggestions = dictionary.suggest(disease);
//             if (suggestions.length > 0) {
//                 console.log(`[INFO] Correcting misspelled disease '${disease}' to '${suggestions[0]}'`);
//                 return suggestions[0]; // Automatically use the first suggestion
//             } else {
//                 console.log(`[WARNING] No suggestions found for '${disease}', using original.`);
//                 return disease; // Fallback to the original if no suggestions are found
//             }
//         }
//         return disease; // Return the disease if it's not misspelled
//     });

//     console.log(`[INFO] Diseases after spell-checking: ${diseaseList}`);

//     const results = [];

//     try {
//         for (const disease of diseaseList) {
//             console.log(`[INFO] Processing disease: ${disease}`);

//             const { parentId, params } = await new Promise((resolve, reject) => {
//                 getParametersForDisease(disease, (result) => {
//                     if (!result.params || result.params.length === 0) {
//                         reject(`No parameters found for disease: ${disease}`);
//                     } else {
//                         resolve(result); // result will contain both parentId and params
//                     }
//                 });
//             });

//             console.log(`[INFO] Parameters for disease '${disease}': ${params}`);

//             try {
//                 // Generate synthetic data for the disease
//                 const datasetFilename = generateSyntheticData(disease, params, num_samples);
//                 console.log(`[INFO] Dataset generated for disease '${disease}' and saved as: ${datasetFilename}`);

//                 const mlCodeFilename = await new Promise((resolve, reject) => {
//                     generateMLCode(disease, params, parentId, datasetFilename, confirmedLlm, USERID, FIRMID, (mlCodeFilename, error, codeContent) => {
//                         if (error) {
//                             reject(`Error in ML code generation for disease '${disease}': ${error}`);
//                         } else {
//                             resolve({ filename: mlCodeFilename, codeContent });
//                         }
//                     });
//                 });

//                 console.log(`[INFO] ML code generation successful for disease '${disease}'.`);

//                 // Add the result to the results array
//                 results.push({
//                     disease,
//                     parentId, // Include the parentId here
//                     dataset: path.basename(datasetFilename),
//                     code: path.basename(mlCodeFilename.filename),
//                     codeContent: mlCodeFilename.codeContent, // Send the code content to frontend
//                 });

//             } catch (error) {
//                 console.error(`[ERROR] Error generating data or ML code for disease '${disease}': ${error}`);
//             }
//         }

//         // All diseases processed, send the response
//         console.log(`[INFO] All diseases processed.`);
//         res.json({ results });

//     } catch (error) {
//         console.error(`[ERROR] Error processing diseases: ${error}`);
//         res.status(500).json({ error: error.message });
//     }
// });

function processDiseaseAiMasterAsync(
    diseaseName,
    llmName,
    userid,
    firmid,
    ipAddress,
    sindex
) {
    return new Promise((resolve, reject) => {
        processDiseaseAiMaster(
            diseaseName,
            llmName,
            userid,
            firmid,
            ipAddress,
            sindex,
            (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }
        );
    });
}

app.post("/generate", async (req, res) => {
    const {
        diseases,
        confirmedLlm,
        USERID,
        FIRMID,
        num_samples = 100,
        sindex,
        generateQuestions,
    } = req.body;

    console.log("confirmedLlm", confirmedLlm);

    const ipAddress =
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Split the comma-separated input into individual disease names
    const diseaseList = diseases.split(",").map((disease) => disease.trim());
    console.log(`[INFO] Diseases received: ${diseaseList}`);

    const results = [];

    try {
        // Process each disease and wait for all to complete
        await Promise.all(
            diseaseList.map(async (disease) => {
                console.log(`[INFO] Processing disease: ${disease}`);

                // Wait for processDiseaseAiMaster to complete
                await processDiseaseAiMasterAsync(
                    disease,
                    confirmedLlm,
                    USERID,
                    FIRMID,
                    ipAddress,
                    sindex
                );

                // Fetch parameters for the disease
                const { parentId, params } = await new Promise(
                    (resolve, reject) => {
                        getParametersForDisease(disease, (result) => {
                            if (!result.params || result.params.length === 0) {
                                reject(
                                    `No parameters found for disease: ${disease}`
                                );
                            } else {
                                resolve(result);
                            }
                        });
                    }
                );

                console.log(
                    `[INFO] Parameters for disease '${disease}': ${params}`
                );

                // Generate synthetic data for the disease
                const datasetFilename = generateSyntheticData(
                    disease,
                    params,
                    num_samples
                );
                console.log(
                    `[INFO] Dataset generated for disease '${disease}' and saved as: ${datasetFilename}`
                );

                if (generateQuestions) {
                    let questions = [];
                    try {
                        questions = await generateQuestionsAsync(
                            disease,
                            params,
                            sindex,
                            confirmedLlm,
                            USERID,
                            FIRMID,
                            ipAddress
                        );
                        console.log(
                            `[INFO] Generated questions for '${disease}':`,
                            questions
                        );
                    } catch (err) {
                        console.error(
                            `[ERROR] Failed to generate questions for '${disease}':`,
                            err
                        );
                    }
                }

                const mlCodeResult = await new Promise((resolve, reject) => {
                    generateMLCode(
                        disease,
                        params,
                        parentId,
                        datasetFilename,
                        confirmedLlm,
                        USERID,
                        FIRMID,
                        ipAddress,
                        (mlCodeFilename, error, codeContent) => {
                            if (error) {
                                reject(
                                    `Error in ML code generation for disease '${disease}': ${error}`
                                );
                            } else {
                                resolve({
                                    filename: mlCodeFilename,
                                    codeContent,
                                });
                            }
                        }
                    );
                });

                console.log(
                    `[INFO] ML code generation successful for disease '${disease}'.`
                );

                // Add the result to the results array
                results.push({
                    disease,
                    parentId, // Include the parentId here
                    dataset: path.basename(datasetFilename),
                    code: path.basename(mlCodeResult.filename),
                    codeContent: mlCodeResult.codeContent, // Send the code content to frontend
                });
            })
        );

        // All diseases processed, send the response
        console.log(`[INFO] All diseases processed.`);
        res.json({ results });
    } catch (error) {
        console.error(`[ERROR] Error processing diseases: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

function getParametersForDisease(diseaseName, callback) {
    const query = `
      SELECT PARENT_ID FROM ai_master
      WHERE PARENT_ID IS NOT NULL AND AI_PROGRAM=?
    `;
    console.log(`Fetching parameters for disease: ${diseaseName}`);
    connection_trn.query(query, [diseaseName], (err, result) => {
        if (err) {
            console.error(
                "Error fetching parameters for disease:",
                err.message
            );
            return callback({ parentId: null, params: [] });
        }
        if (result.length === 0) {
            console.log(`No parameters found for disease: ${diseaseName}`);
            return callback({ parentId: null, params: [] });
        }

        const parentId = result[0].PARENT_ID;
        const paramQuery = `SELECT name FROM procedure_type WHERE parent = ? and STATUS='ACTIVE'`;
        connection_trn.query(paramQuery, [parentId], (err, params) => {
            if (err) {
                console.error("Error fetching procedure types:", err.message);
                return callback({ parentId: null, params: [] });
            }
            console.log(
                `Found ${params.length} parameters for disease: ${diseaseName}`
            );
            callback({
                parentId: parentId,
                params: params.map((param) => param.name),
            });
        });
    });
}

function generateSyntheticData(disease, params, numSamples = 100) {
    const records = [];

    for (let i = 0; i < numSamples; i++) {
        const row = {};
        params.forEach((param) => {
            row[param] = Math.floor(Math.random() * 100) + 1;
        });
        row[`${disease} Outcome`] = Math.random() < 0.5 ? 0 : 1; // 50% probability for outcome
        records.push(row);
    }

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");
    const fullPath = path.join(
        GENERATED_CODE_DIR,
        `${disease.toLowerCase()}_data_${timestamp}.csv`
    );
    const filename = path.basename(fullPath); // Extract only the filename

    // Convert records to CSV format
    const csvContent = stringify(records, { header: true });

    // Ensure directory exists
    if (!fs.existsSync(GENERATED_CODE_DIR)) {
        fs.mkdirSync(GENERATED_CODE_DIR, { recursive: true });
    }

    fs.writeFileSync(fullPath, csvContent);
    console.log(`Synthetic data generated and saved to ${filename}`);
    return filename; // Return only the filename
}

function insertTaskLog(
    disease,
    llmName,
    userid,
    firmid,
    loginIp,
    gentype,
    callback
) {
    const query = `
        INSERT INTO AIA_TASK_LOG (AIA_TASK_DETAIL,GEN_TYPE,LLM_USED, USERID,FIRMID, LOGIN_IP, AIA_LOG_DATE)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [disease, gentype, llmName, userid, firmid, loginIp];

    connection_trn.query(query, values, (err, result) => {
        if (err) {
            console.error("[ERROR] Failed to insert task log:", err);
            return callback(err, null);
        }
        console.log(
            "[INFO] Task log inserted successfully. Log ID:",
            result.insertId
        );
        callback(null, result.insertId);
    });
}

function generateMLCode(
    disease,
    params,
    parentId,
    datasetFilename,
    llmName,
    userid,
    firmid,
    ipAddress,
    callback
) {
    console.log(`[INFO] Requesting ML code generation for disease: ${disease}`);
    console.log("[INFO] Parameters:", params);
    console.log("[INFO] Dataset filename:", datasetFilename);
    console.log("[DEBUG] Calling getApiKeyFromDb...");

    getLlmConfig(llmName, userid, firmid, (err, llmConfig) => {
        if (err) {
            console.error("[ERROR] Failed to fetch LLM configuration:", err);
            return callback(err, null);
        }

        console.log("[DEBUG] Retrieved LLM configuration:", llmConfig);

        if (!llmConfig || !llmConfig.headers) {
            console.error("[ERROR] Invalid LLM configuration:", llmConfig);
            return callback(new Error("Invalid LLM configuration"), null);
        }

        console.log("[DEBUG] Updating headers with API key...");
        // llmConfig.headers.Authorization = `Bearer ${apiKey}`;

        const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, "");
        const filename = `Train${disease
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join("")}Model_${timestamp}.py`;
        const outputDir = "./generated_code";

        fs.mkdirSync(outputDir, { recursive: true });
        console.log("[INFO] Generated output filename:", filename);

        const paramsStr = params.join(", ");
        const conversationHistory = [
            { role: "system", content: "You are a helpful assistant." },
            {
                role: "user",
                content: `Generate a single Python script to train a Decision Tree model on a dataset named \"${datasetFilename}\". The dataset contains columns: ${paramsStr} and \"${disease} Outcome\".  
        
        The script should follow these steps:  
        1. Load the dataset.  
        2. Preprocess the data (handle missing values, encode categorical variables).  
        3. Split the data into training and testing sets.  
        4. Train a Decision Tree model using scikit-learn.  
        5. Evaluate using metrics: Accuracy, Sensitivity, Specificity, and AUC.  
        6. Print '1' if both sensitivity and specificity are ≥ 0.9; otherwise, print '0'.  
        7. Accept user input from the command line via \`sys.argv\`, allowing real-time predictions in this format:  
           \`python script_name.py  <user_input_values>\`  
        
        **Important:** The response should contain exactly **one** Python code block enclosed by triple backticks (\` \`\`) and **no additional code blocks.**`,
            },
        ];

        const data = llmConfig.inputData(conversationHistory);

        console.log("[DEBUG] Input data for API request:", data);

        console.log("llmConfig.apiUrl", llmConfig.apiUrl);

        axios
            .post(llmConfig.apiUrl, data, { headers: llmConfig.headers })
            .then(async (response) => {
                // console.log('[INFO] Response received:', response);

                const assistant_message = llmConfig.responseExtractor(response);
                console.log(
                    "[DEBUG] Extracted assistant message:",
                    assistant_message
                );

                if (llmConfig.postProcess) {
                    console.log("[DEBUG] Running post-process function...");
                    await llmConfig.postProcess(response);
                }

                if (assistant_message) {
                    console.log(
                        "[INFO] ML code generation response received. Cleaning the code..."
                    );

                    insertTaskLog(
                        disease,
                        llmName,
                        userid,
                        firmid,
                        ipAddress,
                        "CODEGEN",
                        (err, logId) => {
                            if (err) {
                                console.error(
                                    "[ERROR] Failed to log AI task:",
                                    err
                                );
                            } else {
                                console.log(
                                    `[INFO] Task log inserted with ID: ${logId}`
                                );
                            }
                        }
                    );

                    conversationHistory.push({
                        role: "assistant",
                        content: assistant_message,
                    });

                    const cleanedCode = cleanCode(assistant_message);

                    if (!cleanedCode) {
                        console.error("[ERROR] Cleaned code is empty.");
                        return callback(
                            null,
                            "[ERROR] Generated code is invalid or empty."
                        );
                    }

                    console.log(
                        "[INFO] Code cleaned successfully. Saving to file..."
                    );
                    fs.writeFileSync(
                        path.join(outputDir, filename),
                        cleanedCode
                    );
                    console.log("[INFO] Generated ML code saved as", filename);

                    const fullPath = path.resolve(
                        path.join(outputDir, filename)
                    );
                    console.log("[INFO] Full path to saved file:", fullPath);

                    saveFilePathToDb(
                        userid,
                        fullPath,
                        cleanedCode,
                        parentId,
                        JSON.stringify(conversationHistory)
                    );

                    console.log("[INFO] File path saved to database.");
                    callback(filename, null, cleanedCode);
                } else {
                    console.error(
                        "[ERROR] No valid message in response from LLM."
                    );
                    callback(
                        null,
                        "[ERROR] No valid message in response from LLM."
                    );
                }
            })
            .catch((error) => {
                console.error(
                    "[ERROR] Error during ML code generation:",
                    error.message
                );
                callback(null, error.message);
            });
    });
}

const llmConfig = {
    ollama: {
        apiUrl: OLLAMA_API_URL,
        headers: { ...HEADERS },
        inputData: (conversationHistory) => ({
            model: "llama3.1",
            messages: conversationHistory,
            stream: false,
        }),
        responseExtractor: (response) => response.data.message?.content || "",
        postProcess: null,
    },
    openrouter: {
        apiUrl: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
            Authorization: "Bearer <API_KEY>", // Placeholder for dynamic API key
            "HTTP-Referer": "<YOUR_SITE_URL>", // Optional
            "X-Title": "<YOUR_SITE_NAME>", // Optional
        },
        inputData: (conversationHistory) => ({
            model: "meta-llama/llama-3.3-70b-instruct:free",
            messages: conversationHistory,
        }),
        responseExtractor: (response) =>
            response.data.choices[0].message?.content || "",
        postProcess: null,
    },
    groq: {
        apiUrl: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
            Authorization: "Bearer <API_KEY>", // Placeholder for dynamic API key
        },
        inputData: (conversationHistory) => ({
            model: "llama-3.3-70b-versatile",
            messages: conversationHistory,
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
            stream: false,
        }),
        responseExtractor: (response) =>
            response.data.choices[0].message?.content || "",
        postProcess: async (response) => {
            const responseHeaders = response.headers;
            await handleGroqRateLimit(responseHeaders);
        },
    },
};

function getLlmConfig(llmName, userid, firmid, callback) {
    console.log("[DEBUG] Fetching LLM config for:", llmName);

    const config = llmConfig[llmName.toLowerCase()];
    console.log("[DEBUG] Retrieved config:", config);

    if (!config) {
        const error = new Error(`Unsupported LLM: ${llmName}`);
        console.error("[ERROR]", error.message);
        return callback(error, null);
    }

    console.log("llmName.toLowerCase()", llmName.toLowerCase());

    if (llmName.toLowerCase() === "ollama") {
        console.log("[INFO] OLLAMA does not require an API key.");
        return callback(null, config); // Return the config directly without adding an API key
    }

    getApiKeyFromDb(userid, firmid, llmName, (err, apiKey) => {
        if (err) {
            console.error("[ERROR] Failed to fetch API key:", err);
            return callback(err, null);
        }

        if (llmName.toLowerCase() === "ollama") {
            console.log("[INFO] Skipping API key for OLLAMA.");
            return callback(null, llmConfig[llmName.toLowerCase()]);
        }

        console.log("[DEBUG] Retrieved API key for headers update:", apiKey);

        if (!config.headers) {
            console.error("[ERROR] Config headers are undefined:", config);
            return callback(new Error("Config headers are undefined"), null);
        }

        config.headers.Authorization = `Bearer ${apiKey}`;
        console.log("[INFO] Updated headers with API key:", config.headers);

        return callback(null, config);
    });
}

function getApiKeyFromDb(userid, firmid, llmName, callback) {
    console.log("[DEBUG] Fetching API key from DB");

    const query = `SELECT API_KEY 
      FROM API_KEY_MANAGER 
      WHERE USERID = ? AND FIRMID = ? AND LLM_PROVIDER = ? AND STATUS = 'ACTIVE'`;

    connection_trn.query(
        query,
        [userid, firmid, llmName.toUpperCase()],
        (err, results) => {
            if (err) {
                console.error("[ERROR] Failed to retrieve API key:", err);
                return callback(err, null);
            }

            console.log("[DEBUG] Query results:", results);

            if (results.length === 0) {
                const error = new Error(
                    "No active API key found for the given details."
                );
                console.error("[ERROR]", error.message);
                return callback(error, null);
            }

            const apiKey = results[0].API_KEY;
            console.log("[INFO] Retrieved API key successfully:", apiKey);
            callback(null, apiKey);
        }
    );
}

function cleanCode(rawCode) {
    /**
     * Extracts and cleans code enclosed in triple backticks (```) from the provided text.
     * Removes surrounding text and retains code formatting.
     */
    const codeBlocks = [...rawCode.matchAll(/```(?:\w+)?\n(.*?)```/gs)].map(
        (match) => match[1]
    );
    const cleanedCode = codeBlocks.length > 0 ? codeBlocks.join("\n\n") : "";
    return cleanedCode
        .split("\n")
        .filter((line) => line.trim() !== "")
        .join("\n");
}

function saveFilePathToDb(
    userId,
    filePath,
    cleanedCode,
    parentId,
    conversationHistory
) {
    const query = `
        INSERT INTO USER_PYTHON_SAVE (USERID, DISEASE_PARENT_ID, PYTHON_PATH, PYTHON_CODE, CONVERSATIONHISTORY)
        VALUES (?, ?, ?, ?, ?)
    `;

    const normalizedPath = path.normalize(filePath); // Normalize the file path
    const formattedPath = normalizedPath.replace(/\\/g, "/");

    try {
        console.log(`Executing query: ${query}`);
        // Execute the query with the normalized path
        connection_trn.query(
            query,
            [userId, parentId, formattedPath, cleanedCode, conversationHistory],
            (error, results) => {
                if (error) {
                    console.error(
                        `Error saving file path to the database: ${error.message}`
                    );
                    return;
                }
                console.log(
                    `File path ${normalizedPath} saved to the database with ID: ${results.insertId}`
                );
                // res.status(200).json({ message: 'Data updated successfully', filePath });
            }
        );
    } catch (error) {
        console.error(`Unexpected error: ${error.message}`);
    }
}

const handleGroqRateLimit = (headers) => {
    if (headers["x-ratelimit-remaining"] === "0") {
        console.log("Rate limit exceeded. Retrying after delay...");
        return new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds
    }
};

// API to download files
app.get("/download/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(GENERATED_CODE_DIR, filename);

    if (fs.existsSync(filePath)) {
        console.log(`File '${filename}' found for download.`);
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error("Error during file download:", err);
                return res
                    .status(500)
                    .json({ error: "Error occurred during file download." });
            }
        });
    } else {
        console.log(`File '${filename}' not found for download.`);
        res.status(404).json({ error: "File not found" });
    }
});

app.post("/execute", async (req, res) => {
    // Extract User ID and Disease Parent ID from the request body
    const { userid, diseaseParentId, sindex } = req.body;

    // Validate input parameters
    if (!userid || !diseaseParentId) {
        return res
            .status(400)
            .json({ error: "User ID and Disease Parent ID are required." });
    }

    try {
        console.log(
            `Executing ML model for User ID: ${userid} and Disease Parent ID: ${diseaseParentId}`
        );

        // Step 1: Count number of parameters for this disease
        const paramCount = await getParameterCountForDisease(diseaseParentId);
        if (paramCount <= 0) {
            return res
                .status(400)
                .json({ error: "No parameters found for this disease." });
        }
        console.log(
            `Number of parameters for Disease Parent ID ${diseaseParentId}: ${paramCount}`
        );

        // Step 2: Generate input values (1 repeated for each parameter)
        const inputValues = Array(paramCount).fill(1).join(" ");
        console.log(`Generated input values for Python script: ${inputValues}`);

        // Step 3: Fetch Python script path
        const pythonData = await getPythonPath(userid, diseaseParentId);
        if (!pythonData || !pythonData.PYTHON_PATH) {
            console.log(
                "No Python file found for the given user and disease parent ID."
            );
            return res.status(404).json({
                error: "No Python file found for this disease. Please generate ML code first.",
            });
        }

        const pythonPath = pythonData.PYTHON_PATH;
        console.log(`Python file found: ${pythonPath}`);
        const scriptDir = path.dirname(pythonPath);

        // Step 4: Execute Python script with auto-generated parameters
        exec(
            `python3.7 "${pythonPath}" ${inputValues}`,
            { cwd: scriptDir },
            (err, stdout, stderr) => {
                if (err) {
                    console.error("Error executing Python file:", stderr);
                    return res.status(200).json({
                        status: "error",
                        error: `Execution error: ${stderr}`,
                    });
                }

                console.log(
                    "Python file executed successfully. Output:",
                    stdout
                );

                if (stdout.trim() === "1" || stdout.trim() === "0") {
                    saveFilePathToai_master(
                        pythonPath,
                        sindex,
                        diseaseParentId
                    );
                }

                return res.json({ status: "success", output: stdout.trim() });
            }
        );
    } catch (error) {
        console.error("Unexpected Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

function saveFilePathToai_master(pythonPath, sindex, diseaseParentId) {
    const query = `
        update  ai_master set AI_TYPE=?, PROD_PY_PATH=? where PARENT_ID=?

    `;

    const normalizedPath = path.normalize(pythonPath); // Normalize the file path
    try {
        console.log(`Executing query: ${query}`);
        // Execute the query with the normalized path
        connection_trn.query(
            query,
            [sindex, pythonPath, diseaseParentId],
            (error, results) => {
                if (error) {
                    console.error(
                        `Error saving file path to the database: ${error.message}`
                    );
                    return;
                }
                console.log(
                    `File path ${normalizedPath} saved to the database with ID: ${results.insertId}`
                );
                // res.status(200).json({ message: 'Data updated successfully', filePath });
            }
        );
    } catch (error) {
        console.error(`Unexpected error: ${error.message}`);
    }
}

// ✅ Function to count parameters for a specific disease
function getParameterCountForDisease(diseaseParentId) {
    return new Promise((resolve, reject) => {
        console.log(
            `Querying parameter count for Disease Parent ID: ${diseaseParentId}`
        );

        const query = `
        SELECT COUNT(*) AS param_count 
        FROM procedure_type 
        WHERE parent = ?`;

        connection_trn.query(query, [diseaseParentId], (err, results) => {
            if (err) {
                console.error("Database query error:", err.message);
                return reject({
                    status: "error",
                    error: `Database query error: ${err.message}`,
                });
            }

            if (results.length === 0 || results[0].param_count === 0) {
                console.log("No parameters found for this disease.");
                return resolve(0);
            }

            console.log(
                `Parameter count for Disease Parent ID ${diseaseParentId}: ${results[0].param_count}`
            );
            resolve(results[0].param_count);
        });
    });
}

// ✅ Function to fetch Python script path from the database
function getPythonPath(userid, diseaseParentId) {
    return new Promise((resolve, reject) => {
        console.log(
            `Querying database for Python path for User ID: ${userid} and Disease Parent ID: ${diseaseParentId}`
        );

        const query = `
        SELECT PYTHON_PATH 
        FROM USER_PYTHON_SAVE 
        WHERE USERID = ? AND DISEASE_PARENT_ID = ? 
        ORDER BY INSRT_DTM DESC 
        LIMIT 1`;

        connection_trn.query(
            query,
            [userid, diseaseParentId],
            (err, results) => {
                if (err) {
                    console.error("Database query error:", err.message);
                    return reject({
                        status: "error",
                        error: `Database query error: ${err.message}`,
                    });
                }

                if (results.length === 0) {
                    console.log(
                        "No results found for the given user and disease parent ID."
                    );
                    return resolve(null);
                }

                console.log(
                    `Database query successful. Python path: ${results[0].PYTHON_PATH}`
                );
                resolve(results[0]);
            }
        );
    });
}

app.post("/regenerate", (req, res) => {
    const {
        disease,
        statusCode,
        executionResult,
        parentId,
        USERID,
        FIRMID,
        confirmedLlm,
    } = req.body;

    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, "");
    const filename = `Train${disease
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")}Model_${timestamp}.py`;

    const outputDir = "./generated_code";
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`[INFO] Received regenerate request.`);
    console.log(`[INFO] Disease: ${disease}`);
    console.log(`[INFO] Status Code: ${statusCode}`);
    console.log(`[INFO] Output/Error: ${executionResult}`);
    console.log(`[INFO] Parent ID: ${parentId}`);
    console.log(`[INFO] User ID: ${USERID}`);

    const executionResultjsonString = JSON.stringify(executionResult, null, 2);
    console.log(executionResultjsonString);

    // Query the database to fetch the latest conversation history
    console.log(`[INFO] Querying database for conversation history...`);
    const query = `
      SELECT CONVERSATIONHISTORY
      FROM USER_PYTHON_SAVE
      WHERE USERID = ? AND DISEASE_PARENT_ID = ?
      ORDER BY INSRT_DTM DESC
      LIMIT 1;
    `;

    connection_trn.query(query, [USERID, parentId], (err, results) => {
        if (err) {
            console.error(`[ERROR] Database query failed: ${err.message}`);
            return res.status(500).json({ message: "Database error occurred" });
        }

        console.log(`[INFO] Database query successful.`);
        if (results.length > 0) {
            console.log(
                `[INFO] Conversation history found for the given parentId and userid.`
            );
            const conversationHistoryString = results[0].CONVERSATIONHISTORY;
            let conversationHistoryParsed;

            try {
                console.log(`[INFO] Parsing conversation history JSON.`);
                conversationHistoryParsed = JSON.parse(
                    conversationHistoryString
                );
                console.log(`[INFO] Parsed conversation history successfully.`);
            } catch (error) {
                console.error(
                    `[ERROR] Failed to parse conversation history: ${error.message}`
                );
                return res
                    .status(500)
                    .json({ message: "Error parsing conversation history" });
            }

            // Modify the conversation history based on the status code
            if (statusCode === 1) {
                console.log(
                    `[INFO] Status code is 1. Adding prompt to fix the error.`
                );
                conversationHistoryParsed.push({
                    role: "user",
                    content: `The generated code for training a Decision Tree model gave the following error: "${executionResultjsonString}". Please fix the code to address this issue,,also make sure not to remove logic for accepting inputs using sys.argv from it.`,
                });
            } else if (statusCode === 0) {
                console.log(
                    `[INFO] Status code is 0. Adding prompt to ask for next steps.`
                );
                conversationHistoryParsed.push({
                    role: "user",
                    content: `
              The script output was:
              ${executionResultjsonString}
              This is not the expected output. Modify the code to ensure that it outputs only the outcome as follows:
              - \`1\` if the outcome is true.
              - \`0\` if the outcome is false.
  
              It is mandatory that the output is strictly \`0\` or \`1\`. No additional text, characters, or keywords (e.g., 'output', 'result', etc.) should be included. The output must contain only \`0\` or \`1\`.
  
              Please revise the code to guarantee this exact behavior.
              
              also make sure not to remove logic for accepting inputs using sys.argv from it`,
                });
            }

            getLlmConfig(confirmedLlm, USERID, FIRMID, (err, llmConfig) => {
                if (err) {
                    console.error(
                        "[ERROR] Failed to fetch LLM configuration:",
                        err
                    );
                    return callback(err, null);
                }

                console.log("[DEBUG] Retrieved LLM configuration:", llmConfig);

                if (!llmConfig || !llmConfig.headers) {
                    console.error(
                        "[ERROR] Invalid LLM configuration:",
                        llmConfig
                    );
                    return callback(
                        new Error("Invalid LLM configuration"),
                        null
                    );
                }

                console.log("[DEBUG] Updating headers with API key...");

                const data = llmConfig.inputData(conversationHistoryParsed);
                console.log("[DEBUG] Input data for API request:", data);

                axios
                    .post(llmConfig.apiUrl, data, {
                        headers: llmConfig.headers,
                    })
                    .then(async (response) => {
                        console.log("[INFO] Response received:", response);

                        const assistant_message =
                            llmConfig.responseExtractor(response);
                        console.log(
                            "[DEBUG] Extracted assistant message:",
                            assistant_message
                        );

                        if (llmConfig.postProcess) {
                            console.log(
                                "[DEBUG] Running post-process function..."
                            );
                            await llmConfig.postProcess(response);
                        }

                        if (assistant_message) {
                            console.log(
                                "[INFO] ML code generation response received. Cleaning the code..."
                            );

                            conversationHistoryParsed.push({
                                role: "assistant",
                                content: assistant_message,
                            });

                            const cleanedCode = cleanCode(assistant_message);

                            if (!cleanedCode) {
                                console.error(`[ERROR] Cleaned code is empty.`);
                                return callback(
                                    null,
                                    `[ERROR] Generated code is invalid or empty.`
                                );
                            }

                            console.log(
                                `[INFO] Code cleaned successfully. Saving to file...`
                            );
                            // Save the generated Python code to a file
                            // fs.writeFileSync(filename, cleanedCode);
                            fs.writeFileSync(
                                path.join(outputDir, filename),
                                cleanedCode
                            );

                            console.log(
                                `[INFO] Generated ML code saved as ${filename}`
                            );

                            // Save the file path to the database
                            // const fullPath = path.resolve(filename);
                            const fullPath = path.resolve(
                                path.join(outputDir, filename)
                            );

                            console.log(
                                `[INFO] Full path to saved file: ${fullPath}`
                            );

                            const conversationHistoryString = JSON.stringify(
                                conversationHistoryParsed
                            );

                            saveFilePathToDb(
                                USERID,
                                fullPath,
                                cleanedCode,
                                parentId,
                                conversationHistoryString
                            );

                            if (cleanedCode) {
                                console.log(
                                    `[INFO] Returning API response to the client.`
                                );

                                return res.json({
                                    success: true,
                                    message: "Code regenerated successfully.",
                                    data: {
                                        disease,
                                        parentId,
                                        USERID,
                                        code: cleanedCode, // Newly generated code
                                        filePath: fullPath, // Saved file path (if relevant to frontend)
                                        conversationHistory:
                                            conversationHistoryString, // Updated conversation history (if relevant to frontend)
                                    },
                                });
                            } else {
                                console.error(
                                    `[ERROR] No valid message in API response.`
                                );
                                return res.status(500).json({
                                    message: "No valid response from API.",
                                });
                            }
                        }
                    })
                    .catch((apiError) => {
                        console.error(
                            `[ERROR] LLm provider API request failed: ${apiError.message}`
                        );
                        return res.status(500).json({
                            message: "Error calling LLm provider  API.",
                            error: apiError.message,
                        });
                    });
            });
        } else {
            console.warn(
                `[WARN] No conversation history found for the provided parentId and userid.`
            );
            return res.status(404).json({
                message:
                    "No conversation history found for the provided parentId and userid",
            });
        }
    });
});

const GENERATED_CODE_DIR = path.join(__dirname, "generated_code");
if (!fs.existsSync(GENERATED_CODE_DIR)) {
    fs.mkdirSync(GENERATED_CODE_DIR);
    console.log(`Directory '${GENERATED_CODE_DIR}' created.`);
}

app.post("/api/create-llm-details", (req, res) => {
    console.log("Received request for /api/create-llm-details");

    try {
        const { USERID, FIRMID, LLM_PROVIDER, API_KEY } = req.body;
        console.log("Request body:", req.body);

        // Check for missing fields
        if (!USERID || !FIRMID || !LLM_PROVIDER || !API_KEY) {
            console.log("Validation failed: Missing fields in request body.");
            return res.status(400).send({
                message:
                    "All fields (USERID, FIRMID, LLM_PROVIDER, API_KEY) are required.",
            });
        }

        console.log("All required fields are present.");

        // Validate LLM_PROVIDER
        if (!["GROQ", "OPENROUTER"].includes(LLM_PROVIDER)) {
            console.log(
                `Validation failed: Invalid LLM_PROVIDER: ${LLM_PROVIDER}`
            );
            return res.status(400).send({
                message:
                    "Invalid LLM_PROVIDER. Supported providers are GROQ and OPENROUTER.",
            });
        }

        console.log("LLM_PROVIDER is valid:", LLM_PROVIDER);

        const query = `
        INSERT INTO API_KEY_MANAGER (USERID, FIRMID, LLM_PROVIDER, API_KEY, STATUS)
        VALUES (?,?,?,?, 'ACTIVE')
      `;
        console.log("SQL query prepared:", query);
        console.log("Query parameters:", [
            USERID,
            FIRMID,
            LLM_PROVIDER,
            API_KEY,
        ]);

        // Execute the database query
        connection_trn.query(
            query,
            [USERID, FIRMID, LLM_PROVIDER, API_KEY],
            (error, results, fields) => {
                if (error) {
                    console.error("Database query error:", error);
                    return res.status(500).send({
                        message:
                            "Failed to create LLM Details. Please check server logs for more information.",
                    });
                }

                console.log("Database query executed successfully.");
                console.log("Query results:", results);

                res.send({
                    message: `LLM Details created successfully. ID: ${results.insertId}`,
                });
            }
        );
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).send({
            message:
                "An unexpected error occurred. Please check server logs for more information.",
        });
    }

    console.log("Finished processing /api/create-llm-details request.");
});

function processDiseaseAiMaster(
    diseaseName,
    llmName,
    userid,
    firmid,
    ipAddress,
    sindex,
    callback
) {
    try {
        // Check if disease exists in ai_master table
        connection_trn.query(
            "SELECT * FROM ai_master WHERE PARENT_ID IS NOT NULL AND AI_PROGRAM = ?",
            [diseaseName],
            (err, existingDisease) => {
                if (err) {
                    console.error("Error checking disease existence:", err);
                    if (typeof callback === "function" && !callback.called) {
                        callback.called = true;
                        callback(err, null);
                    }
                    return;
                }

                if (existingDisease.length === 0) {
                    connection_trn.query(
                        "SELECT IFNULL(MAX(PARENT_ID), 0) AS max_parent_id FROM ai_master",
                        (err, maxParentIdResult) => {
                            if (err) {
                                console.error(
                                    "Error retrieving max PARENT_ID:",
                                    err
                                );
                                if (
                                    typeof callback === "function" &&
                                    !callback.called
                                ) {
                                    callback.called = true;
                                    callback(err, null);
                                }
                                return;
                            }

                            const newParentId =
                                maxParentIdResult[0].max_parent_id + 1;

                            getLlmConfig(
                                llmName,
                                userid,
                                firmid,
                                (err, llmConfig) => {
                                    if (err) {
                                        console.error(
                                            "Error fetching LLM configuration:",
                                            err
                                        );
                                        if (
                                            typeof callback === "function" &&
                                            !callback.called
                                        ) {
                                            callback.called = true;
                                            callback(err, null);
                                        }
                                        return;
                                    }

                                    // const conversationHistory = [
                                    //     { role: 'system', content: 'You are a helpful assistant' },
                                    //     { role: 'user', content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context.` },
                                    // ];

                                    // const conversationHistory = [
                                    //     { role: 'system', content: 'You are a helpful assistant' },
                                    //     { role: 'user', content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context.also add age,gender,height,weight & pincode to the list` },
                                    // ];

                                    console.log("sindex", sindex);

                                    const conversationHistory =
                                        sindex === "PIndex"
                                            ? [
                                                {
                                                    role: "system",
                                                    content:
                                                        "You are a helpful assistant",
                                                },
                                                {
                                                    role: "user",
                                                    content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context. Also add age, gender, height, weight & pincode to the list.`,
                                                },
                                            ]
                                            : [
                                                {
                                                    role: "system",
                                                    content:
                                                        "You are a helpful assistant",
                                                },
                                                {
                                                    role: "user",
                                                    content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context.`,
                                                },
                                            ];

                                    console.log(
                                        "conversationHistory",
                                        conversationHistory
                                    );

                                    const inputData =
                                        llmConfig.inputData(
                                            conversationHistory
                                        );

                                    axios
                                        .post(llmConfig.apiUrl, inputData, {
                                            headers: llmConfig.headers,
                                        })
                                        .then((response) => {
                                            const parameters =
                                                llmConfig.responseExtractor(
                                                    response
                                                );
                                            if (parameters) {
                                                insertTaskLog(
                                                    diseaseName,
                                                    llmName,
                                                    userid,
                                                    firmid,
                                                    ipAddress,
                                                    "PARAMETERGEN",
                                                    (err, logId) => {
                                                        if (err) {
                                                            console.error(
                                                                "[ERROR] Failed to log AI task:",
                                                                err
                                                            );
                                                        } else {
                                                            console.log(
                                                                `[INFO] Task log inserted with ID: ${logId}`
                                                            );
                                                        }
                                                    }
                                                );

                                                const cleanedParameters =
                                                    parameters
                                                        .replace(
                                                            /^\d+\.\s*/gm,
                                                            ""
                                                        )
                                                        .split("\n")
                                                        .map((param) =>
                                                            param.trim()
                                                        )
                                                        .filter(Boolean);

                                                let procedureTypeCounter = 0;
                                                cleanedParameters.forEach(
                                                    (parameter, index) => {
                                                        connection_trn.query(
                                                            "INSERT INTO procedure_type (parent, name, description) VALUES (?, ?, ?)",
                                                            [
                                                                newParentId,
                                                                parameter,
                                                                diseaseName,
                                                            ],
                                                            (err) => {
                                                                if (err) {
                                                                    console.error(
                                                                        "Error inserting into procedure_type:",
                                                                        err
                                                                    );
                                                                    if (
                                                                        typeof callback ===
                                                                        "function" &&
                                                                        !callback.called
                                                                    ) {
                                                                        callback.called = true;
                                                                        callback(
                                                                            err,
                                                                            null
                                                                        );
                                                                    }
                                                                    return;
                                                                }

                                                                procedureTypeCounter++;

                                                                if (
                                                                    procedureTypeCounter ===
                                                                    cleanedParameters.length
                                                                ) {
                                                                    connection_trn.query(
                                                                        "INSERT INTO ai_master (PARENT_ID, AI_PROGRAM) VALUES (?, ?)",
                                                                        [
                                                                            newParentId,
                                                                            diseaseName,
                                                                        ],
                                                                        (
                                                                            err
                                                                        ) => {
                                                                            if (
                                                                                err
                                                                            ) {
                                                                                console.error(
                                                                                    "Error inserting into ai_master:",
                                                                                    err
                                                                                );
                                                                                if (
                                                                                    typeof callback ===
                                                                                    "function" &&
                                                                                    !callback.called
                                                                                ) {
                                                                                    callback.called = true;
                                                                                    callback(
                                                                                        err,
                                                                                        null
                                                                                    );
                                                                                }
                                                                                return;
                                                                            }

                                                                            if (
                                                                                typeof callback ===
                                                                                "function" &&
                                                                                !callback.called
                                                                            ) {
                                                                                callback.called = true;
                                                                                callback(
                                                                                    null,
                                                                                    {
                                                                                        message:
                                                                                            "Disease processed successfully",
                                                                                    }
                                                                                );
                                                                            }
                                                                        }
                                                                    );
                                                                }
                                                            }
                                                        );
                                                    }
                                                );
                                            } else {
                                                console.error(
                                                    "[ERROR] No valid message in response from LLM."
                                                );
                                                if (
                                                    typeof callback ===
                                                    "function" &&
                                                    !callback.called
                                                ) {
                                                    callback.called = true;
                                                    callback(
                                                        null,
                                                        "[ERROR] No valid message in response from LLM."
                                                    );
                                                }
                                            }
                                        })
                                        .catch((err) => {
                                            console.error("Error:", err);
                                            if (
                                                typeof callback ===
                                                "function" &&
                                                !callback.called
                                            ) {
                                                callback.called = true;
                                                callback(err, null);
                                            }
                                        });
                                }
                            );
                        }
                    );
                } else {
                    console.log("Disease already exists in ai_master table");
                    if (typeof callback === "function" && !callback.called) {
                        callback.called = true;
                        callback(null, {
                            message:
                                "Disease already exists in ai_master table",
                        });
                    }
                    return;
                }
            }
        );
    } catch (err) {
        console.error("Unexpected error:", err);
        if (typeof callback === "function" && !callback.called) {
            callback.called = true;
            callback(err, null);
        }
    }
}

app.get("/api/get-llm-details-imagegen", async (req, res) => {
    const { userid, firmid } = req.query;

    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ error: "USERID and FIRMID are required." });
    }

    try {
        connection_trn.query(
            `SELECT * FROM API_KEY_MANAGER 
         WHERE USERID = ? 
         AND FIRMID = ? 
         AND LLM_PROVIDER = 'HUGGINGFACE-TEXTTOIMAGE'`,
            [userid, firmid],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res
                        .status(500)
                        .json({ error: "Database query failed." });
                }
                res.json(results);
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

app.post("/api/toggle-status-imagegen", async (req, res) => {
    const { id, userid, firmid } = req.body;

    if (!id || !userid || !firmid) {
        return res
            .status(400)
            .json({ error: "ID, USERID, and FIRMID are required." });
    }

    try {
        // Deactivate all other providers for the user and firm
        connection_trn.query(
            `UPDATE API_KEY_MANAGER 
             SET STATUS = 'INACTIVE' 
             WHERE USERID = ? 
             AND FIRMID = ? 
             AND LLM_PROVIDER = 'HUGGINGFACE-TEXTTOIMAGE'`,
            [userid, firmid]
        );

        // Activate the selected provider
        connection_trn.query(
            `UPDATE API_KEY_MANAGER 
             SET STATUS = 'ACTIVE' 
             WHERE ID = ? 
             AND USERID = ? 
             AND FIRMID = ? 
             AND LLM_PROVIDER = 'HUGGINGFACE-TEXTTOIMAGE'`,
            [id, userid, firmid]
        );

        res.json({ success: true, newStatus: "ACTIVE" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

app.post("/api/add-llm", async (req, res) => {
    const { userid, firmid, apiKey, llmProvider } = req.body;

    if (!userid || !firmid || !apiKey) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await connection_trn.query(
            "UPDATE API_KEY_MANAGER SET STATUS = 'INACTIVE' WHERE USERID = ? AND FIRMID = ?",
            [userid, firmid]
        );

        await connection_trn.query(
            "INSERT INTO API_KEY_MANAGER (USERID, FIRMID, LLM_PROVIDER, API_KEY, STATUS) VALUES (?, ?, ?, ?, 'ACTIVE')",
            [userid, firmid, llmProvider, apiKey]
        );

        res.status(200).json({
            success: true,
            message: "LLM details updated and inserted successfully",
        });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/get-llm-details", async (req, res) => {
    const { userid, firmid } = req.query;

    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ error: "USERID and FIRMID are required." });
    }

    try {
        connection_trn.query(
            `SELECT * FROM API_KEY_MANAGER WHERE USERID = ? AND FIRMID = ?`,
            [userid, firmid],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res
                        .status(500)
                        .json({ error: "Database query failed." });
                }
                res.json(results);
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

app.post("/api/toggle-status", async (req, res) => {
    const { id, userid, firmid } = req.body;

    if (!id || !userid || !firmid) {
        return res
            .status(400)
            .json({ error: "ID, USERID, and FIRMID are required." });
    }

    try {
        // Get the current status of the selected LLM provider
        connection_trn.query(
            `SELECT STATUS FROM API_KEY_MANAGER WHERE ID = ? AND USERID = ? AND FIRMID = ?`,
            [id, userid, firmid],
            (err, results) => {
                if (err || results.length === 0) {
                    console.error(err);
                    return res
                        .status(500)
                        .json({ error: "Failed to fetch status." });
                }

                const currentStatus = results[0].STATUS;
                const newStatus =
                    currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

                // If activating a new provider, deactivate all others first
                if (newStatus === "ACTIVE") {
                    connection_trn.query(
                        `UPDATE API_KEY_MANAGER SET STATUS = 'INACTIVE' WHERE USERID = ? AND FIRMID = ?`,
                        [userid, firmid],
                        (err) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).json({
                                    error: "Failed to deactivate existing active providers.",
                                });
                            }

                            // Activate the selected provider
                            connection_trn.query(
                                `UPDATE API_KEY_MANAGER SET STATUS = ? WHERE ID = ?`,
                                [newStatus, id],
                                (err) => {
                                    if (err) {
                                        console.error(err);
                                        return res.status(500).json({
                                            error: "Failed to update status.",
                                        });
                                    }
                                    res.json({ success: true, newStatus });
                                }
                            );
                        }
                    );
                } else {
                    // Directly update status if deactivating
                    connection_trn.query(
                        `UPDATE API_KEY_MANAGER SET STATUS = ? WHERE ID = ?`,
                        [newStatus, id],
                        (err) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).json({
                                    error: "Failed to update status.",
                                });
                            }
                            res.json({ success: true, newStatus });
                        }
                    );
                }
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

app.post("/add-api-key", (req, res) => {
    const { USERID, FIRMID, LLM_PROVIDER, API_KEY } = req.body;

    console.log(
        `Received request to add/update API Key for USERID: ${USERID}, FIRMID: ${FIRMID}, LLM_PROVIDER: ${LLM_PROVIDER}`
    );

    if (!USERID || !FIRMID || !LLM_PROVIDER || !API_KEY) {
        console.log("Validation failed: Missing fields in request body.");
        return res.status(400).json({
            success: false,
            message:
                "All fields (USERID, FIRMID, LLM_PROVIDER, API_KEY) are required.",
        });
    }

    // Set previous API keys as inactive for this USERID & FIRMID
    const updateStatusQuery = `
          UPDATE API_KEY_MANAGER SET STATUS = 'INACTIVE' WHERE FIRMID = ? AND USERID = ?
      `;

    connection_trn.query(
        updateStatusQuery,
        [FIRMID, USERID],
        (err, updateResult) => {
            if (err) {
                console.error("Error updating existing API Key status:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    details: err.message,
                });
            }

            console.log(
                `Set previous API keys as INACTIVE for USERID: ${USERID} and FIRMID: ${FIRMID}`
            );

            // Insert or update the API key
            const upsertQuery = `
              INSERT INTO API_KEY_MANAGER (USERID, FIRMID, LLM_PROVIDER, API_KEY, STATUS) 
              VALUES (?, ?, ?, ?, 'ACTIVE') 
              
          `;

            connection_trn.query(
                upsertQuery,
                [USERID, FIRMID, LLM_PROVIDER, API_KEY],
                (err, result) => {
                    if (err) {
                        console.error("Error updating/inserting API Key:", err);
                        return res.status(500).json({
                            success: false,
                            message: "Database error",
                            details: err.message,
                        });
                    }

                    console.log(
                        `API Key updated successfully for USERID: ${USERID} and LLM_PROVIDER: ${LLM_PROVIDER}`
                    );
                    res.status(201).json({
                        success: true,
                        message: "API Key updated successfully",
                    });
                }
            );
        }
    );
});

const IMAGE_API_URL = "http://61.2.142.91:8500/generate-image"; // Original API URL

const IMAGE_API_HOST = "61.2.142.91";
const IMAGE_API_PORT = 8500;

function checkServer(host, port, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.setTimeout(timeout);
        socket.on("connect", () => {
            socket.destroy();
            resolve(true);
        });

        socket.on("error", (err) => {
            socket.destroy();
            reject(err);
        });

        socket.on("timeout", () => {
            socket.destroy();
            reject(new Error("Connection timeout"));
        });

        socket.connect(port, host);
    });
}

app.post("/proxy-generate-image", async (req, res) => {
    const { process_id, userid, firmid, portalid, prompt, email } = req.body;

    const transporter = nodemailer.createTransport({
        host: "mail.myblocks.in",
        port: 465,
        secure: true,
        auth: {
            user: "listings@myblocks.in",
            pass: "Matix@1972123",
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
    }

    try {
        await checkServer(IMAGE_API_HOST, IMAGE_API_PORT);
        console.log("✅ Server is reachable!");
    } catch (error) {
        console.error("❌ Server is unreachable:", error.message);
        return res.status(503).json({
            error: "Server is down, please contact the administrator.",
        });
    }

    // Generate a unique job ID
    const jobId = uuidv4();
    const relativeImagePath = `../images/MyB_App/${portalid}/${userid}/imagegen/${jobId}.png`;
    const insertQuery = `INSERT INTO IMAGE_GEN_DETAILS (PATH, USERID, FIRMID, PROCESS_ID, STATUS) VALUES (?, ?, ?, ?, 'PENDING')`;

    connection_trn.query(
        insertQuery,
        [relativeImagePath, userid, firmid, process_id],
        (err) => {
            if (err) {
                console.error("Database insert error:", err);
                return res
                    .status(500)
                    .json({ error: "Failed to insert record" });
            }
            console.log("Database record inserted with PENDING status");
        }
    );

    res.json({ message: "Image generation started", jobId });

    axios
        .post(
            IMAGE_API_URL,
            { process_id, userid, firmid, portalid, prompt },
            { responseType: "arraybuffer" }
        )
        .then((response) => {
            if (!response.data || response.data.length < 100) {
                console.error("Error: Received invalid image data");
                return;
            }

            const basePath =
                process.platform === "win32"
                    ? path.join(
                        "D:",
                        "myblocks",
                        "react trainee",
                        "Techieindex-New",
                        "public",
                        "images",
                        "MyB_App"
                    )
                    : "/var/www/rafalin/mongo_react/images/MyB_App";

            const imageDir = path.join(
                basePath,
                portalid.toString(),
                userid.toString(),
                "imagegen"
            );
            const imagePath = path.join(imageDir, `${jobId}.png`);

            if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir, { recursive: true });
                console.log(`Created directory: ${imageDir}`);
            }

            fs.writeFileSync(imagePath, response.data);
            console.log(`Saved received image as ${imagePath}`);

            // Update record status to COMPLETED
            const updateQuery = `UPDATE IMAGE_GEN_DETAILS SET STATUS='COMPLETED' WHERE PATH=?`;
            connection_trn.query(updateQuery, [relativeImagePath], (err) => {
                if (err) {
                    console.error("Database update error:", err);
                } else {
                    console.log("Database record updated to COMPLETED");

                    // Send email only if email is provided
                    if (email) {
                        const imageUrl = `https://www.myblocks.in/images/MyB_App/${portalid}/${userid}/imagegen/${jobId}.png`;
                        const mailOptions = {
                            from: "listings@myblocks.in",
                            to: email,
                            subject: "Image Generation Successful",
                            html: `<p>Your image has been successfully generated:</p>
                                 <img src="${imageUrl}" alt="Generated Image" style="max-width: 100%; height: auto; border-radius: 8px;" />`,
                        };

                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                console.error("Error sending email:", error);
                            } else {
                                console.log(
                                    "Success email sent:",
                                    info.response
                                );
                            }
                        });
                    }
                }
            });
        })
        .catch((error) => {
            console.error("Error fetching image:", error);

            const updateQuery = `UPDATE IMAGE_GEN_DETAILS SET STATUS='FAILED' WHERE PATH=?`;
            connection_trn.query(updateQuery, [relativeImagePath], (err) => {
                if (err) {
                    console.error("Database update error:", err);
                } else {
                    console.log("Database record updated to FAILED");

                    // Send failure email only if email is provided
                    if (email) {
                        const mailOptions = {
                            from: "listings@myblocks.in",
                            to: email,
                            subject: "Image Generation Failed",
                            text: "Image generation has failed. Please try again later.",
                        };

                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                console.error("Error sending email:", error);
                            } else {
                                console.log(
                                    "Failure email sent:",
                                    info.response
                                );
                            }
                        });
                    }
                }
            });
        });
});

app.get("/fetch-last-generated-image", (req, res) => {
    const { userid, firmid, process_id } = req.query;

    if (!userid || !firmid) {
        return res.status(400).json({ error: "Missing required parameters." });
    }

    const query = `SELECT PATH FROM IMAGE_GEN_DETAILS 
                 WHERE USERID = ? AND FIRMID = ? AND STATUS = 'COMPLETED' 
                 ORDER BY INSRT_DTM DESC LIMIT 1`;

    connection_trn.query(query, [userid, firmid], (error, results) => {
        if (error) {
            console.error("Database error:", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No image found." });
        }

        // Extract the relative path from the database
        let imagePath = results[0].PATH;

        res.json({ path: imagePath });
    });
});

app.get("/fetch-logs", (req, res) => {
    const { process_id, userid, firmid } = req.query;

    if (!process_id || !userid || !firmid) {
        return res.status(400).json({ error: "Missing required parameters" });
    }

    const query = `
      SELECT LOGS 
      FROM IMAGE_GEN_LOGS 
      WHERE PROCESS_ID = ? AND USERID = ? AND FIRMID = ? 
      ORDER BY INSRT_DTM ASC
  `;

    connection_trn.query(
        query,
        [process_id, userid, firmid],
        (error, results) => {
            if (error) {
                console.error("Error fetching logs:", error);
                return res.status(500).json({ error: "Internal server error" });
            }

            const logs = results.map((row) => row.LOGS);
            res.json({ logs });
        }
    );
});

app.get("/fetch-status", (req, res) => {
    const { process_id, userid, firmid } = req.query;

    if (!process_id || !userid || !firmid) {
        return res.status(400).json({ error: "Missing required parameters" });
    }

    const query = `
      SELECT STATUS, PATH 
      FROM IMAGE_GEN_DETAILS 
      WHERE PROCESS_ID = ? AND USERID = ? AND FIRMID = ? 
      LIMIT 1
  `;

    connection_trn.query(
        query,
        [process_id, userid, firmid],
        (error, results) => {
            if (error) {
                console.error("Error fetching status:", error);
                return res.status(500).json({ error: "Internal server error" });
            }

            if (results.length === 0) {
                return res.json({ status: "pending" });
            }

            const { STATUS, PATH } = results[0];
            res.json({ status: STATUS, path: PATH });
        }
    );
});

// Fetch all diseases
app.get("/api/diseases", (req, res) => {
    connection_trn.query(
        "SELECT AI_PROGRAM, PARENT_ID FROM ai_master",
        (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            res.json(results);
        }
    );
});

// Fetch parameters for a given disease
app.get("/api/parameters/:parentId", (req, res) => {
    const { parentId } = req.params;
    connection_trn.query(
        `SELECT procedure_type_id, name FROM procedure_type WHERE parent = ? and STATUS='ACTIVE'`,
        [parentId],
        (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            res.json(results);
        }
    );
});

app.post("/api/parameters", (req, res) => {
    const { action, procedure_type_id, name, parent } = req.body;

    if (action === "add") {
        // Check if the parameter already exists in an INACTIVE state
        connection_trn.query(
            'SELECT procedure_type_id FROM procedure_type WHERE name = ? AND STATUS = "INACTIVE"',
            [name],
            (error, results) => {
                if (error) {
                    return res.status(500).json({ error: error.message });
                }

                if (results.length > 0) {
                    // If exists in INACTIVE state, update it to ACTIVE
                    const existingId = results[0].procedure_type_id;
                    connection_trn.query(
                        'UPDATE procedure_type SET STATUS = "ACTIVE" WHERE procedure_type_id = ?',
                        [existingId],
                        (error) => {
                            if (error) {
                                return res
                                    .status(500)
                                    .json({ error: error.message });
                            }
                            res.json({
                                message: "Existing parameter reactivated",
                                id: existingId,
                            });
                        }
                    );
                } else {
                    // If it doesn't exist, insert as a new parameter
                    connection_trn.query(
                        'INSERT INTO procedure_type (name, parent, STATUS) VALUES (?, ?, "ACTIVE")',
                        [name, parent],
                        (error, results) => {
                            if (error) {
                                return res
                                    .status(500)
                                    .json({ error: error.message });
                            }
                            res.json({
                                message: "Parameter added",
                                id: results.insertId,
                            });
                        }
                    );
                }
            }
        );
    } else if (action === "edit") {
        connection_trn.query(
            "UPDATE procedure_type SET name = ? WHERE procedure_type_id = ?",
            [name, procedure_type_id],
            (error) => {
                if (error) {
                    return res.status(500).json({ error: error.message });
                }
                res.json({ message: "Parameter updated" });
            }
        );
    } else if (action === "delete") {
        connection_trn.query(
            'UPDATE procedure_type SET STATUS = "INACTIVE" WHERE procedure_type_id = ?',
            [procedure_type_id],
            (error) => {
                if (error) {
                    return res.status(500).json({ error: error.message });
                }
                res.json({ message: "Parameter marked as INACTIVE" });
            }
        );
    } else {
        res.status(400).json({ error: "Invalid action" });
    }
});

app.post("/api/add-disease", (req, res) => {
    const { diseaseName, llmName, userid, firmid, sindex } = req.body;

    if (!diseaseName || !llmName || !userid || !firmid) {
        return res.status(400).json({
            error: "diseaseName, llmName, userid, and firmid are required",
        });
    }

    const ipAddress =
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    processDiseaseAiMaster_paramter_editor(
        diseaseName,
        llmName,
        userid,
        firmid,
        ipAddress,
        sindex,
        (err, result) => {
            if (err) {
                console.error("Error processing disease:", err);
                return res
                    .status(500)
                    .json({ error: "Failed to process disease" });
            }

            res.json({
                success: true,
                disease: diseaseName,
                parentId: result.parentId || null, // Ensure parentId is returned
            });
        }
    );
});

function processDiseaseAiMaster_paramter_editor(
    diseaseName,
    llmName,
    userid,
    firmid,
    ipAddress,
    sindex,
    callback
) {
    try {
        connection_trn.query(
            "SELECT * FROM ai_master WHERE PARENT_ID IS NOT NULL AND AI_PROGRAM = ?",
            [diseaseName],
            (err, existingDisease) => {
                if (err) return callback(err, null);

                if (existingDisease.length === 0) {
                    connection_trn.query(
                        "SELECT IFNULL(MAX(PARENT_ID), 0) AS max_parent_id FROM ai_master",
                        (err, maxParentIdResult) => {
                            if (err) return callback(err, null);

                            const newParentId =
                                maxParentIdResult[0].max_parent_id + 1;

                            getLlmConfig(
                                llmName,
                                userid,
                                firmid,
                                (err, llmConfig) => {
                                    if (err) return callback(err, null);

                                    // const conversationHistory = [
                                    //     { role: 'system', content: 'You are a helpful assistant' },
                                    //     { role: 'user', content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context. Also add age, gender, height, weight & pincode to the list.` },
                                    // ];

                                    const conversationHistory =
                                        sindex === "PIndex"
                                            ? [
                                                {
                                                    role: "system",
                                                    content:
                                                        "You are a helpful assistant",
                                                },
                                                {
                                                    role: "user",
                                                    content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context. Also add age, gender, height, weight & pincode to the list.`,
                                                },
                                            ]
                                            : [
                                                {
                                                    role: "system",
                                                    content:
                                                        "You are a helpful assistant",
                                                },
                                                {
                                                    role: "user",
                                                    content: `Generate a list of parameter names for: ${diseaseName}. Only provide the parameter names as a numbered list, without any introductory text, explanations, or additional context.`,
                                                },
                                            ];

                                    const inputData =
                                        llmConfig.inputData(
                                            conversationHistory
                                        );

                                    axios
                                        .post(llmConfig.apiUrl, inputData, {
                                            headers: llmConfig.headers,
                                        })
                                        .then((response) => {
                                            const parameters =
                                                llmConfig.responseExtractor(
                                                    response
                                                );
                                            if (parameters) {
                                                insertTaskLog(
                                                    diseaseName,
                                                    llmName,
                                                    userid,
                                                    firmid,
                                                    ipAddress,
                                                    "PARAMETERGEN",
                                                    (err, logId) => {
                                                        if (err)
                                                            console.error(
                                                                "[ERROR] Failed to log AI task:",
                                                                err
                                                            );
                                                    }
                                                );

                                                const cleanedParameters =
                                                    parameters
                                                        .replace(
                                                            /^\d+\.\s*/gm,
                                                            ""
                                                        )
                                                        .split("\n")
                                                        .map((param) =>
                                                            param.trim()
                                                        )
                                                        .filter(Boolean);

                                                let procedureTypeCounter = 0;
                                                cleanedParameters.forEach(
                                                    (parameter) => {
                                                        connection_trn.query(
                                                            "INSERT INTO procedure_type (parent, name, description) VALUES (?, ?, ?)",
                                                            [
                                                                newParentId,
                                                                parameter,
                                                                diseaseName,
                                                            ],
                                                            (err) => {
                                                                if (err)
                                                                    return callback(
                                                                        err,
                                                                        null
                                                                    );

                                                                procedureTypeCounter++;

                                                                if (
                                                                    procedureTypeCounter ===
                                                                    cleanedParameters.length
                                                                ) {
                                                                    connection_trn.query(
                                                                        "INSERT INTO ai_master (PARENT_ID, AI_PROGRAM) VALUES (?, ?)",
                                                                        [
                                                                            newParentId,
                                                                            diseaseName,
                                                                        ],
                                                                        (
                                                                            err
                                                                        ) => {
                                                                            if (
                                                                                err
                                                                            )
                                                                                return callback(
                                                                                    err,
                                                                                    null
                                                                                );

                                                                            callback(
                                                                                null,
                                                                                {
                                                                                    message:
                                                                                        "Disease processed successfully",
                                                                                    parentId:
                                                                                        newParentId, // Ensure parentId is returned
                                                                                }
                                                                            );
                                                                        }
                                                                    );
                                                                }
                                                            }
                                                        );
                                                    }
                                                );
                                            } else {
                                                callback(null, {
                                                    error: "No valid response from LLM",
                                                });
                                            }
                                        })
                                        .catch((err) => callback(err, null));
                                }
                            );
                        }
                    );
                } else {
                    callback(null, {
                        message: "Disease already exists in ai_master table",
                        parentId: existingDisease[0].PARENT_ID, // Return existing parentId
                    });
                }
            }
        );
    } catch (err) {
        callback(err, null);
    }
}

app.post("/api/delete-parameter", (req, res) => {
    const { procedure_type_id } = req.body;

    if (!procedure_type_id) {
        return res
            .status(400)
            .json({ success: false, message: "Missing procedure_type_id" });
    }

    const sql = `UPDATE procedure_type SET STATUS = 'INACTIVE' WHERE procedure_type_id = ?`;

    connection_trn.query(sql, [procedure_type_id], (err, result) => {
        if (err) {
            console.error("Error updating status:", err);
            return res
                .status(500)
                .json({ success: false, message: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ success: false, message: "Parameter not found" });
        }

        res.json({ success: true, message: "Parameter marked as INACTIVE" });
    });
});

// const uploadProgress = {};

// const storage_smpl = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadDir = 'uploads/';
//         if (!fs.existsSync(uploadDir)) {
//             console.log('Upload directory not found. Creating...');
//             fs.mkdirSync(uploadDir);
//         }
//         cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//         const id = req.body.uploadId || req.query.uploadId;
//         const filename = Date.now() + '-' + file.originalname;
//         console.log(`[${id}] Saving file: ${filename}`);
//         cb(null, filename);
//     }
// });

// const upload_smpl = multer({ storage: storage_smpl });

// app.post('/upload-multiple', upload_smpl.array('images', 90), (req, res) => {
//     const id = req.body.uploadId || req.query.uploadId;

//     if (!id) {
//         console.warn('Missing uploadId');
//         return res.status(400).json({ message: 'uploadId is required' });
//     }

//     if (!uploadProgress[id]) {
//         uploadProgress[id] = { uploaded: 0, total: 0 };
//     }

//     const uploadedNow = req.files.length;
//     uploadProgress[id].uploaded += uploadedNow;

//     const insertQuery = `
//       INSERT INTO IMAGE_DETAILS (IMAGE_URL, IMAGE_SOURCE)
//       VALUES (?, 'MY IMAGES')
//     `;

//     for (const file of req.files) {
//         // Generate full path (example: http://yourdomain.com/uploads/filename.jpg)
//         const rawFullPath = path.resolve(__dirname, 'uploads', file.filename);
//         const fullPath = rawFullPath.replace(/\\/g, '/'); // Replace backslashes with forward slashes

//         connection_trn.query(insertQuery, [fullPath], (err) => {
//             if (err) console.error('DB Insert Error:', err);
//         });
//     }

//     console.log(`[${id}] Uploaded ${uploadedNow} files. Total uploaded: ${uploadProgress[id].uploaded}`);
//     res.status(200).json({ message: 'Uploaded successfully', uploadedNow });
// });

const uploadProgress = {};

const uploadFiles = upload_smpl.array("images", 90);
const uploadFilesMiddleware = util.promisify(uploadFiles);

app.post("/upload-multiple", async (req, res) => {
    try {
        await uploadFilesMiddleware(req, res); // ✅ Properly await Multer

        const { firmid, userid } = req.body;

        const id = req.body.uploadId || req.query.uploadId;
        if (!id)
            return res.status(400).json({ message: "uploadId is required" });

        if (!uploadProgress[id]) {
            uploadProgress[id] = { uploaded: 0, total: 0 };
        }

        const uploadedNow = req.files.length;
        uploadProgress[id].uploaded += uploadedNow;

        const values = req.files.map((file) => {
            const cleanPath = file.path.replace(/\\/g, "/");
            return [cleanPath, "MY IMAGES", firmid, userid];
        });

        console.log(
            "Files received:",
            req.files.map((f) => f.originalname)
        );
        console.log("Prepared DB values:", values);

        if (values.length === 0) {
            return res
                .status(400)
                .json({ message: "No valid files received for DB insert." });
        }

        await connection_trn_117_pool_retry_wrapper.query(
            `INSERT INTO IMAGE_DETAILS (IMAGE_URL, IMAGE_SOURCE, VENDOR_ID, USERID) VALUES ?`,
            [values]
        );

        console.log(
            `[${id}] Uploaded ${uploadedNow} files. Total uploaded: ${uploadProgress[id].uploaded}`
        );
        res.status(200).json({ message: "Uploaded successfully", uploadedNow });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed", details: err.message });
    }
});

// Initialize the upload
app.post("/init-upload", (req, res) => {
    const { uploadId, total } = req.body;
    console.log(`Init upload: ${uploadId}, total: ${total}`);
    uploadProgress[uploadId] = { uploaded: 0, total };
    res.status(200).json({ message: "Initialized upload" });
});

// Progress tracking
app.get("/progress/:uploadId", (req, res) => {
    const id = req.params.uploadId;
    const progress = uploadProgress[id] || { uploaded: 0, total: 0 };
    console.log(`[${id}] Progress:`, progress);
    res.json(progress);
});

// app.get('/api/scheduler-planner', (req, res) => {
//     const { userid, firmid } = req.query;

//     if (!userid || !firmid) {
//         return res.status(400).json({ error: 'Missing userid or firmid' });
//     }

//     const today = new Date();
//     const dayOfWeek = today.getDay(); // Sunday = 0
//     console.log('🕒 Today (local):', today.toString(), '| Day of Week:', dayOfWeek);

//     // Get Sunday (start of this week)
//     const sunday = new Date(today);
//     sunday.setDate(today.getDate() - dayOfWeek);
//     sunday.setHours(0, 0, 0, 0);

//     // Get Saturday (end of this week)
//     const saturday = new Date(sunday);
//     saturday.setDate(sunday.getDate() + 6);
//     saturday.setHours(23, 59, 59, 999);

//     console.log('📅 Start of Week (Sunday, local):', sunday.toString());
//     console.log('📅 End of Week (Saturday, local):', saturday.toString());

//     const formatDate = (d) =>
//         `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

//     const startOfWeek = formatDate(sunday);
//     const endOfWeek = formatDate(saturday);

//     console.log('✅ Formatted Date Range (local):', startOfWeek, 'to', endOfWeek);

//     const query = `
//         SELECT * FROM SMP_SCHEDULER_PLANNER
//         WHERE POST_DATE BETWEEN ? AND ?
//         AND USERID = ? AND FIRMID = ?
//         ORDER BY POST_DATE, POST_TIME
//     `;

//     connection_trn.query(query, [startOfWeek, endOfWeek, userid, firmid], (err, results) => {
//         if (err) {
//             console.error('❌ Failed to fetch posts:', err);
//             return res.status(500).json({ error: 'Failed to fetch data' });
//         }

//         console.log(`✅ Retrieved ${results.length} rows`);
//         res.json({ table: 'SMP_SCHEDULER_PLANNER', rows: results });
//     });
// });

app.get("/api/scheduler-planner", (req, res) => {
    const { userid, firmid, offset = 0 } = req.query;

    if (!userid || !firmid) {
        return res.status(400).json({ error: "Missing userid or firmid" });
    }

    const today = new Date();
    const weekOffset = parseInt(offset, 10) || 0;

    const dayOfWeek = today.getDay(); // Sunday = 0
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    sunday.setHours(0, 0, 0, 0);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    const formatDate = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;

    const startOfWeek = formatDate(sunday);
    const endOfWeek = formatDate(saturday);

    console.log(`Offset: ${offset}`);
    console.log(`Week Range: ${startOfWeek} to ${endOfWeek}`);

    const query = `
        SELECT * FROM SMP_SCHEDULER_PLANNER
        WHERE POST_DATE BETWEEN ? AND ?
        AND USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
        ORDER BY POST_DATE, POST_TIME
    `;

    connection_trn.query(
        query,
        [startOfWeek, endOfWeek, userid, firmid],
        (err, results) => {
            if (err) {
                console.error("❌ Failed to fetch posts:", err);
                return res.status(500).json({ error: "Failed to fetch data" });
            }

            res.json({ table: "SMP_SCHEDULER_PLANNER", rows: results });
        }
    );
});

app.post("/api/scheduler-planner/approve", (req, res) => {
    const { plannerId, approved, caption, userid, firmid } = req.body;

    const query = `
    UPDATE SMP_SCHEDULER_PLANNER 
    SET APPROVED = ?, CAPTION = ?, UPDATE_DTM = CURRENT_TIMESTAMP 
    WHERE PLANNER_ID = ? AND USERID = ? AND FIRMID = ?
`;

    connection_trn.query(
        query,
        [approved, caption, plannerId, userid, firmid],
        (err, result) => {
            if (err) {
                console.error("Failed to update approval:", err);
                return res.status(500).json({ error: "Update failed" });
            }
            res.json({ success: true });
        }
    );
});

app.post("/api/scheduler-planner/social-toggle", (req, res) => {
    const { plannerId, platform, checked, userid, firmid } = req.body;

    const columnMap = {
        facebook: "POST_TO_FACEBOOK",
        instagram: "POST_TO_INSTAGRAM",
        twitter: "POST_TO_TWITTER",
    };

    const column = columnMap[platform];
    if (!column) return res.status(400).json({ error: "Invalid platform" });

    const query = `
    UPDATE SMP_SCHEDULER_PLANNER 
    SET ${column} = ?, UPDATE_DTM = CURRENT_TIMESTAMP 
    WHERE PLANNER_ID = ? AND USERID = ? AND FIRMID = ?
`;

    // connection_trn.query(query, [checked ? 'YES' : 'NO', plannerId], (err, result) => {
    connection_trn.query(
        query,
        [checked ? "YES" : "NO", plannerId, userid, firmid],
        (err, result) => {
            if (err) {
                console.error("Failed to update social toggle:", err);
                return res.status(500).json({ error: "Update failed" });
            }
            res.json({ success: true });
        }
    );
});

app.post("/api/scheduler-planner/bulk-approve", (req, res) => {
    const updates = req.body.updates;

    if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Invalid request payload" });
    }

    const updatePromises = updates.map(
        ({ plannerId, caption, approved, userid, firmid }) => {
            return new Promise((resolve, reject) => {
                console.log("updating", plannerId);
                const query = `
                UPDATE SMP_SCHEDULER_PLANNER
                SET APPROVED = ?, CAPTION = ?, UPDATE_DTM = CURRENT_TIMESTAMP
                WHERE PLANNER_ID = ?
            `;
                connection_trn.query(
                    query,
                    [approved, caption, plannerId],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        }
    );

    Promise.all(updatePromises)
        .then(() => res.json({ success: true }))
        .catch((err) => {
            console.error("Bulk update failed:", err);
            res.status(500).json({ error: "Bulk update failed" });
        });
});

const uploadDir_voice = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir_voice)) fs.mkdirSync(uploadDir_voice);

const storage_voice = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads"),
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `original-${timestamp}${ext}`);
    },
});
// const upload_voice = multer({ storage_voice });
const upload_voice = multer({ storage: storage_voice });

ffmpeg.setFfmpegPath(ffmpegPath);

function convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat("wav")
            .on("error", reject)
            .on("end", () => resolve(outputPath))
            .save(outputPath);
    });
}

app.post(
    "/react-native/voice/upload",
    upload_voice.single("audio"),
    async (req, res) => {
        console.log("📩 Incoming request...");
        console.log("Headers:", req.headers["content-type"]);
        console.log("Body keys:", Object.keys(req.body));

        console.log("💡 Debug req.file:", req.file);
        console.log("💡 Debug req.body:", req.body);

        if (!req.file) {
            return res.status(400).json({ error: "❌ No audio file uploaded" });
        }

        const originalPath = req.file.path;
        const timestamp = Date.now();
        const wavFilename = `audio-${timestamp}.wav`;
        const wavPath = path.join(uploadDir_voice, wavFilename);

        console.log(`📥 Received audio file: ${originalPath}`);

        try {
            await convertToWav(originalPath, wavPath);
            console.log(`✅ Converted to WAV: ${wavFilename}`);

            exec(
                `python3.7 '/home/rafalin/python_files/reactnative-voice/transcribe.py' "${wavPath}"`,
                (error, stdout, stderr) => {
                    fs.unlinkSync(originalPath); // clean original

                    if (error) {
                        console.error(
                            `❌ Transcription failed: ${error.message}`
                        );
                        return res
                            .status(500)
                            .json({ error: "❌ Transcription failed" });
                    }

                    if (stderr) {
                        console.warn(`⚠️ stderr: ${stderr}`);
                    }

                    console.log(`🗣️ Transcription result: ${stdout.trim()}`);
                    res.json({
                        transcription: stdout.trim(),
                        wav_file_saved: path.basename(wavPath),
                    });
                }
            );
        } catch (err) {
            // fs.unlinkSync(originalPath);
            if (originalPath && fs.existsSync(originalPath)) {
                fs.unlinkSync(originalPath); // ✅ Safe cleanup on error
            }
            console.error(`❌ Conversion error:`, err);
            return res
                .status(500)
                .json({ error: "❌ Audio conversion failed" });
        }
    }
);

function insertGeneratedQuestionsToDB(
    diseaseName,
    questions,
    sindex,
    callback
) {
    const insertQuery = `
        INSERT INTO Book_Questions (
            book_level, Question_Text, Q_CATEGORY, Q_SUBCATEGORY, Q_TOPIC,
            CAT_TYPE, Question_Type, STATUS
        ) VALUES ?
    `;

    const values = questions.map((q) => [
        1, // book_level
        q, // Question_Text
        sindex, // Q_CATEGORY
        "book_llm", // Q_SUBCATEGORY
        diseaseName, // Q_TOPIC
        "", // CAT_TYPE
        "", // Question_Type
        "ACTIVE", // STATUS
    ]);

    connection_trn.query(insertQuery, [values], (err, result) => {
        if (err) {
            console.error("[ERROR] Failed to insert questions into DB:", err);
            return callback(err);
        }
        console.log("[INFO] Questions inserted into DB successfully.");
        callback(null, result);
    });
}

function generateQuestions(
    diseaseName,
    params,
    sindex,
    llmName,
    userid,
    firmid,
    ipAddress,
    callback
) {
    console.log(
        `[INFO] Requesting LLM to generate questions for disease: ${diseaseName}`
    );
    console.log("[INFO] Parameters:", params);

    // Fetch LLM configuration
    getLlmConfig(llmName, userid, firmid, (err, llmConfig) => {
        if (err) {
            console.error("[ERROR] Failed to fetch LLM configuration:", err);
            return callback(err, null);
        }

        console.log("[DEBUG] Retrieved LLM configuration:", llmConfig);

        if (!llmConfig || !llmConfig.headers) {
            console.error("[ERROR] Invalid LLM configuration:", llmConfig);
            return callback(new Error("Invalid LLM configuration"), null);
        }
        // Create the conversation history for the LLM
        const conversationHistory = [
            { role: "system", content: "You are a helpful assistant." },
            {
                role: "user",
                content: `Generate 10 questions for '${diseaseName}' based on the following parameters, the parameters related to ${diseaseName} are '${params}' and so on. The questions should be able to be answered as an article. Only return the questions as a numbered list, with no extra text or explanations.`,
            },
        ];

        // Prepare the data to be sent to LLM
        const data = llmConfig.inputData(conversationHistory);

        console.log("[DEBUG] Input data for API request:", data);

        // Make API request to LLM
        axios
            .post(llmConfig.apiUrl, data, { headers: llmConfig.headers })
            .then(async (response) => {
                const assistantMessage = llmConfig.responseExtractor(response);
                console.log(
                    "[DEBUG] Extracted assistant message:",
                    assistantMessage
                );

                // Optional: Post-process the response if needed
                if (llmConfig.postProcess) {
                    console.log("[DEBUG] Running post-process function...");
                    await llmConfig.postProcess(response);
                }

                if (assistantMessage) {
                    console.log(
                        "[INFO] Questions generated successfully. Cleaning the response..."
                    );

                    const cleanedQuestions = assistantMessage
                        .replace(/^\d+\.\s*/gm, "") // Remove the numbering
                        .split("\n") // Split by new lines to get individual questions
                        .map((q) => q.trim()) // Trim each question
                        .filter(Boolean); // Filter out any empty entries

                    if (!cleanedQuestions.length) {
                        console.error("[ERROR] No valid questions generated.");
                        return callback(
                            null,
                            "[ERROR] No valid questions generated."
                        );
                    }

                    insertGeneratedQuestionsToDB(
                        diseaseName,
                        cleanedQuestions,
                        sindex,
                        (err, dbResult) => {
                            if (err) {
                                return callback(err, null);
                            }

                            console.log(
                                "[INFO] Questions cleaned successfully:",
                                cleanedQuestions
                            );

                            // Return the generated questions
                            callback(null, cleanedQuestions);
                        }
                    );
                } else {
                    console.error(
                        "[ERROR] No valid message in response from LLM."
                    );
                    callback(
                        null,
                        "[ERROR] No valid message in response from LLM."
                    );
                }
            })
            .catch((error) => {
                console.error(
                    "[ERROR] Error during LLM request:",
                    error.message
                );
                callback(null, error.message);
            });
    });
}

function generateQuestionsAsync(
    diseaseName,
    params,
    sindex,
    llmName,
    userId,
    firmId,
    ipAddress
) {
    return new Promise((resolve, reject) => {
        generateQuestions(
            diseaseName,
            params,
            sindex,
            llmName,
            userId,
            firmId,
            ipAddress,
            (err, questions) => {
                if (err) return reject(err);
                resolve(questions);
            }
        );
    });
}

app.post("/react-native/api/check", (req, res) => {
    const { fileName } = req.body;
    console.log("📥 Received file name:", fileName);

    // Respond back to client
    res.json({ status: "ok", received: fileName });
});

// app.post('/check-scheduling-status', (req, res) => {
//     const { userid, firmid } = req.body;

//     if (!userid || !firmid) {
//         return res.json({ success: false, message: 'Missing userid or firmid' });
//     }

//     const query = `
//     SELECT APPROVED FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS
//     WHERE USERID = ? AND FIRMID = ?
//     LIMIT 1
//   `;

//     connection_trn.query(query, [userid, firmid], (err, results) => {
//         if (err) return res.status(500).json({ success: false, error: err });

//         if (results.length > 0) {
//             return res.json({ success: true, approved: results[0].APPROVED === 'YES' });
//         } else {
//             return res.json({ success: true, approved: false });
//         }
//     });
// });

// // GET /get-holiday-settings
// app.post('/get-holiday-settings', async (req, res) => {
//     const { userid, firmid } = req.body;

//     if (!userid || !firmid) {
//         return res.status(400).json({ success: false, message: 'Missing parameters' });
//     }

//     try {

//         connection_trn.query(
//             `SELECT ALLOW_PUBLIC_HOLIDAYS, ALLOW_SPECIAL_HOLIDAYS
//        FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS
//        WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'`,
//             [userid, firmid],
//             (err, result) => {
//                 if (err) {
//                     console.error('DB error:', err);
//                     return res.status(500).json({ success: false, message: 'Server error' });
//                 }

//                 // if (!result || result.length === 0) {
//                 //     return res.status(404).json({ success: false, message: 'User not found or inactive' });
//                 // }

//                 res.json({
//                     success: true,
//                     data: {
//                         allowPublic: result[0].ALLOW_PUBLIC_HOLIDAYS,
//                         allowSpecial: result[0].ALLOW_SPECIAL_HOLIDAYS
//                     }
//                 });

//             });
//     } catch (err) {
//         console.error('DB error:', err);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// });

app.post("/check-social-account-status", (req, res) => {
    const { userid, firmid } = req.body;

    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ success: false, message: "Missing parameters" });
    }

    const query = `
    SELECT COUNT(*) AS count
    FROM vendor_social_acc_scheduler_planner
    WHERE USERID = ? AND FIRM_ID = ? AND STATUS = 'active'
  `;

    connection.query(query, [userid, firmid], (err, results) => {
        if (err) {
            console.error("MySQL error:", err);
            return res
                .status(500)
                .json({ success: false, message: "Database error" });
        }

        const count = results[0].count;
        res.json({ success: true, exists: count > 0 });
    });
});

app.post("/update-holiday-setting", async (req, res) => {
    const { userid, firmid, type, value } = req.body;

    if (!userid || !firmid || !type || !value) {
        return res
            .status(400)
            .json({ success: false, message: "Missing parameters" });
    }

    const allowedFields = ["ALLOW_PUBLIC_HOLIDAYS", "ALLOW_SPECIAL_HOLIDAYS"];
    if (!allowedFields.includes(type)) {
        return res
            .status(400)
            .json({ success: false, message: "Invalid setting type" });
    }

    const columnMap = {
        ALLOW_PUBLIC_HOLIDAYS: "ALLOW_PUBLIC_HOLIDAYS",
        ALLOW_SPECIAL_HOLIDAYS: "ALLOW_SPECIAL_HOLIDAYS",
    };

    const columnName = columnMap[type]; // safely mapped

    try {
        const insertOrUpdateHolidaySetting = `
            INSERT INTO SMP_SCHEDULER_PLANNER_APPROVED_USERS 
            (USERID, FIRMID, ${columnName})
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            ${columnName} = VALUES(${columnName}),
            UPDATE_DTM = NOW()
            `;

        connection_trn.query(
            insertOrUpdateHolidaySetting,
            [userid, firmid, value],
            (err, result) => {
                if (err) {
                    console.error("DB error:", err);
                    return res
                        .status(500)
                        .json({ success: false, message: "Server error" });
                }
                res.json({ success: true });
            }
        );
    } catch (err) {
        console.error("DB error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});




// New endpoint to update CREATE_WEEKLY_VIDEO setting
app.post("/update-weekly-video-setting", async (req, res) => {
    const { userid, firmid, value } = req.body;

    if (!userid || !firmid || !value) {
        return res
            .status(400)
            .json({ success: false, message: "Missing parameters" });
    }

    if (!["YES", "NO"].includes(value)) {
        return res
            .status(400)
            .json({ success: false, message: "Invalid value. Must be YES or NO" });
    }

    try {
        const updateQuery = `
            INSERT INTO SMP_SCHEDULER_PLANNER_APPROVED_USERS 
            (USERID, FIRMID, CREATE_WEEKLY_VIDEO)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            CREATE_WEEKLY_VIDEO = VALUES(CREATE_WEEKLY_VIDEO),
            UPDATE_DTM = NOW()
        `;

        connection_trn.query(
            updateQuery,
            [userid, firmid, value],
            (err, result) => {
                if (err) {
                    console.error("DB error:", err);
                    return res
                        .status(500)
                        .json({ success: false, message: "Server error" });
                }
                res.json({ success: true, message: "Weekly video setting updated successfully" });
            }
        );
    } catch (err) {
        console.error("DB error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/update-scheduling-approval", (req, res) => {
    const { userid, firmid, value, content_category_id } = req.body;

    if (!userid || !firmid || !value) {
        return res
            .status(400)
            .json({ success: false, message: "Missing parameters" });
    }

    // First, check if the user entry exists
    const checkQuery = `
    SELECT 1 FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS
    WHERE USERID = ? AND FIRMID = ?
  `;

    connection_trn.query(checkQuery, [userid, firmid], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err });

        if (results.length > 0) {
            // Row exists → UPDATE
            const updateQuery = `
        UPDATE SMP_SCHEDULER_PLANNER_APPROVED_USERS
        SET APPROVED = ?, UPDATE_DTM = NOW()
        WHERE USERID = ? AND FIRMID = ?
      `;

            connection_trn.query(
                updateQuery,
                [value, userid, firmid],
                (err) => {
                    if (err)
                        return res
                            .status(500)
                            .json({ success: false, error: err });
                    return res.json({
                        success: true,
                        message: "Updated successfully",
                    });
                }
            );
        } else {
            // No row → INSERT
            const insertQuery = `
    INSERT INTO SMP_SCHEDULER_PLANNER_APPROVED_USERS 
    (USERID, FIRMID, APPROVED, STATUS, INSRT_DTM, CATEGORY, CATEGORY_ID) 
    SELECT ?, ?, ?, 'ACTIVE', NOW(), NAME, ID 
    FROM KF_CATEGORY WHERE ID = ?
  `;

            connection_trn.query(
                insertQuery,
                [userid, firmid, value, content_category_id],
                (err) => {
                    if (err)
                        return res
                            .status(500)
                            .json({ success: false, error: err });
                    return res.json({
                        success: true,
                        message: "Inserted successfully",
                    });
                }
            );
        }
    });
});

app.post("/group/schedulerpanner/toggle-selected", async (req, res) => {
    const { userid, firmid, url_id, selected } = req.body;

    // Log the incoming request payload
    console.log("Received request to toggle status:", req.body);

    // Validate inputs and log failure reason if any
    // if (!userid || !firmid || !url_id || !['active', 'inactive'].includes(selected)) {
    //     console.warn('Invalid input:', { userid, firmid, url_id, selected });
    //     return res.status(400).send("Invalid input");
    // }

    try {
        console.log("Starting DB connection...");

        await nrkindex_prod_111_pool(async (connection) => {
            console.log("Connected to DB, preparing to update status...");
            console.log(
                `Updating STATUS to "${selected}" for USERID=${userid}, FIRM_ID=${firmid}, ID=${url_id}`
            );

            const [result] = await connection.query(
                `UPDATE vendor_social_acc_scheduler_planner 
                 SET SELECTED = ?
                 WHERE USERID = ? AND FIRM_ID = ? AND ID = ?`,
                [selected, userid, firmid, url_id]
            );

            console.log("Update query result:", result);

            if (result.affectedRows === 0) {
                console.warn("No record found to update for given IDs");
                return res.status(404).send("Record not found");
            }

            console.log("Status update successful");
            res.send({ success: true });
        });
    } catch (err) {
        console.error("Database error during status toggle:", err);
        res.status(500).send("Database error");
    }
});

app.post("/group/list/schedulerpanner", async (req, res) => {
    const { pagelist, userid: userId, firmid: firmId } = req.body;

    const platform = "FACEBOOK";

    if (
        !userId ||
        !firmId ||
        !Array.isArray(pagelist) ||
        pagelist.length === 0
    ) {
        return res.status(400).send("Invalid input or pagelist is empty");
    }

    const ids = pagelist.map((item) => String(item.id));

    try {
        await nrkindex_prod_111_pool(async (connection) => {
            // 1. Activate existing IDs
            const placeholders = ids.map(() => "?").join(",");
            await connection.query(
                `UPDATE vendor_social_acc_scheduler_planner SET STATUS = 'active' 
                 WHERE USERID = ? AND FIRM_ID = ? AND URL_ID IN (${placeholders})`,
                [userId, firmId, ...ids]
            );

            // 2. Get all existing URL_IDs
            const [existingRows] = await connection.query(
                `SELECT URL_ID FROM vendor_social_acc_scheduler_planner WHERE USERID = ? AND FIRM_ID = ?`,
                [userId, firmId]
            );

            const existingIds = new Set(
                existingRows.map((row) => String(row.URL_ID))
            );

            // 3. Determine new IDs to insert and old IDs to mark inactive
            const notExistIds = pagelist.filter(
                (item) => !existingIds.has(String(item.id))
            );
            const notInPagelist = [...existingIds].filter(
                (id) => !ids.includes(id)
            );

            // 4. Mark as inactive
            if (notInPagelist.length > 0) {
                const inactivePlaceholders = notInPagelist
                    .map(() => "?")
                    .join(",");
                await connection.query(
                    `UPDATE vendor_social_acc_scheduler_planner SET STATUS = 'inactive' 
                     WHERE USERID = ? AND FIRM_ID = ? AND URL_ID IN (${inactivePlaceholders})`,
                    [userId, firmId, ...notInPagelist]
                );
            }

            // 5. Insert new rows
            if (notExistIds.length > 0) {
                const insertValues = notExistIds.map((item) => [
                    userId,
                    firmId,
                    item.id,
                    "active",
                    `https://www.facebook.com/profile.php?id=${item.id}`,
                    "Page",
                    item.name,
                ]);

                await connection.query(
                    `INSERT INTO vendor_social_acc_scheduler_planner 
                     (USERID, FIRM_ID, URL_ID, STATUS, SOCIAL_URL, ACCOUNT_TYPE, URL_NAME) 
                     VALUES ?`,
                    [insertValues]
                );
            }

            // 6. Return updated active list
            const [result] = await connection.query(
                `SELECT * FROM vendor_social_acc_scheduler_planner 
                 WHERE USERID = ? AND FIRM_ID = ? AND STATUS = 'active' AND PLATFORM = ?`,
                [userId, firmId, platform]
            );

            res.send(result);
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});

app.post("/facebook/schedulerpanner/set/token", (req, res) => {
    console.log("test", req.body);
    const { id, PAGE_ACCESS_TOKEN, TOKEN_DATE } = req.body;

    const QUERY = `UPDATE vendor_social_acc_scheduler_planner SET PAGE_ACCESS_TOKEN= ?,TOKEN_DATE= NOW() WHERE ID = ?`;
    //console.log(QUERY )
    connection.query(QUERY, [PAGE_ACCESS_TOKEN, id], (err, result) => {
        //console.log(result);
        if (err) {
            res.send(err);
        } else {
            res.send(result);
        }
    });
});

app.post("/group/list/schedulerpanner/instagram", async (req, res) => {
    const {
        pagelist,
        userid: userId,
        firmid: firmId,
        platform,
        facebook_token,
    } = req.body;
    const PLATFORM = platform || "INSTAGRAM";

    if (
        !userId ||
        !firmId ||
        !Array.isArray(pagelist) ||
        pagelist.length === 0
    ) {
        return res.status(400).send("Invalid input or pagelist is empty");
    }

    const ids = pagelist.map((item) => String(item.id));

    try {
        await nrkindex_prod_111_pool(async (connection) => {
            // 1. Activate existing IDs
            const placeholders = ids.map(() => "?").join(",");
            await connection.query(
                `UPDATE vendor_social_acc_scheduler_planner SET STATUS = 'active' 
                 WHERE USERID = ? AND FIRM_ID = ? AND INSTAGRAM_BUSINESS_ID IN (${placeholders}) AND PLATFORM = ?`,
                [userId, firmId, ...ids, PLATFORM]
            );

            // 2. Get all existing URL_IDs for this platform
            const [existingRows] = await connection.query(
                `SELECT INSTAGRAM_BUSINESS_ID FROM vendor_social_acc_scheduler_planner WHERE USERID = ? AND FIRM_ID = ? AND PLATFORM = ?`,
                [userId, firmId, PLATFORM]
            );

            const existingIds = new Set(
                existingRows.map((row) => String(row.INSTAGRAM_BUSINESS_ID))
            );

            // 3. Determine new IDs to insert and old IDs to mark inactive
            const notExistIds = pagelist.filter(
                (item) => !existingIds.has(String(item.id))
            );
            const notInPagelist = [...existingIds].filter(
                (id) => !ids.includes(id)
            );

            // 4. Mark as inactive
            if (notInPagelist.length > 0) {
                const inactivePlaceholders = notInPagelist
                    .map(() => "?")
                    .join(",");
                await connection.query(
                    `UPDATE vendor_social_acc_scheduler_planner SET STATUS = 'inactive' 
                     WHERE USERID = ? AND FIRM_ID = ? AND INSTAGRAM_BUSINESS_ID IN (${inactivePlaceholders}) AND PLATFORM = ?`,
                    [userId, firmId, ...notInPagelist, PLATFORM]
                );
            }

            if (notExistIds.length > 0) {
                const insertValues = notExistIds.map((item) => [
                    userId,
                    firmId,
                    item.group_page_id, // URL_ID
                    "active", // STATUS
                    `https://www.facebook.com/profile.php?id=${item.group_page_id}`, // SOCIAL_URL
                    "Page", // ACCOUNT_TYPE
                    PLATFORM, // PLATFORM
                    item.id, // INSTAGRAM_BUSINESS_ID
                    item.username,
                    facebook_token,
                ]);

                // Adjust the insert query to include new columns
                await connection.query(
                    `INSERT INTO vendor_social_acc_scheduler_planner 
                     (USERID, FIRM_ID, URL_ID, STATUS, SOCIAL_URL, ACCOUNT_TYPE,  PLATFORM, INSTAGRAM_BUSINESS_ID, INSTAGRAM_ACCOUNT_NAME, ACESS_TOKEN) 
                     VALUES ?`,
                    [insertValues]
                );
            }

            // 6. Return updated active list for this platform
            const [result] = await connection.query(
                `SELECT * FROM vendor_social_acc_scheduler_planner 
                 WHERE USERID = ? AND FIRM_ID = ? AND STATUS = 'active' AND PLATFORM = ?`,
                [userId, firmId, PLATFORM]
            );

            res.send(result);
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});

// app.get('/api/llm-providers/smp-planner', async (req, res) => {
//     const { llmtype } = req.query;
//     if (!llmtype) return res.status(400).json({ error: 'llmtype is required' });

//     const sql = `SELECT DISTINCT LLM_PROVIDER FROM LLM_DETAILS WHERE LLM_PROVIDER_TYPE = ?`;
//     connection_trn.query(sql, [llmtype], (err, results) => {
//         if (err) {
//             console.error('DB error:', err);
//             return res.status(500).json({ error: 'Database error' });
//         }
//         const providers = results.map(row => row.LLM_PROVIDER);
//         res.json(providers);
//     });
// });

// app.get("/api/get-llm-details-imagegen/smp-planner", async (req, res) => {
//     const { userid, firmid, llmtype } = req.query;

//     if (!userid || !firmid) {
//         return res.status(400).json({ error: "USERID and FIRMID are required." });
//     }

//     try {
//         connection_trn.query(
//             `SELECT * FROM LLM_DETAILS
//          WHERE USERID = ?
//          AND FIRMID = ?
//          AND LLM_PROVIDER_TYPE = ?`,
//             [userid, firmid, llmtype],
//             (err, results) => {
//                 if (err) {
//                     console.error(err);
//                     return res.status(500).json({ error: "Database query failed." });
//                 }
//                 res.json(results);
//             }
//         );
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Something went wrong." });
//     }
// });

// app.post("/api/add-llm/smp-planner", async (req, res) => {
//     const { userid, firmid, apiKey, llmProvider, llmtype } = req.body;

//     if (!userid || !firmid || !apiKey) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     try {
//         await connection_trn.query(
//             "UPDATE LLM_DETAILS SET STATUS = 'INACTIVE' WHERE USERID = ? AND FIRMID = ?",
//             [userid, firmid]
//         );

//         await connection_trn.query(
//             "INSERT INTO LLM_DETAILS (USERID, FIRMID, LLM_PROVIDER, API_KEY,LLM_PROVIDER_TYPE, STATUS) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
//             [userid, firmid, llmProvider, apiKey, llmtype]
//         );

//         res.status(200).json({ success: true, message: "LLM details updated and inserted successfully" });
//     } catch (error) {
//         console.error("Database error:", error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });

app.get("/api/llm-providers/smp-planner", async (req, res) => {
    const { llmtype } = req.query;
    if (!llmtype) {
        return res.status(400).json({ error: "llmtype is required" });
    }

    // const sql = `
    //     SELECT DISTINCT LLM_PROVIDER, MODEL_NAME
    //     FROM API_KEY_MANAGER
    //     WHERE LLM_PROVIDER_TYPE = ? AND APP_NAME = 'SMP-SCHEDULER'
    // `;

    const sql = `
    SELECT DISTINCT LLM_PROVIDER, MODEL_NAME
    FROM API_KEY_MANAGER
    WHERE LLM_PROVIDER_TYPE = ? 
      AND APP_NAME = 'SMP-SCHEDULER'
      AND LLM_PROVIDER != 'OLLAMA'
      AND SHOW_IN_UI = 'YES'
`;

    connection_trn.query(sql, [llmtype], (err, results) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        const response = results.map((row) => ({
            LLM_PROVIDER: row.LLM_PROVIDER,
            MODEL_NAME: row.MODEL_NAME,
        }));

        res.json(response);
    });
});

app.get("/api/get-llm-details-imagegen/smp-planner", async (req, res) => {
    const { userid, firmid, llmtype } = req.query;

    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ error: "USERID and FIRMID are required." });
    }

    try {
        connection_trn.query(
            `SELECT * FROM API_KEY_MANAGER 
         WHERE USERID = ? 
         AND FIRMID = ? 
         `,
            [userid, firmid],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res
                        .status(500)
                        .json({ error: "Database query failed." });
                }
                res.json(results);
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// app.post("/api/add-llm/smp-planner", (req, res) => {
//     const { userid, firmid, apiKey, llmProvider, modelName, llmtype } = req.body;

//     if (!userid || !firmid || !apiKey || !llmProvider || !modelName || !llmtype) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     const deactivateSql = `
//         UPDATE API_KEY_MANAGER
//         SET STATUS = 'INACTIVE'
//         WHERE USERID = ? AND FIRMID = ? AND APP_NAME = 'SMP-SCHEDULER' AND LLM_PROVIDER_TYPE = ?
//     `;

//     connection_trn.query(deactivateSql, [userid, firmid, llmtype], (err1) => {
//         if (err1) {
//             console.error("Error deactivating previous keys:", err1);
//             return res.status(500).json({ error: "Database error (deactivate)" });
//         }

//         const insertSql = `
//             INSERT INTO API_KEY_MANAGER
//                 (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, API_KEY, LLM_PROVIDER_TYPE, APP_NAME, STATUS, INSRT_DTM, UPD_DTM)
//             VALUES (?, ?, ?, ?, ?, ?, 'SMP-SCHEDULER', 'ACTIVE', NOW(), NOW())
//         `;

//         connection_trn.query(insertSql, [userid, firmid, llmProvider, modelName, apiKey, llmtype], (err2) => {
//             if (err2) {
//                 console.error("Error inserting new LLM provider:", err2);
//                 return res.status(500).json({ error: "Database error (insert)" });
//             }

//             res.status(200).json({ success: true, message: "LLM provider added successfully." });
//         });
//     });
// });

app.post("/api/add-llm/smp-planner", (req, res) => {
    const { userid, firmid, apiKey, llmProvider, modelName, llmtype } =
        req.body;

    console.log("🔹 Incoming request body:", req.body);

    if (
        !userid ||
        !firmid ||
        !apiKey ||
        !llmProvider ||
        !modelName ||
        !llmtype
    ) {
        console.warn("⚠️ Missing required fields");
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Helper: decide SPEED based on model size in name
    function getSpeed(model) {
        const match = model.match(/(?:(\d+)x)?(\d+(?:\.\d+)?)\s*[bB]/);
        if (match) {
            const multiplier = match[1] ? parseInt(match[1], 10) : 1;
            const size = parseFloat(match[2]) * multiplier;
            if (size <= 8) {
                console.log(
                    `⚡ Model ${model} classified as SMALL (${size}B) → SPEED 1–3`
                );
                return ["1", "2", "3"][Math.floor(Math.random() * 3)];
            } else {
                console.log(
                    `🐢 Model ${model} classified as LARGE (${size}B) → SPEED 4–5`
                );
                return ["4", "5"][Math.floor(Math.random() * 2)];
            }
        }
        console.log(`ℹ️ Model ${model} did not match size pattern → SPEED 5`);
        return "5";
    }

    function insertAlternates(models, insertSql) {
        const alternateModels = models.filter(
            (m) => m.MODEL_NAME !== modelName
        );

        alternateModels.forEach((altModel) => {
            const altSpeed = getSpeed(altModel.MODEL_NAME); // ⚡ regenerate SPEED here

            const checkSql = `
            SELECT 1 FROM API_KEY_MANAGER
            WHERE USERID=? AND FIRMID=? AND LLM_PROVIDER=? AND LLM_PROVIDER_TYPE=? 
              AND MODEL_NAME=? AND API_KEY=? AND APP_NAME='SMP-SCHEDULER'
        `;

            connection_trn.query(
                checkSql,
                [
                    userid,
                    firmid,
                    llmProvider,
                    llmtype,
                    altModel.MODEL_NAME,
                    apiKey,
                ],
                (checkErr, checkResult) => {
                    if (checkErr) {
                        console.error(
                            "Error checking alternate model existence:",
                            checkErr
                        );
                        return;
                    }
                    if (checkResult.length > 0) {
                        console.log(
                            `🔄 Alternate ${altModel.MODEL_NAME} already exists → skip insert`
                        );
                        return; // ✅ prevent duplicate insert
                    }

                    // New row → insert
                    console.log("📝 Insert alternate with values:", {
                        USERID: userid,
                        FIRMID: firmid,
                        LLM_PROVIDER: llmProvider,
                        MODEL_NAME: altModel.MODEL_NAME,
                        MODEL_URL: altModel.MODEL_URL,
                        MODEL_RESPONSE_VARIABLE:
                            altModel.MODEL_RESPONSE_VARIABLE,
                        API_KEY: apiKey,
                        LLM_PROVIDER_TYPE: llmtype,
                        APP_NAME: "SMP-SCHEDULER",
                        STATUS: "ACTIVE",
                        SPEED: altSpeed, // ✅ regenerated here
                        SHOW_IN_UI: "NO",
                    });

                    connection_trn.query(insertSql, [
                        userid,
                        firmid,
                        llmProvider,
                        altModel.MODEL_NAME,
                        altModel.MODEL_URL,
                        altModel.MODEL_RESPONSE_VARIABLE,
                        apiKey,
                        llmtype,
                        "ACTIVE",
                        altSpeed,
                        "NO",
                    ]);
                }
            );
        });
    }

    // Step 1: Deactivate all previous keys for this user+firm+llmtype

    // Step 2: Fetch all models for given provider
    const fetchModelsSql = `
            SELECT DISTINCT MODEL_NAME, MODEL_URL, MODEL_RESPONSE_VARIABLE
            FROM API_KEY_MANAGER 
            WHERE APP_NAME = 'SMP-SCHEDULER' AND LLM_PROVIDER = ?
        `;
    console.log("📥 Fetching models for provider:", llmProvider);
    connection_trn.query(fetchModelsSql, [llmProvider], (errFetch, models) => {
        if (errFetch) {
            console.error("❌ Error fetching models:", errFetch);
            return res
                .status(500)
                .json({ error: "Database error (fetch models)" });
        }
        const allModels = models.map((r) => r.MODEL_NAME);
        console.log("📦 Models found in DB for provider:", allModels);

        // Step 3: Insert main model (always insert as ACTIVE)
        const insertSql = `
                INSERT INTO API_KEY_MANAGER 
                (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, MODEL_URL, MODEL_RESPONSE_VARIABLE, API_KEY, LLM_PROVIDER_TYPE, APP_NAME, STATUS, SPEED, SHOW_IN_UI, INSRT_DTM, UPD_DTM) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SMP-SCHEDULER', ?, ?, ?, NOW(), NOW())
            `;
        // Step 3: Insert or Update main model
        const mainRow = models.find((r) => r.MODEL_NAME === modelName);
        const modelUrl = mainRow ? mainRow.MODEL_URL : null;
        const modelResponseVar = mainRow
            ? mainRow.MODEL_RESPONSE_VARIABLE
            : null;
        const mainSpeed = getSpeed(modelName);

        const checkKeySql = `
                SELECT ID FROM API_KEY_MANAGER
                WHERE USERID = ? AND FIRMID = ? AND API_KEY = ? AND MODEL_NAME = ? 
                AND LLM_PROVIDER = ? AND LLM_PROVIDER_TYPE = ? AND APP_NAME = 'SMP-SCHEDULER'
            `;

        connection_trn.query(
            checkKeySql,
            [userid, firmid, apiKey, modelName, llmProvider, llmtype],
            (errCheck, rows) => {
                if (errCheck) {
                    console.error(
                        "❌ Error checking existing API key:",
                        errCheck
                    );
                    return res
                        .status(500)
                        .json({ error: "Database error (check key)" });
                }

                if (rows.length > 0) {
                    // Key already exists → update instead of insert
                    console.log(
                        `♻️ API key already exists for ${modelName}, updating SHOW_IN_UI=YES, STATUS=ACTIVE`
                    );
                    const updateSql = `
                UPDATE API_KEY_MANAGER
                SET STATUS = 'ACTIVE', SHOW_IN_UI = 'YES', UPD_DTM = NOW()
                WHERE ID = ?
            `;
                    connection_trn.query(
                        updateSql,
                        [rows[0].ID],
                        (errUpdate) => {
                            if (errUpdate) {
                                console.error(
                                    "❌ Error updating existing key:",
                                    errUpdate
                                );
                                return res.status(500).json({
                                    error: "Database error (update key)",
                                });
                            }
                            console.log(
                                `✅ Existing key for ${modelName} updated to ACTIVE + SHOW_IN_UI=YES`
                            );
                            insertAlternates(models, insertSql);

                            return res.json({
                                success: true,
                                message: "API key updated",
                            });
                        }
                    );
                } else {
                    // Key not found → insert new row
                    console.log(
                        `➕ Inserting new main model ${modelName} as ACTIVE with SPEED ${mainSpeed}`
                    );
                    console.log("📝 Running INSERT with values:", [
                        userid,
                        firmid,
                        llmProvider,
                        modelName,
                        modelUrl,
                        modelResponseVar,
                        apiKey,
                        llmtype,
                        "SMP-SCHEDULER",
                        "ACTIVE",
                        mainSpeed,
                        "YES",
                    ]);

                    connection_trn.query(
                        insertSql,
                        [
                            userid,
                            firmid,
                            llmProvider,
                            modelName,
                            modelUrl,
                            modelResponseVar,
                            apiKey,
                            llmtype,
                            "ACTIVE", // STATUS
                            mainSpeed, // ✅ use calculated value
                            "YES", // SHOW_IN_UI
                        ],

                        (errInsert) => {
                            if (errInsert) {
                                console.error(
                                    "❌ Error inserting main LLM provider:",
                                    errInsert
                                );
                                return res.status(500).json({
                                    error: "Database error (insert main)",
                                });
                            }
                            console.log(
                                `✅ Main model ${modelName} inserted as ACTIVE`
                            );
                            insertAlternates(models, insertSql);

                            return res.json({
                                success: true,
                                message: "API key updated",
                            });
                        }
                    );
                }
            }
        );
    });
});

app.get("/api/schedules", async (req, res) => {
    try {
        const { firmid, userid } = req.query;
        let sql = "SELECT * FROM SMP_USER_MASTER_SCHEDULES WHERE STATUS = ?";
        const params = ["ACTIVE"];

        if (firmid) {
            sql += " AND VENDOR_ID = ?";
            params.push(firmid);
        }
        if (userid) {
            sql += " AND USERID = ?";
            params.push(userid);
        }

        // const [rows] = await connection_trn_117_pool.execute(sql, params);
        const [rows] = await connection_trn_117_pool_retry_wrapper.execute(
            sql,
            params
        );

        res.json(rows);
    } catch (err) {
        console.error("Error fetching schedules:", err);
        res.status(500).json({ error: "Failed to fetch schedules" });
    }
});

app.put("/api/schedules/:id", async (req, res) => {
    const { id } = req.params;
    const { NUMBER_OF_DAYS } = req.body;

    console.log("🔁 PUT /api/schedules/:id called");
    console.log("📥 Params:", { id });
    console.log("📥 Body:", { NUMBER_OF_DAYS });

    // Server-side validation
    if (
        NUMBER_OF_DAYS === undefined ||
        NUMBER_OF_DAYS === null ||
        isNaN(NUMBER_OF_DAYS) ||
        NUMBER_OF_DAYS > 7
    ) {
        console.warn("⚠️ Validation failed: Invalid NUMBER_OF_DAYS");
        return res.status(400).json({
            error: "Number of Days must be a valid number between 1 and 7.",
        });
    }

    try {
        console.log("🔍 Fetching existing schedule...");
        //  const [existingRows] = await connection_trn_117_pool.execute(
        const [existingRows] =
            await connection_trn_117_pool_retry_wrapper.execute(
                `SELECT VENDOR_ID, USERID, SCHEDULER_TYPE, NUMBER_OF_DAYS
             FROM SMP_USER_MASTER_SCHEDULES 
             WHERE USER_SCHD_ID = ? AND STATUS = 'ACTIVE'`,
                [id]
            );

        console.log("🗃️ Existing Schedule Query Result:", existingRows);

        if (existingRows.length === 0) {
            console.warn("❌ Schedule not found or not ACTIVE");
            return res
                .status(404)
                .json({ error: "Schedule not found or not ACTIVE" });
        }

        const {
            VENDOR_ID,
            USERID,
            SCHEDULER_TYPE,
            NUMBER_OF_DAYS: oldDays,
        } = existingRows[0];
        const newDays = Number(NUMBER_OF_DAYS) || 0;

        console.log("✅ Schedule found. Vendor/User info:", {
            VENDOR_ID,
            USERID,
            oldDays,
            newDays,
        });

        console.log("🧮 Calculating current total excluding this record...");

        const schedulerGroups = {
            "SPECIAL DAYS": {
                types: ["SPECIAL DAYS"],
                error: "Cannot exceed 7 days for SPECIAL DAYS",
            },
            "NATIONAL HOLIDAYS": {
                types: ["NATIONAL HOLIDAYS"],
                error: "Cannot exceed 7 days for NATIONAL HOLIDAYS",
            },
            default: {
                types: ["USER DAYS", "IMAGE_RE-GEN_DAYS"],
                error: "Cannot exceed 7 days for USER DAYS + IMAGE_RE-GEN_DAYS",
            },
        };

        const group =
            schedulerGroups[SCHEDULER_TYPE] || schedulerGroups["default"];

        const placeholders = group.types.map(() => "?").join(", ");
        const totalQuery = `
    SELECT COALESCE(SUM(NUMBER_OF_DAYS), 0) AS totalDays
    FROM SMP_USER_MASTER_SCHEDULES
    WHERE VENDOR_ID = ? AND USERID = ?
      AND STATUS = 'ACTIVE'
      AND SCHEDULER_TYPE IN (${placeholders})
      AND USER_SCHD_ID != ?`;

        const totalParams = [VENDOR_ID, USERID, ...group.types, id];
        const errorMsg = group.error;

        const [sumRows] = await connection_trn_117_pool_retry_wrapper.execute(
            totalQuery,
            totalParams
        );

        // const currentTotal = sumRows[0].totalDays;
        const currentTotal = Number(sumRows[0].totalDays); // ensure it's a number
        const effectiveTotal = currentTotal + newDays;

        console.log("📊 Totals:", { currentTotal, newDays, effectiveTotal });

        if (effectiveTotal > 7) {
            console.warn("❌ Effective total days exceed limit of 7");
            return res.status(400).json({ error: errorMsg });
        }

        console.log("✅ Validation passed. Proceeding with update...");

        // const [result] = await connection_trn_117_pool.execute(
        const [result] = await connection_trn_117_pool_retry_wrapper.execute(
            `UPDATE SMP_USER_MASTER_SCHEDULES
             SET NUMBER_OF_DAYS = ?
             WHERE USER_SCHD_ID = ?`,
            [NUMBER_OF_DAYS, id]
        );

        console.log("📝 Update result:", result);

        if (result.affectedRows === 0) {
            console.warn("❌ No rows affected during update");
            return res.status(404).json({ error: "Schedule not found" });
        }

        console.log("✅ Schedule updated successfully!");
        res.json({ message: "Schedule updated successfully!" });
    } catch (err) {
        console.error("💥 Error during schedule update:", err);
        res.status(500).json({
            error:
                "Error updating schedule: " +
                (err.message || "Unknown database error"),
        });
    }
});

// app.put('/api/schedules/:id', async (req, res) => {
//     const { id } = req.params;
//     const { NUMBER_OF_DAYS } = req.body;

//     console.log("🔁 PUT /api/schedules/:id called");
//     console.log("📥 Params:", { id });
//     console.log("📥 Body:", { NUMBER_OF_DAYS });

//     // Server-side validation
//     if (NUMBER_OF_DAYS === undefined || NUMBER_OF_DAYS === null || isNaN(NUMBER_OF_DAYS) || NUMBER_OF_DAYS >= 7) {
//         console.warn("⚠️ Validation failed: Invalid NUMBER_OF_DAYS");
//         return res.status(400).json({ error: 'Number of Days must be a valid number and less than 7.' });
//     }

//     try {
//         console.log("🔍 Fetching existing schedule...");
//         //  const [existingRows] = await connection_trn_117_pool.execute(
//         const [existingRows] = await connection_trn_117_pool_retry_wrapper.execute(
//             `SELECT VENDOR_ID, USERID, NUMBER_OF_DAYS
//              FROM SMP_USER_MASTER_SCHEDULES
//              WHERE USER_SCHD_ID = ? AND STATUS = 'ACTIVE'`,
//             [id]
//         );

//         console.log("🗃️ Existing Schedule Query Result:", existingRows);

//         if (existingRows.length === 0) {
//             console.warn("❌ Schedule not found or not ACTIVE");
//             return res.status(404).json({ error: 'Schedule not found or not ACTIVE' });
//         }

//         const { VENDOR_ID, USERID, NUMBER_OF_DAYS: oldDays } = existingRows[0];
//         const newDays = Number(NUMBER_OF_DAYS) || 0;

//         console.log("✅ Schedule found. Vendor/User info:", { VENDOR_ID, USERID, oldDays, newDays });

//         console.log("🧮 Calculating current total excluding this record...");
//         // const [sumRows] = await connection_trn_117_pool.execute(
//         const [sumRows] = await connection_trn_117_pool_retry_wrapper.execute(
//             `SELECT COALESCE(SUM(NUMBER_OF_DAYS), 0) AS totalDays
//              FROM SMP_USER_MASTER_SCHEDULES
//              WHERE VENDOR_ID = ? AND USERID = ? AND STATUS = 'ACTIVE' AND USER_SCHD_ID != ?`,
//             [VENDOR_ID, USERID, id]
//         );

//         // const currentTotal = sumRows[0].totalDays;
//         const currentTotal = Number(sumRows[0].totalDays); // ensure it's a number
//         const effectiveTotal = currentTotal + newDays;

//         console.log("📊 Totals:", { currentTotal, newDays, effectiveTotal });

//         if (effectiveTotal > 7) {
//             console.warn("❌ Effective total days exceed limit of 7");
//             return res.status(400).json({ error: 'Total Number of Days for this user/vendor cannot exceed 7.' });
//         }

//         console.log("✅ Validation passed. Proceeding with update...");

//         // const [result] = await connection_trn_117_pool.execute(
//         const [result] = await connection_trn_117_pool_retry_wrapper.execute(

//             `UPDATE SMP_USER_MASTER_SCHEDULES
//              SET NUMBER_OF_DAYS = ?
//              WHERE USER_SCHD_ID = ?`,
//             [NUMBER_OF_DAYS, id]
//         );

//         console.log("📝 Update result:", result);

//         if (result.affectedRows === 0) {
//             console.warn("❌ No rows affected during update");
//             return res.status(404).json({ error: 'Schedule not found' });
//         }

//         console.log("✅ Schedule updated successfully!");
//         res.json({ message: 'Schedule updated successfully!' });

//     } catch (err) {
//         console.error('💥 Error during schedule update:', err);
//         res.status(500).json({ error: 'Error updating schedule: ' + (err.message || 'Unknown database error') });
//     }
// });

// app.post('/api/schedules', async (req, res) => {
//     const {
//         SCHEDULER_TYPE,
//         SCHEDULER_DETAILS,
//         NUMBER_OF_DAYS,
//         STATUS,
//         VENDOR_ID,
//         USERID
//     } = req.body;

//     console.log("✅ Received schedule data:", {
//         SCHEDULER_TYPE,
//         SCHEDULER_DETAILS,
//         NUMBER_OF_DAYS,
//         STATUS,
//         VENDOR_ID,
//         USERID
//     });

//     try {
//         const newDays = Number(NUMBER_OF_DAYS) || 0;
//         console.log("📌 Parsed NUMBER_OF_DAYS to newDays:", newDays);

//         // Get current total active days
//         // const [activeSumRows] = await pool.execute(
//         const [activeSumRows] = await connection_trn_117_pool_retry_wrapper.execute(

//             `SELECT COALESCE(SUM(NUMBER_OF_DAYS), 0) AS totalDays
//              FROM SMP_USER_MASTER_SCHEDULES
//              WHERE VENDOR_ID = ? AND USERID = ? AND STATUS = 'ACTIVE'`,
//             [VENDOR_ID, USERID]
//         );
//         let currentTotal = Number(activeSumRows[0].totalDays);
//         console.log("📊 Current total ACTIVE days (parsed to number):", currentTotal);

//         // Check if the scheduler already exists (any status)
//         // const [existingRows] = await connection_trn_117_pool.execute(
//         const [existingRows] = await connection_trn_117_pool_retry_wrapper.execute(

//             `SELECT USER_SCHD_ID, STATUS, NUMBER_OF_DAYS
//              FROM SMP_USER_MASTER_SCHEDULES
//              WHERE SCHEDULER_TYPE = ? AND VENDOR_ID = ? AND USERID = ?`,
//             [SCHEDULER_TYPE, VENDOR_ID, USERID]
//         );

//         console.log("🔍 Existing scheduler check:", existingRows);

//         if (existingRows.length > 0) {
//             const existing = existingRows[0];
//             console.log("📝 Scheduler exists with status:", existing.STATUS);

//             if (existing.STATUS === 'INACTIVE') {
//                 const oldDays = Number(existing.NUMBER_OF_DAYS) || 0;
//                 const effectiveTotal = currentTotal - oldDays + newDays;

//                 console.log("⚖️ Reactivating... oldDays:", oldDays, "→ effectiveTotal:", effectiveTotal);

//                 if (effectiveTotal > 7) {
//                     console.warn("❌ Limit exceeded:", effectiveTotal);
//                     return res.status(400).json({ error: 'Total Number of Days for this user/vendor cannot exceed 7.' });
//                 }

//                 // const [updateResult] = await connection_trn_117_pool.execute(
//                 const [updateResult] = await connection_trn_117_pool_retry_wrapper.execute(

//                     `UPDATE SMP_USER_MASTER_SCHEDULES
//                      SET STATUS = 'ACTIVE',
//                          SCHEDULER_DETAILS = ?,
//                          NUMBER_OF_DAYS = ?,
//                          INSERT_DATE_TIME = NOW(),
//                          INSERT_ID = ?
//                      WHERE USER_SCHD_ID = ?`,
//                     [SCHEDULER_DETAILS, newDays || null, 1, existing.USER_SCHD_ID]
//                 );

//                 console.log("✅ Reactivated schedule:", updateResult);

//                 return res.status(200).json({ message: 'Schedule updated from INACTIVE to ACTIVE', updatedId: existing.USER_SCHD_ID });

//             } else if (existing.STATUS === 'ACTIVE') {
//                 console.warn("⛔ Already ACTIVE scheduler. Rejecting...");
//                 return res.status(400).json({ error: 'Already added, adjust number below.' });
//             }
//         } else {
//             // New insert path
//             const effectiveTotal = currentTotal + newDays;
//             console.log("🆕 New insert path → effectiveTotal:", effectiveTotal);

//             if (effectiveTotal > 7) {
//                 console.warn("❌ New insert exceeds limit:", effectiveTotal);
//                 return res.status(400).json({ error: 'Total Number of Days for this user/vendor cannot exceed 7.' });
//             }

//             // const [result] = await connection_trn_117_pool.execute(
//             const [result] = await connection_trn_117_pool_retry_wrapper.execute(

//                 `INSERT INTO SMP_USER_MASTER_SCHEDULES
//                  (SCHEDULER_TYPE, SCHEDULER_DETAILS, NUMBER_OF_DAYS, STATUS, VENDOR_ID, USERID, INSERT_ID)
//                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
//                 [SCHEDULER_TYPE, SCHEDULER_DETAILS, newDays || null, STATUS || 'ACTIVE', VENDOR_ID, USERID, 1]
//             );

//             console.log("✅ Inserted new schedule with ID:", result.insertId);

//             return res.status(201).json({ message: 'Schedule added successfully!', id: result.insertId });
//         }
//     } catch (err) {
//         console.error('🔥 Error processing schedule:', err);
//         res.status(500).json({ error: 'Error processing schedule: ' + err.message });
//     }
// });

app.post("/api/schedules", async (req, res) => {
    const {
        SCHEDULER_TYPE,
        SCHEDULER_DETAILS,
        NUMBER_OF_DAYS,
        STATUS,
        VENDOR_ID,
        USERID,
    } = req.body;

    console.log("✅ Received schedule data:", {
        SCHEDULER_TYPE,
        SCHEDULER_DETAILS,
        NUMBER_OF_DAYS,
        STATUS,
        VENDOR_ID,
        USERID,
    });

    try {
        const newDays = Number(NUMBER_OF_DAYS) || 0;
        console.log("📌 Parsed NUMBER_OF_DAYS to newDays:", newDays);

        // Get current total for logic group
        let totalQuery = "";
        let queryParams = [];

        if (
            SCHEDULER_TYPE === "SPECIAL DAYS" ||
            SCHEDULER_TYPE === "NATIONAL HOLIDAYS"
        ) {
            // Own type limit
            totalQuery = `
        SELECT COALESCE(SUM(NUMBER_OF_DAYS), 0) AS totalDays
        FROM SMP_USER_MASTER_SCHEDULES
        WHERE VENDOR_ID = ? AND USERID = ? AND STATUS = 'ACTIVE' AND SCHEDULER_TYPE = ?
      `;
            queryParams = [VENDOR_ID, USERID, SCHEDULER_TYPE];
        } else {
            // Combined USER DAYS + IMAGE_RE-GEN_DAYS limit
            totalQuery = `
        SELECT COALESCE(SUM(NUMBER_OF_DAYS), 0) AS totalDays
        FROM SMP_USER_MASTER_SCHEDULES
        WHERE VENDOR_ID = ? AND USERID = ? AND STATUS = 'ACTIVE' AND SCHEDULER_TYPE IN ('USER DAYS', 'IMAGE_RE-GEN_DAYS')
      `;
            queryParams = [VENDOR_ID, USERID];
        }

        const [activeSumRows] =
            await connection_trn_117_pool_retry_wrapper.execute(
                totalQuery,
                queryParams
            );
        const currentTotal = Number(activeSumRows[0].totalDays);
        console.log("📊 Current relevant total (based on type):", currentTotal);

        // Check if same SCHEDULER_TYPE already exists
        const [existingRows] =
            await connection_trn_117_pool_retry_wrapper.execute(
                `SELECT USER_SCHD_ID, STATUS, NUMBER_OF_DAYS
       FROM SMP_USER_MASTER_SCHEDULES
       WHERE SCHEDULER_TYPE = ? AND VENDOR_ID = ? AND USERID = ?`,
                [SCHEDULER_TYPE, VENDOR_ID, USERID]
            );

        if (existingRows.length > 0) {
            const existing = existingRows[0];
            console.log("📝 Scheduler exists with status:", existing.STATUS);

            if (existing.STATUS === "INACTIVE") {
                const effectiveTotal = currentTotal + newDays;

                console.log(
                    "⚖️ Reactivating... → effectiveTotal:",
                    effectiveTotal
                );

                if (effectiveTotal > 7) {
                    const errorMsg =
                        SCHEDULER_TYPE === "SPECIAL DAYS" ||
                            SCHEDULER_TYPE === "NATIONAL HOLIDAYS"
                            ? "Cannot exceed 7 days for this scheduler type group."
                            : "Cannot exceed 7 days for user days + image regeneration days";

                    return res.status(400).json({ error: errorMsg });
                }

                const [updateResult] =
                    await connection_trn_117_pool_retry_wrapper.execute(
                        `UPDATE SMP_USER_MASTER_SCHEDULES
           SET STATUS = 'ACTIVE',
               SCHEDULER_DETAILS = ?,
               NUMBER_OF_DAYS = ?,
               INSERT_DATE_TIME = NOW(),
               INSERT_ID = ?
           WHERE USER_SCHD_ID = ?`,
                        [
                            SCHEDULER_DETAILS,
                            newDays || null,
                            1,
                            existing.USER_SCHD_ID,
                        ]
                    );

                console.log("✅ Reactivated schedule:", updateResult);

                return res.status(200).json({
                    message: "Schedule updated from INACTIVE to ACTIVE",
                    updatedId: existing.USER_SCHD_ID,
                });
            }

            if (existing.STATUS === "ACTIVE") {
                console.warn("⛔ Already ACTIVE scheduler. Rejecting...");
                return res
                    .status(400)
                    .json({ error: "Already added, adjust number below." });
            }
        }

        // New insert
        const effectiveTotal = currentTotal + newDays;
        console.log("🆕 New insert path → effectiveTotal:", effectiveTotal);

        if (effectiveTotal > 7) {
            console.warn("❌ New insert exceeds limit:", effectiveTotal);
            const errorMsg =
                SCHEDULER_TYPE === "SPECIAL DAYS" ||
                    SCHEDULER_TYPE === "NATIONAL HOLIDAYS"
                    ? "Cannot exceed 7 days for this scheduler type group."
                    : "Cannot exceed 7 days for user days + image regeneration days";

            return res.status(400).json({ error: errorMsg });
        }

        const [result] = await connection_trn_117_pool_retry_wrapper.execute(
            `INSERT INTO SMP_USER_MASTER_SCHEDULES
       (SCHEDULER_TYPE, SCHEDULER_DETAILS, NUMBER_OF_DAYS, STATUS, VENDOR_ID, USERID, INSERT_ID)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                SCHEDULER_TYPE,
                SCHEDULER_DETAILS,
                newDays || null,
                STATUS || "ACTIVE",
                VENDOR_ID,
                USERID,
                1,
            ]
        );

        console.log("✅ Inserted new schedule with ID:", result.insertId);

        return res.status(201).json({
            message: "Schedule added successfully!",
            id: result.insertId,
        });
    } catch (err) {
        console.error("🔥 Error processing schedule:", err);
        res.status(500).json({
            error: "Error processing schedule: " + err.message,
        });
    }
});

app.post("/deactivate/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // const [result] = await connection_trn_117_pool.execute(
        const [result] = await connection_trn_117_pool_retry_wrapper.execute(
            "UPDATE SMP_USER_MASTER_SCHEDULES SET STATUS = ? WHERE USER_SCHD_ID = ?",
            ["INACTIVE", id]
        );
        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ error: "Schedule not found or already inactive" });
        }
        res.json({ message: "Schedule marked as INACTIVE successfully!" });
    } catch (err) {
        console.error("Error updating schedule status:", err);
        res.status(500).json({
            error: "Error updating schedule: " + err.message,
        });
    }
});

app.post("/check-scheduling-status", (req, res) => {
    const { userid, firmid } = req.body;

    if (!userid || !firmid) {
        return res.json({
            success: false,
            message: "Missing userid or firmid",
        });
    }

    const query = `
        SELECT APPROVED, CATEGORY_ID, CATEGORY
        FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS
        WHERE USERID = ? AND FIRMID = ?
        LIMIT 1
    `;

    connection_trn.query(query, [userid, firmid], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err });

        if (results.length > 0) {
            const { APPROVED, CATEGORY_ID, CATEGORY } = results[0];
            return res.json({
                success: true,
                approved: APPROVED === "YES",
                categoryId: CATEGORY_ID,
                category: CATEGORY,
            });
        } else {
            return res.json({ success: true, approved: false });
        }
    });
});

app.post("/get-holiday-settings", async (req, res) => {
    const { userid, firmid } = req.body;

    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ success: false, message: "Missing parameters" });
    }

    try {
        connection_trn.query(
            `SELECT ALLOW_PUBLIC_HOLIDAYS, ALLOW_SPECIAL_HOLIDAYS
       FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS
       WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'`,
            [userid, firmid],
            (err, result) => {
                if (err) {
                    console.error("DB error:", err);
                    return res
                        .status(500)
                        .json({ success: false, message: "Server error" });
                }

                if (!result || result.length === 0) {
                    // No row found – return default values
                    return res.json({
                        success: true,
                        data: {
                            allowPublic: "NO",
                            allowSpecial: "NO",
                        },
                    });
                }

                // Row exists – return actual settings
                return res.json({
                    success: true,
                    data: {
                        allowPublic: result[0].ALLOW_PUBLIC_HOLIDAYS || "NO",
                        allowSpecial: result[0].ALLOW_SPECIAL_HOLIDAYS || "NO",
                    },
                });
            }
        );
    } catch (err) {
        console.error("Exception:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/smpscheduler/doc-configs", (req, res) => {
    const query = `
        SELECT 
            CONFIG_ID, 
            CFG_PRNT_CD 
        FROM 
            kf_doc_config 
        WHERE 
            DOC_CATEGRY_ID = 125
    `;

    connection_trn.query(query, (error, results) => {
        if (error) {
            console.error("Error executing query:", error);
            res.status(500).send("Internal Server Error");
        } else {
            console.log(`Fetched ${results.length} document config records`);
            res.json(results); // sends array of { CONFIG_ID, CFG_PRNT_CD }
        }
    });
});

app.post("/socialmedia/schedulerplanner/check", (req, res) => {
    const { firmid, userid } = req.body;

    // Validate input
    if (!firmid || !userid) {
        return res
            .status(400)
            .json({ error: "FIRM_ID and USERID are required" });
    }

    const QUERY = `
        SELECT 1 FROM vendor_social_acc_scheduler_planner
        WHERE STATUS = 'active'
        AND SELECTED = 'YES'
        AND FIRM_ID = ?
        AND USERID = ?
        LIMIT 1
    `;

    connection.query(QUERY, [firmid, userid], (err, results) => {
        if (err) {
            console.error("DB Error:", err);
            return res
                .status(500)
                .json({ error: "Database error", details: err });
        }

        if (results.length > 0) {
            res.json({ result: "YES" });
        } else {
            res.json({ result: "NO" });
        }
    });
});

app.post("/update-scheduler-category", (req, res) => {
    const { userid, firmid, categoryId, category } = req.body;

    if (!userid || !firmid || !categoryId || !category) {
        return res.json({ success: false, message: "Missing inputs" });
    }

    const updateQuery = `
        UPDATE SMP_SCHEDULER_PLANNER_APPROVED_USERS
        SET CATEGORY_ID = ?, CATEGORY = ?
        WHERE USERID = ? AND FIRMID = ?
    `;

    connection_trn.query(
        updateQuery,
        [categoryId, category, userid, firmid],
        (err, result) => {
            if (err)
                return res.status(500).json({ success: false, error: err });

            return res.json({ success: true });
        }
    );
});

app.get("/api/detect-country", (req, res) => {
    console.log("🟢 Incoming request to /api/detect-country");
    console.log("🧾 All headers:", req.headers);

    const rawIp =
        getClientIp(req) ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        "";
    console.log("📥 Raw Extracted IP:", rawIp);

    // Step 1: Normalize IP (remove IPv6 prefix if needed)
    const ip = rawIp.replace(/^::ffff:/, "");
    console.log("🌐 Normalized IP:", ip);

    // Step 2: Geo lookup
    const geo = geoip.lookup(ip);
    console.log("🌍 Geo lookup result:", geo);

    // Step 3: Return response
    const country = geo?.country || "Unknown";
    console.log("📤 Responding with country:", country);

    res.json({
        ip,
        country,
        info: geo || null,
    });
});

// app.get('/api/scheduler-planner/check-first-run', (req, res) => {
//     const { userid, firmid } = req.query;

//     if (!userid || !firmid) {
//         return res.status(400).json({ error: 'userid and firmid are required' });
//     }

//     const query = `
//         SELECT FIRST_RUN FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS
//         WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
//     `;

//     connection_trn.query(query, [userid, firmid], (err, results) => {
//         if (err) {
//             console.error('Query error:', err);
//             return res.status(500).json({ error: 'Internal server error' });
//         }

//         if (results.length > 0 && results[0].FIRST_RUN) {
//             res.json({ firstRun: results[0].FIRST_RUN });
//         } else {
//             res.json({ firstRun: 'NO' });
//         }
//     });
// });

app.get("/api/scheduler-planner/check-first-run", (req, res) => {
    const userid = req.query.userid?.trim();
    const firmid = req.query.firmid?.trim();

    if (!userid || !firmid) {
        return res.status(400).json({
            error: "Missing required query parameters: userid and firmid",
        });
    }

    const firstRunQuery = `
        SELECT FIRST_RUN 
        FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS 
        WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
    `;

    connection_trn.query(firstRunQuery, [userid, firmid], (err, results) => {
        if (err) {
            console.error("Query error (first run):", err);
            return res.status(500).json({ error: "Internal server error" });
        }

        const firstRun = results[0]?.FIRST_RUN;

        // If not 'YES' just return as is
        if (!firstRun || firstRun !== "YES") {
            return res.json({ firstRun: "NO" });
        }

        // Now check if planner table has entries
        const plannerCheckQuery = `
            SELECT 1 
            FROM SMP_SCHEDULER_PLANNER 
            WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE' 
            LIMIT 1
        `;

        connection_trn.query(
            plannerCheckQuery,
            [userid, firmid],
            (err2, plannerResults) => {
                if (err2) {
                    console.error("Query error (planner check):", err2);
                    return res
                        .status(500)
                        .json({ error: "Internal server error" });
                }

                if (plannerResults.length > 0) {
                    return res.json({ firstRun: "NO" });
                } else {
                    return res.json({ firstRun: "YES" });
                }
            }
        );
    });
});

// //25-07
// //cr entry - business app
// app.post('/api/crentry', (req, res) => {
//     const {
//         task, emp_id, emp_name, task_type,
//         project_id, remarks, start_time, end_time,
//         task_steps, br_dtls, status
//     } = req.body;

//     const insertQuery = `
//     INSERT INTO CR_TABLE
//     (TASK, EMP_ID, EMP_NAME, TASK_TYPE, PROJECT_ID, REMARKS,
//      START_TIME, END_TIME, TASK_STEPS, BR_DTLS, STATUS)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//     const values = [
//         task, emp_id, emp_name, task_type,
//         project_id, remarks, start_time, end_time,
//         task_steps, br_dtls, status
//     ];

//     pmoConnection.query(insertQuery, values, (err, result) => {
//         if (err) {
//             console.error('Insert failed:', err);
//             return res.status(500).json({ error: 'Insert failed' });
//         }

//         const insertedCID = result.insertId;

//         // Update CR_ID to match CID
//         const updateQuery = `UPDATE CR_TABLE SET CR_ID = ? WHERE CID = ?`;

//         pmoConnection.query(updateQuery, [insertedCID, insertedCID], (err2) => {
//             if (err2) {
//                 console.error('Failed to update CR_ID:', err2);
//                 return res.status(500).json({ error: 'CR_ID update failed' });
//             }

//             return res.status(200).json({ message: 'CR Entry submitted', crid: insertedCID });
//         });
//     });
// });

// //update for edit - 28-7
// app.put('/api/crentry/:crid', (req, res) => {
//     const crid = req.params.crid;
//     const {
//         task, emp_id, emp_name, task_type, project_id, remarks, status,
//         start_time, end_time, task_steps, br_dtls
//     } = req.body;

//     const updateQuery = `
//     UPDATE CR_TABLE SET
//       TASK = ?, EMP_ID = ?, EMP_NAME = ?, TASK_TYPE = ?, PROJECT_ID = ?, REMARKS = ?, STATUS = ?,
//       START_TIME = ?, END_TIME = ?, TASK_STEPS = ?, BR_DTLS = ?
//     WHERE CR_ID = ?
//   `;

//     const values = [
//         task, emp_id, emp_name, task_type, project_id, remarks, status,
//         start_time, end_time, task_steps, br_dtls, crid
//     ];

//     pmoConnection.query(updateQuery, values, (err, result) => {
//         if (err) {
//             console.error('Update failed:', err);
//             res.status(500).json({ error: 'Update failed' });
//         } else {
//             res.status(200).json({ message: 'CR updated successfully', crid: crid });
//         }
//     });
// });

// // Get CR entries with status Pending or In Progress for employee

// app.get('/api/existing-crs', (req, res) => {
//     const empId = req.query.empid;

//     if (!empId) {
//         return res.status(400).json({ error: 'Missing empid' });
//     }

//     const query = `
//     SELECT CR_ID, TASK, PROJECT_ID
//     FROM CR_TABLE
//     WHERE EMP_ID = ? AND STATUS IN ('Pending', 'In Progress')
//   `;

//     pmoConnection.query(query, [empId], (err, result) => {
//         if (err) {
//             console.error('Error fetching existing CRs:', err);
//             return res.status(500).json({ error: 'Failed to fetch existing CRs' });
//         }
//         res.json(result);
//     });
// });

app.get("/api/image-details", (req, res) => {
    const { userid, firmid } = req.query;

    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ message: "userid and firmid are required" });
    }

    const query = `
    SELECT * FROM IMAGE_DETAILS
WHERE USERID = ? AND VENDOR_ID = ? AND STATUS = 'ACTIVE';
  `;

    connection_trn.query(query, [userid, firmid], (error, results) => {
        if (error) {
            console.error("Query error:", error);
            return res.status(500).json({ message: "Database query failed" });
        }

        res.json(results);
    });
});

app.post("/api/delete-image", (req, res) => {
    const { image_id } = req.body;

    if (!image_id) {
        return res.status(400).json({ message: "image_id is required" });
    }

    const query = `
    UPDATE IMAGE_DETAILS
    SET STATUS = 'INACTIVE'
    WHERE IMAGE_ID = ? AND STATUS = 'ACTIVE'
  `;

    connection_trn.query(query, [image_id], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Failed to delete image" });
        }

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ message: "Image not found or already deleted" });
        }

        res.json({ message: "Image deleted successfully (soft delete)" });
    });
});

app.post("/api/scheduler-planner/save-caption", (req, res) => {
    const { plannerId, caption, userid, firmid } = req.body;

    const query = `
        UPDATE SMP_SCHEDULER_PLANNER 
        SET CAPTION = ?, UPDATE_DTM = CURRENT_TIMESTAMP 
        WHERE PLANNER_ID = ? AND USERID = ? AND FIRMID = ?
    `;

    connection_trn.query(
        query,
        [caption, plannerId, userid, firmid],
        (err, result) => {
            if (err) {
                console.error("Failed to save caption:", err);
                return res.status(500).json({ error: "Save caption failed" });
            }

            res.json({ success: true });
        }
    );
});

app.post("/api/holiday/special/delete", (req, res) => {
    const { shId, userid, firmid } = req.body;

    console.log("🔍 Received delete request with data:", {
        shId,
        userid,
        firmid,
    });

    if (!shId || !userid || !firmid) {
        console.log("⚠️ Missing required fields in request body");
        return res.status(400).json({ error: "Missing required fields" });
    }

    const query = `
        UPDATE SPECIAL_USER_HOLIDAY
        SET STATUS = 'INACTIVE', UPDATE_DTM = CURRENT_TIMESTAMP
        WHERE SH_ID = ? AND USERID = ? AND FIRMID = ?
    `;

    console.log("📄 Executing query:", query);
    console.log("📦 With params:", [shId, userid, firmid]);

    connection_trn.query(query, [shId, userid, firmid], (err, result) => {
        if (err) {
            console.error("❌ Failed to soft delete holiday:", err);
            return res.status(500).json({ error: "Delete failed" });
        }

        console.log("✅ Query executed successfully:", result);

        if (result.affectedRows === 0) {
            console.log(
                "⚠️ No rows updated. Check if the holiday ID and user/firm match."
            );
            return res
                .status(404)
                .json({ error: "No matching record found to delete" });
        }

        res.json({ success: true });
    });
});

app.get("/api/scheduler-planner/week-has-data", (req, res) => {
    const { userid, firmid, offset = 0 } = req.query;

    if (!userid || !firmid) {
        return res.status(400).json({ error: "Missing userid or firmid" });
    }

    const today = new Date();
    const weekOffset = parseInt(offset, 10) || 0;

    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    sunday.setHours(0, 0, 0, 0);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    const formatDate = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;

    const startOfWeek = formatDate(sunday);
    const endOfWeek = formatDate(saturday);

    const query = `
        SELECT COUNT(*) AS count FROM SMP_SCHEDULER_PLANNER
        WHERE POST_DATE BETWEEN ? AND ? AND USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
    `;

    connection_trn.query(
        query,
        [startOfWeek, endOfWeek, userid, firmid],
        (err, results) => {
            if (err) {
                console.error("❌ Failed to check week:", err);
                return res.status(500).json({ error: "Failed to check week" });
            }

            const hasData = results[0].count > 0;
            res.json({ hasData });
        }
    );
});

// Express.js route example:
app.post("/get-posting-time", (req, res) => {
    const { userid, firmid } = req.body;
    if (!userid || !firmid) {
        return res
            .status(400)
            .json({ success: false, message: "Missing userid or firmid" });
    }

    const sql = `SELECT POSTING_TIME FROM SMP_SCHEDULER_PLANNER_APPROVED_USERS WHERE USERID = ? AND FIRMID = ? LIMIT 1`;

    connection_trn.query(sql, [userid, firmid], (err, results) => {
        if (err) {
            console.error("DB error fetching posting time:", err);
            return res
                .status(500)
                .json({ success: false, message: "Database error" });
        }
        if (results.length === 0) {
            return res.json({ success: true, postingTime: "09:00:00" }); // fallback default
        }

        return res.json({
            success: true,
            postingTime: results[0].POSTING_TIME,
        });
    });
});

// ✅ API: Get watermark setting
app.get("/api/watermark-settings", (req, res) => {
    const { userid, firmid } = req.query;

    console.log("👉 [GET] /api/watermark-settings called with:", {
        userid,
        firmid,
    });

    const sql = `
    SELECT ALWAYS_ADD
    FROM WATERMARKS_DETAILS
    WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
    LIMIT 1
  `;

    console.log("📄 Executing SQL:", sql, "with params:", [userid, firmid]);

    connection_trn.query(sql, [userid, firmid], (err, result) => {
        if (err) {
            console.error("❌ DB Error in GET /api/watermark-settings:", err);
            return res.status(500).send("Database error");
        }
        console.log("✅ Query result:", result);

        if (result.length > 0) {
            res.json({ alwaysAdd: result[0].ALWAYS_ADD });
        } else {
            console.log("⚠️ No active record found, returning default");
            res.json({ alwaysAdd: "NO" });
        }
    });
});

// ✅ API: Update watermark setting
app.post("/api/watermark-settings", (req, res) => {
    const { userid, firmid, alwaysAdd } = req.body;

    console.log("👉 [POST] /api/watermark-settings called with:", {
        userid,
        firmid,
        alwaysAdd,
    });

    const sql = `
    UPDATE WATERMARKS_DETAILS
    SET ALWAYS_ADD = ?
    WHERE USERID = ? AND FIRMID = ? AND STATUS = 'ACTIVE'
  `;

    console.log("📄 Executing SQL:", sql, "with params:", [
        alwaysAdd,
        userid,
        firmid,
    ]);

    connection_trn.query(sql, [alwaysAdd, userid, firmid], (err, result) => {
        if (err) {
            console.error("❌ DB Error in POST /api/watermark-settings:", err);
            return res.status(500).send("Database error");
        }
        console.log("✅ Update result:", result);

        res.json({ success: true, updated: result.affectedRows });
    });
});

// ------------------ SEARCH SUBCATEGORIES ------------------
app.get("/registration/usercategory/search", (req, res) => {
    const { term } = req.query;

    if (!term || term.trim().length < 2) {
        return res.status(400).json({
            error: "Search term is required and must be at least 2 characters long",
        });
    }

    const query = `
    SELECT 
      ID AS value, 
      SUB_CATEGORY AS label, 
      MAIN_CATEGORY
    FROM KF_CATEGORY
    WHERE STATUS = 'ACTIVE' 
      AND SUB_CATEGORY LIKE ?
    ORDER BY SUB_CATEGORY
    LIMIT 20
  `;

    connection_trn.query(query, [`%${term.trim()}%`], (error, results) => {
        if (error) {
            console.error("Database error (search):", error);
            return res.status(500).json({
                error: "Failed to search subcategories",
            });
        }
        res.status(200).json(results || []);
    });
});

// ------------------ GET MAIN CATEGORY (by sub) ------------------

app.get("/registration/maincategory/by-sub", (req, res) => {
    const { subCategoryId } = req.query;

    if (!subCategoryId) {
        return res.status(400).json({ error: "subCategoryId is required" });
    }

    const categoryId = parseInt(subCategoryId, 10);
    if (isNaN(categoryId)) {
        return res
            .status(400)
            .json({ error: "subCategoryId must be a number" });
    }

    const query = `
    SELECT MAIN_CATEGORY
    FROM KF_CATEGORY
    WHERE ID = ? AND STATUS = 'ACTIVE'
    LIMIT 1
  `;

    connection_trn.query(query, [categoryId], (error, results) => {
        if (error) {
            console.error("Database error (main by sub):", error);
            return res
                .status(500)
                .json({ error: "Failed to fetch main category" });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Return INT value, string label
        const main = {
            value: categoryId, // INT — used for CONTENT_CATEGORY_ID
            label: results[0].MAIN_CATEGORY || "Main Category",
        };
        res.status(200).json(main);
    });
});

/**
 * Universal LLM Caller
 */
async function callLLM(config, prompt) {
    const {
        LLM_PROVIDER,
        MODEL_NAME,
        MODEL_URL,
        API_KEY,
        MODEL_RESPONSE_VARIABLE,
    } = config;

    console.log("🟢 [callLLM] Starting call...");
    console.log("➡️ Provider:", LLM_PROVIDER);
    console.log("➡️ Model:", MODEL_NAME);
    console.log("➡️ Model URL:", MODEL_URL);
    console.log("➡️ Response Path:", MODEL_RESPONSE_VARIABLE);

    let payload = {};
    let headers = { "Content-Type": "application/json" };

    // if (!API_KEY) {
    //     console.error(`❌ Missing API key for provider: ${LLM_PROVIDER}`)
    //     const err = new Error("API key not configured")
    //     err.code = "API_KEY_MISSING"
    //     throw err
    // }

    if (LLM_PROVIDER.toUpperCase() !== "OLLAMA" && !API_KEY) {
        console.error(`❌ Missing API key for provider: ${LLM_PROVIDER}`);
        const err = new Error("API key not configured");
        err.code = "API_KEY_MISSING";
        throw err;
    }

    if (API_KEY) {
        headers["Authorization"] = `Bearer ${API_KEY}`;
        console.log("✅ API key attached in header");
    } else {
        console.log("⚠️ No API key provided");
    }

    if (LLM_PROVIDER === "OLLAMA") {
        payload = {
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
        };
        console.log(
            "📝 OLLAMA payload prepared:",
            JSON.stringify(payload, null, 2)
        );
    } else {
        payload = {
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        };
        console.log(
            "📝 Generic payload prepared:",
            JSON.stringify(payload, null, 2)
        );
    }

    console.log("🌍 Fetching:", MODEL_URL);
    // const response = await fetch(MODEL_URL, {
    //     method: "POST",
    //     headers,
    //     body: JSON.stringify(payload)
    // })

    // console.log("📡 Response status:", response.status, response.statusText);

    // if (!response.ok) {
    //     const errText = await response.text();
    //     console.error("❌ LLM API returned error body:", errText);
    //     throw new Error(`LLM API error: ${response.status} ${response.statusText}`)
    // }

    // const data = await response.json()

    // const response = await fetch(...)   <-- remove all fetch code

    try {
        const response = await axios.post(MODEL_URL, payload, { headers });
        console.log("📡 Response status:", response.status);

        const data = response.data;
        console.log("📦 Raw response JSON:", JSON.stringify(data, null, 2));

        const output = JSONPath({
            path: MODEL_RESPONSE_VARIABLE,
            json: data,
        });

        console.log("🔍 Extracted output:", output);
        return output?.[0] || "[No response text found]";
    } catch (err) {
        console.error("❌ LLM API error:", err.response?.data || err.message);
        throw err;
    }
}

app.post("/generate-summary", async (req, res) => {
    console.log("📩 Incoming request body:", req.body);

    try {
        const { userid, firmid, story, type } = req.body;
        if (!story) {
            console.warn("⚠️ Missing field: story");
            return res
                .status(400)
                .json({ error: "Missing required field: story" });
        }

        let appName = "SMP-SCHEDULER";
        console.log("🟢 Using appName:", appName);

        let prompt = `Summarize the following text in plain text without using numbered bullets or any special formatting. Summarize the text in plain English. The summary should be in English: ${story}`;
        console.log("📝 Final Prompt:", prompt);

        connection_trn.query(
            `SELECT * FROM API_KEY_MANAGER 
                WHERE APP_NAME = ? 
                    AND STATUS = 'ACTIVE'                     
                    AND BLOCKED = 'NO' 
                    AND LLM_PROVIDER_TYPE = 'TEXT-TO-TEXT'
                    AND (USERID = ? ) 
                    AND (FIRMID = ? )
                    AND ( ? = 'quick'  AND SPEED <= 3
                        OR ? = 'quality' AND SPEED > 3 )
                ORDER BY SPEED ASC 
                LIMIT 1`,
            [appName, userid || 0, firmid || 0, type, type],
            async (err, rows) => {
                console.log("🔍 DB Query Result:", rows);

                if (err) {
                    console.error("❌ DB Error:", err);
                    return res.status(500).json({ error: err.message });
                }

                // if (!rows.length) {
                //     console.warn("⚠️ No active LLM provider found");
                //     return res.status(404).json({ error: "No active LLM provider found" });
                // }

                if (!rows.length) {
                    console.warn("⚠️ No active LLM provider found");
                    return res.status(400).json({
                        error: "API_KEY_MISSING",
                        message:
                            "No active LLM provider configured. Please add one.",
                    });
                }

                const config = rows[0];
                console.log("⚙️ Selected Config:", config);

                try {
                    const responseText = await callLLM(config, prompt);
                    console.log("✅ Final LLM Response:", responseText);

                    res.type("text/plain").send(responseText);
                } catch (err) {
                    console.error("❌ LLM Call Error:", err);

                    if (err.code === "API_KEY_MISSING") {
                        return res.status(400).json({
                            error: "API_KEY_MISSING",
                            message: `Missing API key for provider: ${config.LLM_PROVIDER}`,
                        });
                    }

                    res.status(500).json({ error: err.message });
                }
            }
        );
    } catch (err) {
        console.error("❌ Route Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// fallback endpoint for slow server
app.post("/generate-summary-fallback", async (req, res) => {
    try {
        const { story, type } = req.body;
        if (!story) {
            return res.status(400).json({ error: "Missing story" });
        }

        let appName = "SMP-SCHEDULER";

        // 🔹 fetch fallback LLM config from DB
        connection_trn.query(
            `SELECT * FROM API_KEY_MANAGER 
                WHERE APP_NAME = ? 
                    AND STATUS = 'ACTIVE' 
                    AND BLOCKED = 'NO' 
                    AND LLM_PROVIDER_TYPE = 'TEXT-TO-TEXT'
                    AND (USERID = 0) 
                    AND (FIRMID = 0)
                    AND (
                        (? = 'quick' AND SPEED <= 3) 
                        OR (? = 'quality' AND SPEED > 3)
                    )
                ORDER BY SPEED ASC 
                LIMIT 1`,
            [appName, type, type], // 👈 binds
            async (err, rows) => {
                if (err) {
                    console.error("❌ DB Error:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                if (!rows || rows.length === 0) {
                    return res
                        .status(404)
                        .json({ error: "No fallback LLM config found" });
                }

                const row = rows[0];
                const config = {
                    LLM_PROVIDER: row.LLM_PROVIDER,
                    MODEL_NAME: row.MODEL_NAME,
                    MODEL_URL: row.MODEL_URL,
                    MODEL_RESPONSE_VARIABLE: row.MODEL_RESPONSE_VARIABLE,
                    API_KEY: row.API_KEY || "", // Ollama might not need this
                };

                const prompt = `Summarize in plain English: ${story}`;
                try {
                    const responseText = await callLLM(config, prompt);
                    res.type("text/plain").send(responseText);
                } catch (llmErr) {
                    console.error("❌ Fallback LLM Error:", llmErr);
                    res.status(500).json({ error: llmErr.message });
                }
            }
        );
    } catch (err) {
        console.error("❌ Fallback endpoint error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/socialmedia/schedulerplanner/check/inbranding", (req, res) => {
    const { firmid, userid } = req.body;

    // Validate input
    if (!firmid || !userid) {
        return res
            .status(400)
            .json({ error: "FIRM_ID and USERID are required" });
    }

    const QUERY = `
        SELECT 1 FROM vendor_social_acc_scheduler_planner
        WHERE STATUS = 'active'        
        AND FIRM_ID = ?
        AND USERID = ?
        LIMIT 1
    `;

    connection.query(QUERY, [firmid, userid], (err, results) => {
        if (err) {
            console.error("DB Error:", err);
            return res
                .status(500)
                .json({ error: "Database error", details: err });
        }

        if (results.length > 0) {
            res.json({ result: "YES" });
        } else {
            res.json({ result: "NO" });
        }
    });
});

// API Key
// async function getUserLLMClient(
//     userId,
//     firmId,
//     appName = "CRENTRY",
//     provider = "GROQ"
// ) {
//     return new Promise((resolve, reject) => {
//         const sql = `
//       SELECT API_KEY, MODEL_NAME, MODEL_URL, LLM_PROVIDER
//       FROM API_KEY_MANAGER
//       WHERE USERID = ? AND FIRMID = ? 
//         AND APP_NAME = ? 
//         AND LLM_PROVIDER = ? 
//         AND STATUS = 'ACTIVE' 
//         AND BLOCKED = 'NO'
//       ORDER BY ID DESC LIMIT 1
//     `;

//         connection_trn.query(
//             sql,
//             [userId, firmId, appName, provider],
//             (err, rows) => {
//                 if (err) return reject(err);

//                 if (rows && rows.length > 0) {
//                     const { API_KEY, MODEL_NAME, MODEL_URL, LLM_PROVIDER } =
//                         rows[0];
//                     let client;

//                     switch (LLM_PROVIDER) {
//                         case "GROQ":
//                             const Groq = require("groq-sdk");
//                             client = new Groq({ apiKey: API_KEY });
//                             break;
//                         case "OPENAI":
//                             const { OpenAI } = require("openai");
//                             client = new OpenAI({ apiKey: API_KEY });
//                             break;
//                         // Add other providers here if needed
//                         default:
//                             return reject(
//                                 new Error(
//                                     `LLM Provider ${LLM_PROVIDER} not supported`
//                                 )
//                             );
//                     }

//                     return resolve({
//                         client,
//                         model: MODEL_NAME,
//                         modelUrl: MODEL_URL,
//                         provider: LLM_PROVIDER,
//                     });
//                 }

//                 reject(
//                     new Error(
//                         "❌ No valid API key found in API_KEY_MANAGER for this user"
//                     )
//                 );
//             }
//         );
//     });
// }

// // Middleware to validate CR fields
// function validateCR(req, res, next) {
//     const {
//         task,
//         task_type,
//         project_id,
//         status,
//         start_time,
//         end_time,
//         br_dtls,
//         remarks,
//     } = req.body;

//     if (!task || !task.trim())
//         return res.status(400).json({ error: "Task is required" });
//     if (!task_type)
//         return res.status(400).json({ error: "Task type is required" });
//     if (!project_id)
//         return res.status(400).json({ error: "Project is required" });
//     if (!status) return res.status(400).json({ error: "Status is required" });
//     if (!start_time)
//         return res.status(400).json({ error: "Start time is required" });
//     if (!end_time)
//         return res.status(400).json({ error: "End time is required" });
//     if (!br_dtls) return res.status(400).json({ error: "br is required" });
//     if (!remarks) return res.status(400).json({ error: "remarks is required" });
//     //if (remarks && remarks.length > 50) return res.status(400).json({ error: "Remarks cannot exceed 50 characters" });

//     next();
// }

// //cr entry - business app
// app.post("/api/crentry", validateCR, (req, res) => {
//     const {
//         task,
//         emp_id,
//         emp_name,
//         task_type,
//         project_id,
//         remarks,
//         start_time,
//         end_time,
//         task_steps,
//         br_dtls,
//         status,
//         // ✅ NEW FIELDS
//         dev_updt_time,
//         dev_url_dtls,
//         qa_updt_time,
//         qa_url_dtls,
//         prod_updt_time,
//         prod_url_dtls,
//     } = req.body;

//     // ✅ NEW: Prevent CR creation without Employee ID or Name
//     if (!emp_id || !emp_name) {
//         console.warn("CR creation blocked — missing employee info:", {
//             emp_id,
//             emp_name,
//         });
//         return res.status(400).json({
//             error: "Employee ID or Name missing. Please log in again before submitting a CR.",
//         });
//     }
//     //

//     const insertQuery = `
//     INSERT INTO CR_TABLE 
//     (TASK, EMP_ID, EMP_NAME, TASK_TYPE, PROJECT_ID, REMARKS,
//      START_TIME, END_TIME, TASK_STEPS, BR_DTLS, STATUS,
//      DEV_UPDT_TIME, DEV_URL_DTLS, QA_UPDT_TIME, QA_URL_DTLS, PROD_UPDT_TIME, PROD_URL_DTLS)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;

//     const values = [
//         task,
//         emp_id,
//         emp_name,
//         task_type,
//         project_id,
//         remarks,
//         start_time,
//         end_time,
//         task_steps,
//         br_dtls,
//         status,
//         dev_updt_time,
//         dev_url_dtls,
//         qa_updt_time,
//         qa_url_dtls,
//         prod_updt_time,
//         prod_url_dtls,
//     ];

//     pmoConnection.query(insertQuery, values, (err, result) => {
//         if (err) {
//             console.error("Insert failed:", err);
//             return res
//                 .status(500)
//                 .json({ error: "Insert failed", details: err.message });
//         }

//         const insertedCID = result.insertId;

//         // Update CR_ID to match CID
//         const updateQuery = `UPDATE CR_TABLE SET CR_ID = ? WHERE CID = ?`;

//         pmoConnection.query(updateQuery, [insertedCID, insertedCID], (err2) => {
//             if (err2) {
//                 console.error("Failed to update CR_ID:", err2);
//                 return res.status(500).json({
//                     error: "CR_ID update failed",
//                     details: err2.message,
//                 });
//             }

//             return res
//                 .status(200)
//                 .json({ message: "CR Entry submitted", crid: insertedCID });
//         });
//     });
// });

// // Get CR entries with status Pending or In Progress for employee
// app.get("/api/existing-crs", (req, res) => {
//     const empId = req.query.empid;

//     if (!empId) {
//         return res.status(400).json({ error: "Missing empid" });
//     }

//     const query = `
//     SELECT CR_ID, TASK, PROJECT_ID, REMARKS, TASK_STEPS, BR_DTLS,
//            DEV_UPDT_TIME, DEV_URL_DTLS, QA_UPDT_TIME, QA_URL_DTLS, PROD_UPDT_TIME, PROD_URL_DTLS
//     FROM CR_TABLE  
//     WHERE EMP_ID = ? AND STATUS IN ('Pending', 'In Progress')
//   `;

//     pmoConnection.query(query, [empId], (err, result) => {
//         if (err) {
//             console.error("Error fetching existing CRs:", err);
//             return res
//                 .status(500)
//                 .json({ error: "Failed to fetch existing CRs" });
//         }
//         res.json(result);
//     });
// });

// // BR/TR
// app.get("/api/generate-docs/:crid", async (req, res) => {
//     try {
//         const { client: groq, model } = await getUserLLMClient(
//             req.headers["x-user-id"],
//             req.headers["x-firm-id"]
//         );

//         const crid = req.params.crid;

//         const query = `
//       SELECT T.TASK, T.REMARKS, T.TASK_STEPS, T.BR_DTLS, T.START_TIME, T.END_TIME, T.TASK_TYPE,
//              P.DESCRIPTION AS PROJECT_DESCRIPTION, 
//              P.PROJECT_ID, P.BR_DOC AS PROJECT_BR_DOC, P.TR_DOC AS PROJECT_TR_DOC
//       FROM CR_TABLE T
//       JOIN PROJECT P ON T.PROJECT_ID = P.PROJECT_ID
//       WHERE T.CR_ID = ?
//     `;

//         // ✅ Wrap query in Promise
//         const result = await new Promise((resolve, reject) => {
//             pmoConnection.query(query, [crid], (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows);
//             });
//         });

//         if (result.length === 0) {
//             return res.status(404).json({ error: "CR not found" });
//         }

//         const {
//             TASK,
//             REMARKS,
//             TASK_STEPS,
//             BR_DTLS,
//             PROJECT_DESCRIPTION,
//             PROJECT_ID,
//             PROJECT_BR_DOC,
//             PROJECT_TR_DOC,
//             TASK_TYPE,
//             START_TIME,
//             END_TIME,
//         } = result[0];

//         // ✅ Fetch latest history entry for this CRID
//         const historyQuery = `
//       SELECT UPDATEDBRDOC, UPDATEDTRDOC 
//       FROM PROJECTHISTORY 
//       WHERE CRID = ? 
//       ORDER BY TIMESTAMP DESC 
//       LIMIT 1
//     `;
//         const historyRows = await new Promise((resolve, reject) => {
//             pmoConnection.query(historyQuery, [crid], (hErr, hRes) => {
//                 if (hErr) return reject(hErr);
//                 resolve(hRes);
//             });
//         });

//         const existingHistoryBR =
//             historyRows.length > 0 ? historyRows[0].UPDATEDBRDOC : null;
//         const existingHistoryTR =
//             historyRows.length > 0 ? historyRows[0].UPDATEDTRDOC : null;

//         // --- Generate BR ---
//         const trim = (text, limit = 1000) =>
//             text && text.length > limit
//                 ? text.substring(0, limit) + "..."
//                 : text;
//         const brPrompt = `
//         You are a professional Business Analyst. Write a **one-page Business Requirement (BR) Document** 
//         for the following Change Request (CR).

//         📌 Project: ${PROJECT_DESCRIPTION}
//         📌 Existing Project BR (master): ${trim(PROJECT_BR_DOC)}
//         📌 Latest CR BR (if any): ${existingHistoryBR}
//         📌 CR Task: ${TASK}
//         📌 Remarks: ${REMARKS}
//         📌 Task Steps: ${TASK_STEPS}
//         📌 User Notes: ${BR_DTLS}

//         👉 The BR document must:  
//         - Focus only on this CR (self-contained one page).  
//         - Clearly describe the **business needs, goals, and expected value** of this CR.  
//         - Be **concise, structured, and professional**, suitable for management.  
//     `;

//         const brRes = await groq.chat.completions.create({
//             model: model,
//             messages: [
//                 {
//                     role: "system",
//                     content: "You are a professional BRD generator.",
//                 },
//                 { role: "user", content: brPrompt },
//             ],
//             temperature: 0.7,
//             max_tokens: 2048,
//         });

//         const brReport = brRes.choices?.[0]?.message?.content || "";

//         // --- Generate TR ---

//         const trPrompt = `
//         You are a technical architect. Write a clear, structured Technical Requirement (TR) Document
//       for the following Change Request (CR). using master tr_doc from project table

//       📌 Project: ${PROJECT_DESCRIPTION}
//       📌 Existing Project TR Document: ${trim(PROJECT_TR_DOC || "N/A")}
//       📌 Latest Project TR Document: ${existingHistoryTR || "N/A"}
//       📌 CR Task: ${TASK}
//       📌 Technical Steps: ${TASK_STEPS || "N\\A"}

//       👉 The TR document must:  
//         - Focus only on this CR (self-contained one page).  
//         - Clearly describe the **technical changes, impacts, and implementation details**.  
//         - Be **structured, detailed, and suitable for technical teams**.  
//     `;

//         const trRes = await groq.chat.completions.create({
//             model: model,
//             messages: [
//                 {
//                     role: "system",
//                     content: "You are a professional TRD generator.",
//                 },
//                 { role: "user", content: trPrompt },
//             ],
//             temperature: 0.7,
//             max_tokens: 2048,
//         });

//         const trReport = trRes.choices?.[0]?.message?.content || "";

//         // --- 🧠 New: Fetch past CRs to learn from actual duration ---
//         const pastCrQuery = `
//       SELECT START_TIME, END_TIME, ESTIMATE_HOURS
//       FROM CR_TABLE
//       WHERE PROJECT_ID = ? 
//         AND TASK_TYPE = ?
//         AND STATUS = 'Completed'
//         AND START_TIME IS NOT NULL
//         AND END_TIME IS NOT NULL
//       ORDER BY END_TIME DESC

//       LIMIT 5
//     `;
//         const pastCrRows = await new Promise((resolve, reject) => {
//             pmoConnection.query(
//                 pastCrQuery,
//                 [PROJECT_ID, TASK_TYPE],
//                 (err, rows) => {
//                     if (err) return reject(err);
//                     resolve(rows);
//                 }
//             );
//         });

//         let avgActual = null;
//         if (pastCrRows.length > 0) {
//             const actuals = pastCrRows
//                 .map((r) => {
//                     const start = new Date(r.START_TIME);
//                     const end = new Date(r.END_TIME);
//                     const diff = (end - start) / (1000 * 60 * 60); // hours
//                     return diff > 0 ? diff : null;
//                 })
//                 .filter(Boolean);

//             if (actuals.length > 0) {
//                 avgActual = Math.round(
//                     actuals.reduce((a, b) => a + b, 0) / actuals.length
//                 );
//             }
//         }

//         // --- Generate Estimate ---
//         // --- 🧮 Get total project hours logged this week ---
//         const projectLoadQuery = `
//   SELECT SUM(TIMESTAMPDIFF(HOUR, START_TIME, END_TIME)) AS total_hours
//   FROM CR_TABLE
//   WHERE PROJECT_ID = ?
//     AND START_TIME >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)
//     AND START_TIME < CURDATE();
// `;

//         const [projectLoadResult] = await new Promise((resolve, reject) => {
//             pmoConnection.query(projectLoadQuery, [PROJECT_ID], (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows);
//             });
//         });

//         const totalHoursThisWeek = projectLoadResult?.total_hours || 0;

//         const estPrompt = `
// You are an experienced **Project Estimation Analyst** specializing in software development effort forecasting.

// Your task is to output a **realistic total effort (in hours)** for completing this specific Change Request (CR).

// ### Priority Rules
// 1. If both Start Time and End Time are available → calculate the exact difference in hours (End - Start).  
//    - Example: 9:00 → 15:00 = 6 hours.  
//    - Use this as the base estimate (or adjust slightly ±1 hour if complexity suggests).  
// 2. If timestamps are missing → infer effort from:
//    - Task complexity (steps, remarks, BR/TR details).  
//    - Average time for similar CRs (${avgActual ? avgActual + " hours" : "No past data"
//             }).  
//    - Typical software effort patterns:  
//      - Documentation / Analysis → 2–6 hrs  
//      - Small Code Fix → 3–8 hrs  
//      - New Feature → 6–12 hrs  
//      - Major Enhancement → 12–40 hrs  
// 3. Consider current project load: this project already logged **${totalHoursThisWeek} hours** this week — avoid giving unrealistically high numbers for small CRs.
// 4. Never output estimates over 16 hours unless the CR clearly describes a major integration task.

// ### CR Data
// - Project: ${PROJECT_DESCRIPTION}
// - Task: ${TASK}
// - Task Type: ${TASK_TYPE}
// - Remarks: ${REMARKS || "N/A"}
// - Task Steps: ${TASK_STEPS || "N/A"}
// - BR Summary: ${brReport.slice(0, 400)}
// - TR Summary: ${trReport.slice(0, 400)}
// - Start Time: ${START_TIME || "N/A"}
// - End Time: ${END_TIME || "N/A"}

// ### Output Format (STRICT)
// Return only valid JSON:
// {
//   "estimateHours": <integer>
// }

// No text, no explanations, no extra content.
// `;

//         const estRes = await groq.chat.completions.create({
//             model: model,
//             messages: [
//                 {
//                     role: "system",
//                     content: "You are an expert project estimator.",
//                 },
//                 { role: "user", content: estPrompt },
//             ],
//             temperature: 0,
//             max_tokens: 100,
//         });

//         let rawEstimate = estRes.choices?.[0]?.message?.content?.trim();
//         let estimateHours = null;
//         try {
//             const raw = estRes.choices?.[0]?.message?.content?.trim() || "";
//             const parsed = JSON.parse(raw);
//             if (parsed && typeof parsed.estimateHours === "number") {
//                 estimateHours = parsed.estimateHours;
//             }
//         } catch {
//             const rawText = estRes.choices?.[0]?.message?.content?.trim() || "";
//             const numeric = parseInt(rawText.replace(/[^0-9]/g, ""), 10);
//             if (!isNaN(numeric)) estimateHours = numeric;
//         }

//         // 🔒 Safety cap for realism
//         if (estimateHours > 16) estimateHours = 16;
//         if (estimateHours < 1) estimateHours = 1;

//         if (isNaN(estimateHours)) estimateHours = null;

//         // --- Save to CR_TABLE ---
//         await new Promise((resolve, reject) => {
//             const updateSql = `UPDATE CR_TABLE SET BR_DOC = ?, TR_DOC = ?, ESTIMATE_HOURS = ?  WHERE CR_ID = ?`;
//             pmoConnection.query(
//                 updateSql,
//                 [brReport, trReport, estimateHours, crid],
//                 (uErr) => {
//                     if (uErr) return reject(uErr);
//                     resolve();
//                 }
//             );
//         });

//         // --- Store original Project BR/TR before first overwrite ---
//         const historyCheckSql = `
//       SELECT COUNT(*) AS cnt 
//       FROM PROJECTHISTORY 
//       WHERE PROJECT_ID = ?
//     `;
//         const historyCount = await new Promise((resolve, reject) => {
//             pmoConnection.query(historyCheckSql, [PROJECT_ID], (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows[0].cnt);
//             });
//         });

//         if (historyCount === 0) {
//             // fetch current original docs
//             const projectDocs = await new Promise((resolve, reject) => {
//                 pmoConnection.query(
//                     "SELECT BR_DOC, TR_DOC FROM PROJECT WHERE PROJECT_ID = ?",
//                     [PROJECT_ID],
//                     (err, rows) => {
//                         if (err) return reject(err);
//                         resolve(rows[0]);
//                     }
//                 );
//             });

//             await new Promise((resolve, reject) => {
//                 const insertOriginalSql = `
//           INSERT INTO PROJECTHISTORY (PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP)
//           VALUES (?, ?, ?, ?, NOW())
//         `;
//                 pmoConnection.query(
//                     insertOriginalSql,
//                     [
//                         PROJECT_ID,
//                         0,
//                         projectDocs.BR_DOC || "",
//                         projectDocs.TR_DOC || "",
//                     ],
//                     (err) => {
//                         if (err) return reject(err);
//                         resolve();
//                     }
//                 );
//             });
//         }

//         // Save generated docs to PROJECT table (append instead of overwrite)
//         await new Promise((resolve, reject) => {
//             const appendSql = `
//             UPDATE PROJECT
//             SET BR_DOC = CONCAT(COALESCE(BR_DOC, ''), '\\n\\n--- CR ${crid} Update ---\\n\\n', ?),
//                 TR_DOC = CONCAT(COALESCE(TR_DOC, ''), '\\n\\n--- CR ${crid} Update ---\\n\\n', ?),
//                 UPDATED_DATE = NOW()
//             WHERE PROJECT_ID = ?
//         `;
//             pmoConnection.query(
//                 appendSql,
//                 [brReport, trReport, PROJECT_ID],
//                 (pErr) => {
//                     if (pErr) return reject(pErr);
//                     resolve();
//                 }
//             );
//         });

//         // --- Save both BR + TR into PROJECTHISTORY ---
//         await new Promise((resolve, reject) => {
//             const insertHistorySql = `
//         INSERT INTO PROJECTHISTORY (PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP)
//         VALUES (?, ?, ?, ?, NOW())
//       `;
//             pmoConnection.query(
//                 insertHistorySql,
//                 [PROJECT_ID, crid, brReport, trReport],
//                 (hErr) => {
//                     if (hErr) return reject(hErr);
//                     resolve();
//                 }
//             );
//         });

//         console.log("Generated estimateHours:", estimateHours);
//         res.json({ brReport, trReport, estimateHours });
//     } catch (error) {
//         console.error("Groq API Error:", error);
//         res.status(500).json({ error: "Failed to generate BR/TR/Estimate" });
//     }
// });

// // Project History API
// app.get("/api/project/:projectId/history", (req, res) => {
//     const projectId = req.params.projectId;

//     const query = `
//     SELECT HISTORYID, PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP
//     FROM PROJECTHISTORY
//     WHERE PROJECT_ID = ?
//     ORDER BY \`TIMESTAMP\` DESC
//     `;

//     pmoConnection.query(query, [projectId], (err, rows) => {
//         if (err)
//             return res.status(500).json({ error: "Failed to fetch history" });
//         res.json(rows);
//     });
// });

// //added to display crid projecthistory
// app.get("/api/projecthistory/cr/:crid", (req, res) => {
//     const crid = req.params.crid;

//     const query = `
//     SELECT HISTORYID,PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP
//     FROM PROJECTHISTORY
//     WHERE CRID = ?
//     ORDER BY TIMESTAMP DESC
//   `;

//     pmoConnection.query(query, [crid], (err, rows) => {
//         if (err)
//             return res
//                 .status(500)
//                 .json({ error: "Failed to fetch CR history" });
//         res.json(rows);
//     });
// });

// // ✅ Get master BR/TR docs from PROJECT table
// app.get("/api/project/:projectId/master-docs", (req, res) => {
//     const projectId = req.params.projectId;

//     const query = `
//     SELECT BR_DOC, TR_DOC
//     FROM PROJECT
//     WHERE PROJECT_ID = ?
//   `;

//     pmoConnection.query(query, [projectId], (err, result) => {
//         if (err) return res.status(500).json({ error: "DB query failed" });
//         if (result.length === 0)
//             return res.status(404).json({ error: "Project not found" });

//         res.json({
//             masterBR: result[0].BR_DOC || "No BR document yet",
//             masterTR: result[0].TR_DOC || "No TR document yet",
//         });
//     });
// });

// // Update CR (status + br_dtls validation)
// app.put("/api/crentry/:crid", (req, res) => {
//     const crid = req.params.crid;
//     const {
//         status,
//         br_dtls,
//         task,
//         task_steps,
//         // ✅ NEW FIELDS
//         dev_updt_time,
//         dev_url_dtls,
//         qa_updt_time,
//         qa_url_dtls,
//         prod_updt_time,
//         prod_url_dtls,
//     } = req.body;

//     // Step 1: If status = Completed, validate BR_DOC exists
//     if (status === "Completed") {
//         const checkSql = `SELECT BR_DOC FROM CR_TABLE WHERE CR_ID = ?`;
//         pmoConnection.query(checkSql, [crid], (err, rows) => {
//             if (err)
//                 return res.status(500).json({ error: "Validation failed" });
//             if (!rows[0]?.BR_DOC) {
//                 return res.status(400).json({
//                     error: "BR Document is required before marking as Completed",
//                 });
//             }

//             // ✅ Update CR (safe since BR exists)
//             updateCR();
//         });
//     } else {
//         updateCR(); // ✅ No BR check if not Completed
//     }

//     function updateCR() {
//         const updateSql = `
//       UPDATE CR_TABLE
//       SET STATUS = ?, BR_DTLS = ?, TASK = ?, TASK_STEPS = ?,
//         DEV_UPDT_TIME = ?, DEV_URL_DTLS = ?, 
//           QA_UPDT_TIME = ?, QA_URL_DTLS = ?, 
//           PROD_UPDT_TIME = ?, PROD_URL_DTLS = ?
//       WHERE CR_ID = ?
//     `;
//         pmoConnection.query(
//             updateSql,
//             [
//                 status,
//                 br_dtls,
//                 task,
//                 task_steps,
//                 dev_updt_time,
//                 dev_url_dtls,
//                 qa_updt_time,
//                 qa_url_dtls,
//                 prod_updt_time,
//                 prod_url_dtls,
//                 crid,
//             ],
//             (err) => {
//                 if (err) {
//                     console.error("CR Entry Update Error:", err); // 👈 add this
//                     return res.status(500).json({
//                         error: "Failed to update CR entry",
//                         details: err.sqlMessage,
//                     });
//                 }
//                 res.json({ success: true });
//             }
//         );
//     }
// });

// // API - LLM
// app.post("/api/save-llm-details", (req, res) => {
//     const { userId, firmId, provider, modelName, apiKey, modelUrl } = req.body;

//     if (!userId || !firmId || !provider || !modelName || !apiKey) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     const insertQuery = `
//     INSERT INTO API_KEY_MANAGER 
//       (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, MODEL_URL, APP_NAME, API_KEY, STATUS, BLOCKED, INSRT_DTM)
//     VALUES (?, ?, ?, ?, ?, 'CRENTRY', ?, 'ACTIVE', 'NO', NOW())
//   `;

//     connection_trn.query(
//         insertQuery,
//         [userId, firmId, provider, modelName, modelUrl || "", apiKey],
//         (err, result) => {
//             if (err) {
//                 console.error("Failed to save LLM details:", err);
//                 return res
//                     .status(500)
//                     .json({ error: "Failed to save LLM details" });
//             }
//             res.json({ success: true, id: result.insertId });
//         }
//     );
// });

// // api key status -- 26-9-25
// // 1. Save a new key (makes old keys inactive automatically)
// app.post("/api/save-llm-key", async (req, res) => {
//     try {
//         const { userId, firmId, provider, model, apiKey } = req.body;

//         // Inactivate old keys for this user & app
//         await new Promise((resolve, reject) => {
//             connection_trn.query(
//                 `UPDATE API_KEY_MANAGER
//          SET STATUS='INACTIVE'
//          WHERE USERID=? AND APP_NAME='CRENTRY'`,
//                 [userId],
//                 (err) => (err ? reject(err) : resolve())
//             );
//         });

//         // Insert new key as ACTIVE
//         await new Promise((resolve, reject) => {
//             connection_trn.query(
//                 `INSERT INTO API_KEY_MANAGER
//           (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, APP_NAME, API_KEY, STATUS, SHOW_IN_UI, SPEED, INSRT_DTM)
//          VALUES (?, ?, ?, ?, 'CRENTRY', ?, 'ACTIVE', 'YES', 3, NOW())`,
//                 [userId, firmId, provider, model, apiKey],
//                 (err) => (err ? reject(err) : resolve())
//             );
//         });

//         res.json({
//             success: true,
//             message: "New key saved and old keys inactivated.",
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Failed to save LLM key" });
//     }
// });

// // 2. Fetch all keys for a user
// app.get("/api/user-keys/:userid", async (req, res) => {
//     const userId = req.params.userid;

//     const keys = await new Promise((resolve, reject) => {
//         connection_trn.query(
//             `SELECT ID, LLM_PROVIDER, MODEL_NAME, API_KEY, STATUS
//        FROM API_KEY_MANAGER
//        WHERE USERID=? AND APP_NAME='CRENTRY'`,
//             [userId],
//             (err, rows) => (err ? reject(err) : resolve(rows))
//         );
//     });

//     res.json(keys);
// });

// // 3. Toggle key status (ACTIVE ↔ INACTIVE)
// app.put("/api/toggle-key/:id", async (req, res) => {
//     const keyId = req.params.id;
//     const { newStatus } = req.body; // 'ACTIVE' or 'INACTIVE'

//     await new Promise((resolve, reject) => {
//         connection_trn.query(
//             `UPDATE API_KEY_MANAGER SET STATUS=? WHERE ID=?`,
//             [newStatus, keyId],
//             (err) => (err ? reject(err) : resolve())
//         );
//     });

//     res.json({ success: true });
// });

// // API - LLM
// app.post("/api/save-llm-details", (req, res) => {
//     const { userId, firmId, provider, modelName, apiKey, modelUrl } = req.body;

//     if (!userId || !firmId || !provider || !modelName || !apiKey) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     const insertQuery = `
//     INSERT INTO API_KEY_MANAGER 
//       (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, MODEL_URL, APP_NAME, API_KEY, STATUS, BLOCKED, INSRT_DTM)
//     VALUES (?, ?, ?, ?, ?, 'CRENTRY', ?, 'ACTIVE', 'NO', NOW())
//   `;

//     connection_trn.query(
//         insertQuery,
//         [userId, firmId, provider, modelName, modelUrl || "", apiKey],
//         (err, result) => {
//             if (err) {
//                 console.error("Failed to save LLM details:", err);
//                 return res
//                     .status(500)
//                     .json({ error: "Failed to save LLM details" });
//             }
//             res.json({ success: true, id: result.insertId });
//         }
//     );
// });

// // api key status -- 26-9-25
// // 1. Save a new key (makes old keys inactive automatically)
// app.post("/api/save-llm-key", async (req, res) => {
//     try {
//         const { userId, firmId, provider, model, apiKey } = req.body;

//         // Inactivate old keys for this user & app
//         await new Promise((resolve, reject) => {
//             connection_trn.query(
//                 `UPDATE API_KEY_MANAGER
//          SET STATUS='INACTIVE'
//          WHERE USERID=? AND APP_NAME='CRENTRY'`,
//                 [userId],
//                 (err) => (err ? reject(err) : resolve())
//             );
//         });

//         // Insert new key as ACTIVE
//         await new Promise((resolve, reject) => {
//             connection_trn.query(
//                 `INSERT INTO API_KEY_MANAGER
//           (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, APP_NAME, API_KEY, STATUS, SHOW_IN_UI, SPEED, INSRT_DTM)
//          VALUES (?, ?, ?, ?, 'CRENTRY', ?, 'ACTIVE', 'YES', 3, NOW())`,
//                 [userId, firmId, provider, model, apiKey],
//                 (err) => (err ? reject(err) : resolve())
//             );
//         });

//         res.json({
//             success: true,
//             message: "New key saved and old keys inactivated.",
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Failed to save LLM key" });
//     }
// });

// // 2. Fetch all keys for a user
// app.get("/api/user-keys/:userid", async (req, res) => {
//     const userId = req.params.userid;

//     const keys = await new Promise((resolve, reject) => {
//         connection_trn.query(
//             `SELECT ID, LLM_PROVIDER, MODEL_NAME, API_KEY, STATUS
//        FROM API_KEY_MANAGER
//        WHERE USERID=? AND APP_NAME='CRENTRY'`,
//             [userId],
//             (err, rows) => (err ? reject(err) : resolve(rows))
//         );
//     });

//     res.json(keys);
// });

// // 3. Toggle key status (ACTIVE ↔ INACTIVE)
// app.put("/api/toggle-key/:id", async (req, res) => {
//     const keyId = req.params.id;
//     const { newStatus } = req.body; // 'ACTIVE' or 'INACTIVE'

//     await new Promise((resolve, reject) => {
//         connection_trn.query(
//             `UPDATE API_KEY_MANAGER SET STATUS=? WHERE ID=?`,
//             [newStatus, keyId],
//             (err) => (err ? reject(err) : resolve())
//         );
//     });

//     res.json({ success: true });
// });


app.post("/api/ranking/years", (req, res) => {
    const { port1 } = req.body;
    if (!port1) {
        return res.status(400).json({ error: "portalid is required" });
    }

    const query = `
    SELECT CATEGORY, DISPLAY_NAME
    FROM RANKING_BY_PORTAL
    WHERE PORTAL_ID = ? AND STATUS = 'ACTIVE'
    ORDER BY DISPLAY_ORDER ASC
`;

    connection.query(query, [port1], (error, results) => {
        if (error) {
            console.error("Database query error:", error);
            return res.status(500).json({ error: "Database error" });
        }

        const data = results.map((row) => {
            const yearMatch = row.DISPLAY_NAME.match(/\d{4}$/);
            return {
                category: row.CATEGORY,
                year: yearMatch ? yearMatch[0] : "",
            };
        });

        console.log("🔍 Ranking Years Data from RANKING_BY_PORTAL:", data);

        res.json({ data });
    });
});

app.post("/api/ranking/category-images", (req, res) => {
    const { categories } = req.body; // array of category names from frontend

    if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: "categories array is required" });
    }

    const query = `
    SELECT CATEGORY, IMAGE_PATH
    FROM RANKING_TX_CATEGORY_IMAGES
    WHERE CATEGORY IN (?)
  `;

    connection.query(query, [categories], (error, results) => {
        if (error) {
            console.error("Database query error:", error);
            return res.status(500).json({ error: "Database error" });
        }

        // return as dictionary { category: imagePath }
        const imageMap = {};
        results.forEach((row) => {
            imageMap[row.CATEGORY] = row.IMAGE_PATH;
        });

        res.json({ imageMap });
    });
});

app.get("/proxy-image", async (req, res) => {
    const imageUrl = req.query.url;
    try {
        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
        });
        res.set("Content-Type", response.headers["content-type"]);
        res.send(response.data);
    } catch (error) {
        console.error("Error fetching image:", error);
        res.status(500).send("Error fetching image");
    }
});





app.post("/upload-reel", (req, res) => {
    const { page_id, access_token, video_url, Message } = req.body;

    if (!page_id || !access_token || !video_url) {
        return res.status(400).json({ error: "Missing fields" });
    }

    // Call python script
    const py = spawn("python3.7", [
        "/home/rafalin/python_files/smp/post_reel_facebook.py", // your python file name
        page_id,
        access_token,
        video_url,
        Message
    ]);

    let output = "";

    // capture ONLY final output (video_id)
    py.stdout.on("data", (data) => {
        output += data.toString();
    });

    // print logs (does NOT go to API response)
    py.stderr.on("data", (data) => {
        console.log("PYTHON LOG:", data.toString());
    });

    py.on("close", () => {
        console.log("FINAL VIDEO ID:", output);
        return res.json({ video_id: output });
    });
});







const storage_video = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log("📩 Multer destination - body:", req.body);

        // Fallback if no finalpath passed
        const finalPath = req.body.finalpath || "MyB_App/default";

        const dest = path.join(process.env.IMAGE_DEST_BASE, finalPath);

        // Ensure directory exists
        fs.mkdirSync(dest, { recursive: true });

        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const extname = path.extname(file.originalname);
        const uniqueSuffix = Math.round(Math.random() * 1e9);

        let prefix = "file"; // fallback
        if (file.mimetype.startsWith("image/")) prefix = "image";
        if (file.mimetype.startsWith("audio/")) prefix = "audio";

        const filename = `${prefix}-${uniqueSuffix}_${today}${extname}`;
        cb(null, filename);
    },
});
const upload_video = multer({ storage: storage_video }).fields([
    { name: "images", maxCount: 20 },
    { name: "audio", maxCount: 1 },
]);
const execAsync = util.promisify(exec);
app.post("/generate-video", (req, res) => {
    upload_video(req, res, async function (err) {
        if (err) {
            console.error("❌ Multer error:", err);
            return res.status(500).json({ success: false, message: "File upload failed" });
        }

        try {
            console.log("📥 Incoming request body:", req.body);
            console.log("📂 Uploaded files:", req.files);

            const { story, userid: rawUserId, portalid, category, transitionStyle, videoFormat, audioPrompt } = req.body;

            // Normalize userId & category strings
            const userid = String(rawUserId || "unknown");
            const safeCategory = String(category || "uncategorized");

            // Collect image file paths from multer uploaded files
            const imageFiles = (req.files?.images || []).map(f => String(f.path));
            if (!imageFiles.length) {
                console.warn("⚠️ No images provided");
                return res.status(400).json({ success: false, message: "No images provided" });
            }
            console.log(`🖼️ Images received (${imageFiles.length}):`, imageFiles);

            // Ensure output folder exists
            const videoDir = path.join("public", "videos");
            //const videoDir = path.join(__dirname, "../public/videos");
            //const videoDir = path.resolve(__dirname, "..", "public", "videos");



            fs.mkdirSync(videoDir, { recursive: true });
            console.log("📁 Video output directory ensured:", videoDir);

            // --- 1. Handle audio ---
            const imgDuration = 3; // seconds per image (you can change)
            const transitionDuration = 1; // 1s transition
            const totalDuration = imageFiles.length * imgDuration; // approx (xfade reduces small overlap)
            console.log(`⏱️ Total approximate duration = ${totalDuration}s (${imgDuration}s per image)`);

            let audioPath;
            if (req.files?.audio && req.files.audio.length > 0) {
                audioPath = String(req.files.audio[0].path);
                console.log("🎵 Using uploaded audio file:", audioPath);
            } else if (audioPrompt && audioPrompt.trim() !== "") {
                // generate a simple sine audio placeholder (same as before)
                audioPath = path.join(videoDir, `generated_${Date.now()}.mp3`);
                const genCmd = `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=${Math.max(totalDuration, 1)}" "${audioPath}"`;
                console.log("🎼 Generating music from prompt (placeholder):", genCmd);
                await execAsync(genCmd);
                console.log("✅ Audio generated:", audioPath);
            } else {
                // silent audio with the right length
                audioPath = path.join(videoDir, `silent_${Date.now()}.mp3`);
                const silentCmd = `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${Math.max(totalDuration, 1)} "${audioPath}"`;
                console.log("🔇 Generating silent audio:", silentCmd);
                await execAsync(silentCmd);
                console.log("✅ Silent audio generated:", audioPath);
            }

            // --- 2. Decide format & codecs ---
            const format = String(videoFormat || "mp4").toLowerCase() === "webm" ? "webm" : "mp4";
            const isWebm = format === "webm";
            const videoFilename = `video_${Date.now()}.${format}`;
            const videoPath = path.join(videoDir, videoFilename);

            let vcodec = isWebm ? "libvpx-vp9" : "libx264";
            let acodec = isWebm ? "libopus" : "aac";
            let audioMap = isWebm ? "-c:a libopus" : "-c:a aac";

            console.log("🎬 Output:", videoPath, "format:", format, "vcodec:", vcodec, "acodec:", acodec);

            // --- 3. Build ffmpeg inputs and filter_complex for transitions using xfade ---
            // We'll create one -loop 1 -t <imgDuration> -i <img> per image
            // then chain them using xfade filters. For N images we need N inputs and N-1 xfade filters.

            // Build input args
            const inputImageArgs = imageFiles.map(img => `-loop 1 -t ${imgDuration} -i "${img}"`).join(" ");

            // We'll use 0-based labels for inputs: [0:v][1:v] ... xfade sequence
            // Build xfade chain
            const nb = imageFiles.length;

            // If only one image, no xfade needed: just scale and pad.
            let filterComplex = "";
            if (nb === 1) {
                // single image: scale and trim
                filterComplex = `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,format=yuv420p[v]`;
            } else {
                // create initial streams labels [0:v][1:v]...[n-1:v]
                // xfade requires the offset for each subsequent transition: offset = (imgDuration - transitionDuration) + (i-1)*(imgDuration - transitionDuration)
                // We'll chain xfade filters producing intermediate results v0, v1, ...
                let xfadeFilters = [];
                // start: first pair [0:v][1:v] -> vf0
                // For i-th xfade (i from 1 to nb-1):
                // offset = (imgDuration - transitionDuration) * i
                for (let i = 1; i < nb; i++) {
                    const offset = (imgDuration - transitionDuration) * i;
                    // determine left input label and right input label for this step
                    // first step: left=[0:v], right=[1:v] -> result label "xf0"
                    // next step: left=[xf0], right=[2:v] -> "xf1" etc.
                    const leftLabel = i === 1 ? `[0:v]` : `[xf${i - 2}]`;
                    const rightLabel = `[${i}:v]`;
                    const outLabel = `[xf${i - 1}]`;
                    // choose transition type mapping:
                    let xfadeType = "fade"; // default crossfade style
                    if (transitionStyle === "fade" || transitionStyle === "dissolve") xfadeType = "fade";
                    else if (transitionStyle === "slide") xfadeType = "slideleft"; // slideleft is available in modern ffmpeg builds
                    else if (transitionStyle === "zoom") xfadeType = "fade"; // zoom will be simulated by adding slight zoompan on each input (see below)
                    // xfade args: transition=<type>:duration=<transitionDuration>:offset=<offset>
                    xfadeFilters.push(`${leftLabel}${rightLabel}xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${offset}${outLabel}`);
                }

                // If zoom requested, we want to apply a small zoompan to each input before xfade.
                let preScaleAndZoom = "";
                if (transitionStyle === "zoom") {
                    // apply a small zoompan to each input stream before xfade
                    // We'll map each input [i:v] -> [zi{i}] with zoompan that slowly zooms within duration
                    let zooms = [];
                    for (let i = 0; i < nb; i++) {
                        // zoompan parameters produce a slight zoom from 1 to 1.08 across frames.
                        // Use default framerate 30.
                        zooms.push(`[${i}:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,zoompan=z='min(1.08,zoom+0.0008)':d=${Math.floor(imgDuration * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'[z${i}]`);
                    }
                    preScaleAndZoom = zooms.join(";");
                    // then replace xfade inputs to use [z{i}] instead of [i:v]
                    for (let i = 0; i < xfadeFilters.length; i++) {
                        xfadeFilters[i] = xfadeFilters[i].replace(/\[(\d+):v\]/g, (m, n) => `[z${n}]`).replace(/\[xf(\d+)\]/g, (m, n) => `[xf${n}]`);
                    }
                    // but first left label of first pair was [0:v] — we've replaced all `[<n>:v]` occurrences.
                }

                // wrap the xfade filters sequence into one filterComplex string
                filterComplex = (preScaleAndZoom ? preScaleAndZoom + ";" : "") + xfadeFilters.join(";");
                // final output label is last xfade output: [xf{nb-2}] (since there are nb-1 xfades)
                filterComplex += `;[xf${nb - 2}]format=yuv420p[v]`;
            }

            console.log("🔧 Constructed filter_complex:\n", filterComplex);

            // Build final ffmpeg command string
            // Note: We use -shortest so audio won't extend beyond video and vice versa
            // Map the final video label [v] and the first audio input (last param -i audio) -> audio index will be nb (since nb images inputs)
            const ffmpegCmd = [
                "ffmpeg -y",
                // image inputs
                inputImageArgs,
                // audio input
                `-i "${audioPath}"`,
                // map and codecs
                `-filter_complex "${filterComplex}"`,
                `-map "[v]"`,
                `-map ${nb}:a`,
                // video codec and quality settings
                isWebm
                    ? `-c:v ${vcodec} -b:v 2M -crf 30 -g 300 -cpu-used 4`
                    : `-c:v ${vcodec} -preset veryfast -crf 23`,
                // audio codec: use libopus for webm, aac for mp4
                audioMap,
                // framerate and pixel format & shortest
                `-r 30 -pix_fmt yuv420p -shortest`,
                // output file
                `"${videoPath}"`
            ].join(" ");

            console.log("⚡ Running ffmpeg command:\n", ffmpegCmd);

            // Run ffmpeg
            const { stdout, stderr } = await execAsync(ffmpegCmd, { maxBuffer: 1024 * 1024 * 50 });
            console.log("✅ ffmpeg finished. stdout length:", (stdout || "").length);
            if (stderr) console.log("ffmpeg stderr (trim):", String(stderr).slice(0, 2000));

            const relativePath = `/videos/${path.basename(videoPath)}`;
            const fullUrl = `http://myblocks.in${relativePath}`;

            // Insert into DB (as before)
            const query = `
          INSERT INTO image_upload (video, category, story, userid, portalid, DATE)
          VALUES (?,?,?,?,?,NOW())
        `;
            console.log("💾 Inserting into DB:", query);
            console.log("➡️ Values:", [fullUrl, category, story, userid, portalid]);

            connection.query(query, [fullUrl, category, story, userid, portalid]);

            const videoUrl = fullUrl;
            console.log("✅ Returning response with videoUrl:", videoUrl);

            return res.json({
                success: true,
                videoUrl,
            });
        } catch (err) {
            console.error("❌ Unexpected error in /generate-video:", err);
            // If err has stdout/stderr info, include a short snippet
            return res.status(500).json({
                success: false,
                message: "Error generating video",
                details: err.message || err,
            });
        }
    });
});




//updated - 22-9-25
async function getUserLLMClient(userId, firmId, appName = 'CRENTRY', provider = 'GROQ') {
    return new Promise((resolve, reject) => {
        const sql = `
      SELECT API_KEY, MODEL_NAME, MODEL_URL, LLM_PROVIDER
      FROM API_KEY_MANAGER
      WHERE USERID = ? AND FIRMID = ? 
        AND APP_NAME = ? 
        AND LLM_PROVIDER = ? 
        AND STATUS = 'ACTIVE' 
        AND BLOCKED = 'NO'
      ORDER BY ID DESC LIMIT 1
    `;

        connection_trn.query(sql, [userId, firmId, appName, provider], (err, rows) => {
            if (err) return reject(err);

            if (rows && rows.length > 0) {
                const { API_KEY, MODEL_NAME, MODEL_URL, LLM_PROVIDER } = rows[0];
                let client;

                switch (LLM_PROVIDER) {
                    case 'GROQ':
                        const Groq = require('groq-sdk');
                        client = new Groq({ apiKey: API_KEY });
                        break;
                    case 'OPENAI':
                        const { OpenAI } = require('openai');
                        client = new OpenAI({ apiKey: API_KEY });
                        break;
                    // Add other providers here if needed
                    default:
                        return reject(new Error(`LLM Provider ${LLM_PROVIDER} not supported`));
                }

                return resolve({ client, model: MODEL_NAME, modelUrl: MODEL_URL, provider: LLM_PROVIDER });
            }

            reject(new Error("❌ No valid API key found in API_KEY_MANAGER for this user"));
        });
    });
}

//crentry page
//12-08-25
// Middleware to validate CR fields
// function validateCR(req, res, next) {
//   const { task, task_type, project_id, status, start_time, end_time, br_dtls, remarks } = req.body;

//   if (!task || !task.trim()) return res.status(400).json({ error: "Task is required" });
//   if (!task_type) return res.status(400).json({ error: "Task type is required" });
//   if (!project_id) return res.status(400).json({ error: "Project is required" });
//   if (!status) return res.status(400).json({ error: "Status is required" });
//   if (!start_time) return res.status(400).json({ error: "Start time is required" });
//   if (!end_time) return res.status(400).json({ error: "End time is required" });
//   if (!br_dtls) return res.status(400).json({ error: "br is required" });
//   if (!remarks) return res.status(400).json({ error: "remarks is required" });
//   //if (remarks && remarks.length > 50) return res.status(400).json({ error: "Remarks cannot exceed 50 characters" });

//   next();
// }
// //25-07
// //cr entry - business app
// app.post('/api/crentry', validateCR, (req, res) => {
//   const {
//     task, emp_id, emp_name, task_type,
//     project_id, remarks, start_time, end_time,
//     task_steps, br_dtls, status,
//      // ✅ NEW FIELDS
//     dev_updt_time, dev_url_dtls,
//     qa_updt_time, qa_url_dtls,
//     prod_updt_time, prod_url_dtls
//   } = req.body;

//   // ✅ NEW: Prevent CR creation without Employee ID or Name
//   if (!emp_id || !emp_name) {
//     console.warn("CR creation blocked — missing employee info:", { emp_id, emp_name });
//     return res.status(400).json({ 
//       error: "Employee ID or Name missing. Please log in again before submitting a CR." 
//     });
//   }
//   //

//   const insertQuery = `
//     INSERT INTO CR_TABLE 
//     (TASK, EMP_ID, EMP_NAME, TASK_TYPE, PROJECT_ID, REMARKS,
//      START_TIME, END_TIME, TASK_STEPS, BR_DTLS, STATUS,
//      DEV_UPDT_TIME, DEV_URL_DTLS, QA_UPDT_TIME, QA_URL_DTLS, PROD_UPDT_TIME, PROD_URL_DTLS)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;

//   const values = [
//     task, emp_id, emp_name, task_type,
//     project_id, remarks, start_time, end_time,
//     task_steps, br_dtls, status,
//     dev_updt_time || null,
//     dev_url_dtls || null,
//     qa_updt_time || null,
//     qa_url_dtls || null,
//     prod_updt_time || null,
//     prod_url_dtls || null
//   ];

//   pmoConnection.query(insertQuery, values, (err, result) => {
//     if (err) {
//       console.error('Insert failed:', err);
//       return res.status(500).json({ error: 'Insert failed', details: err.message });
//     }

//     const insertedCID = result.insertId;

//     // Update CR_ID to match CID
//     const updateQuery = `UPDATE CR_TABLE SET CR_ID = ? WHERE CID = ?`;

//     pmoConnection.query(updateQuery, [insertedCID, insertedCID], (err2) => {
//       if (err2) {
//         console.error('Failed to update CR_ID:', err2);
//         return res.status(500).json({ error: 'CR_ID update failed', details: err2.message  });
//       }

//       return res.status(200).json({ message: 'CR Entry submitted', crid: insertedCID });
//     });
//   });
// });


// // Get CR entries with status Pending or In Progress for employee
// app.get('/api/existing-crs', (req, res) => {
//   const empId = req.query.empid;

//   if (!empId) {
//     return res.status(400).json({ error: 'Missing empid' });
//   }

//   const query = `
//     SELECT CR_ID, TASK, PROJECT_ID, REMARKS, TASK_STEPS, BR_DTLS,
//            DEV_UPDT_TIME, DEV_URL_DTLS, QA_UPDT_TIME, QA_URL_DTLS, PROD_UPDT_TIME, PROD_URL_DTLS
//     FROM CR_TABLE  
//     WHERE EMP_ID = ? AND STATUS IN ('Pending', 'In Progress')
//   `;

//   pmoConnection.query(query, [empId], (err, result) => {
//     if (err) {
//       console.error('Error fetching existing CRs:', err);
//       return res.status(500).json({ error: 'Failed to fetch existing CRs' });
//     }
//     res.json(result);
//   });
// });

// //updated - 3-10-25 - estimation update
// app.get("/api/generate-docs/:crid", async (req, res) => {
//   try {
//     const { client: groq, model } = await getUserLLMClient(
//       req.headers["x-user-id"],
//       req.headers["x-firm-id"]
//     );

//     const crid = req.params.crid;

//     const query = `
//       SELECT T.TASK, T.REMARKS, T.TASK_STEPS, T.BR_DTLS, T.START_TIME, T.END_TIME, T.TASK_TYPE,
//              P.DESCRIPTION AS PROJECT_DESCRIPTION, 
//              P.PROJECT_ID, P.BR_DOC AS PROJECT_BR_DOC, P.TR_DOC AS PROJECT_TR_DOC
//       FROM CR_TABLE T
//       JOIN PROJECT P ON T.PROJECT_ID = P.PROJECT_ID
//       WHERE T.CR_ID = ?
//     `;

//     // ✅ Wrap query in Promise
//     const result = await new Promise((resolve, reject) => {
//       pmoConnection.query(query, [crid], (err, rows) => {
//         if (err) return reject(err);
//         resolve(rows);
//       });
//     });

//     if (result.length === 0) {
//       return res.status(404).json({ error: "CR not found" });
//     }

//     const {
//       TASK,
//       REMARKS,
//       TASK_STEPS,
//       BR_DTLS,
//       PROJECT_DESCRIPTION,
//       PROJECT_ID,
//       PROJECT_BR_DOC,
//       PROJECT_TR_DOC,
//       TASK_TYPE,
//       START_TIME,
//       END_TIME,
//     } = result[0];

//     // ✅ Fetch latest history entry for this CRID
//     const historyQuery = `
//       SELECT UPDATEDBRDOC, UPDATEDTRDOC 
//       FROM PROJECTHISTORY 
//       WHERE CRID = ? 
//       ORDER BY TIMESTAMP DESC 
//       LIMIT 1
//     `;
//     const historyRows = await new Promise((resolve, reject) => {
//       pmoConnection.query(historyQuery, [crid], (hErr, hRes) => {
//         if (hErr) return reject(hErr);
//         resolve(hRes);
//       });
//     });

//     const existingHistoryBR =
//       historyRows.length > 0 ? historyRows[0].UPDATEDBRDOC : null;
//     const existingHistoryTR =
//       historyRows.length > 0 ? historyRows[0].UPDATEDTRDOC : null;

//     // --- Generate BR ---
//     const trim = (text, limit = 1000) =>
//   text && text.length > limit ? text.substring(0, limit) + "..." : text; 
//     const brPrompt = `
//         You are a professional Business Analyst. Write a **one-page Business Requirement (BR) Document** 
//         for the following Change Request (CR).

//         📌 Project: ${PROJECT_DESCRIPTION}
//         📌 Existing Project BR (master): ${trim(PROJECT_BR_DOC)}
//         📌 Latest CR BR (if any): ${existingHistoryBR}
//         📌 CR Task: ${TASK}
//         📌 Remarks: ${REMARKS}
//         📌 Task Steps: ${TASK_STEPS}
//         📌 User Notes: ${BR_DTLS}

//         👉 The BR document must:  
//         - Focus only on this CR (self-contained one page).  
//         - Clearly describe the **business needs, goals, and expected value** of this CR.  
//         - Be **concise, structured, and professional**, suitable for management.  
//     `;

//     const brRes = await groq.chat.completions.create({
//       model: model,
//       messages: [
//         { role: "system", content: "You are a professional BRD generator." },
//         { role: "user", content: brPrompt },
//       ],
//       temperature: 0.7,
//       max_tokens: 2048,
//     });

//     const brReport = brRes.choices?.[0]?.message?.content || "";

//     // --- Generate TR ---

//     const trPrompt = `
//         You are a technical architect. Write a clear, structured Technical Requirement (TR) Document
//       for the following Change Request (CR). using master tr_doc from project table

//       📌 Project: ${PROJECT_DESCRIPTION}
//       📌 Existing Project TR Document: ${trim(PROJECT_TR_DOC || 'N/A')}
//       📌 Latest Project TR Document: ${existingHistoryTR || 'N/A'}
//       📌 CR Task: ${TASK}
//       📌 Technical Steps: ${TASK_STEPS || 'N\\A'}

//       👉 The TR document must:  
//         - Focus only on this CR (self-contained one page).  
//         - Clearly describe the **technical changes, impacts, and implementation details**.  
//         - Be **structured, detailed, and suitable for technical teams**.  
//     `;

//     const trRes = await groq.chat.completions.create({
//       model: model,
//       messages: [
//         { role: "system", content: "You are a professional TRD generator." },
//         { role: "user", content: trPrompt },
//       ],
//       temperature: 0.7,
//       max_tokens: 2048,
//     });

//     const trReport = trRes.choices?.[0]?.message?.content || "";

//     // --- 🧠 New: Fetch past CRs to learn from actual duration ---
//     const pastCrQuery = `
//       SELECT START_TIME, END_TIME, ESTIMATE_HOURS
//       FROM CR_TABLE
//       WHERE PROJECT_ID = ? 
//         AND TASK_TYPE = ?
//         AND STATUS = 'Completed'
//         AND START_TIME IS NOT NULL
//         AND END_TIME IS NOT NULL
//       ORDER BY END_TIME DESC

//       LIMIT 5
//     `;
//     const pastCrRows = await new Promise((resolve, reject) => {
//       pmoConnection.query(pastCrQuery, [PROJECT_ID, TASK_TYPE], (err, rows) => {
//         if (err) return reject(err);
//         resolve(rows);
//       });
//     });

//     let avgActual = null;
//     if (pastCrRows.length > 0) {
//       const actuals = pastCrRows
//         .map((r) => {
//           const start = new Date(r.START_TIME);
//           const end = new Date(r.END_TIME);
//           const diff = (end - start) / (1000 * 60 * 60); // hours
//           return diff > 0 ? diff : null;
//         })
//         .filter(Boolean);

//       if (actuals.length > 0) {
//         avgActual = Math.round(actuals.reduce((a, b) => a + b, 0) / actuals.length);
//       }
//     }

//     // --- Generate Estimate ---
//     // --- 🧮 Get total project hours logged this week ---
// const projectLoadQuery = `
//   SELECT SUM(TIMESTAMPDIFF(HOUR, START_TIME, END_TIME)) AS total_hours
//   FROM CR_TABLE
//   WHERE PROJECT_ID = ?
//     AND START_TIME >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)
//     AND START_TIME < CURDATE();
// `;

// const [projectLoadResult] = await new Promise((resolve, reject) => {
//   pmoConnection.query(projectLoadQuery, [PROJECT_ID], (err, rows) => {
//     if (err) return reject(err);
//     resolve(rows);
//   });
// });

// const totalHoursThisWeek = projectLoadResult?.total_hours || 0;

// const estPrompt = `
// You are an experienced **Project Estimation Analyst** specializing in software development effort forecasting.

// Your task is to output a **realistic total effort (in hours)** for completing this specific Change Request (CR).

// ### Priority Rules
// 1. If both Start Time and End Time are available → calculate the exact difference in hours (End - Start).  
//    - Example: 9:00 → 15:00 = 6 hours.  
//    - Use this as the base estimate (or adjust slightly ±1 hour if complexity suggests).  
// 2. If timestamps are missing → infer effort from:
//    - Task complexity (steps, remarks, BR/TR details).  
//    - Average time for similar CRs (${avgActual ? avgActual + " hours" : "No past data"}).  
//    - Typical software effort patterns:  
//      - Documentation / Analysis → 2–6 hrs  
//      - Small Code Fix → 3–8 hrs  
//      - New Feature → 6–10 hrs  
//      - Major Enhancement → 10–14 hrs  
// 3. Consider current project load: this project already logged **${totalHoursThisWeek} hours** this week — avoid giving unrealistically high numbers for small CRs.
// 4. Never output estimates over 12 hours unless the CR clearly describes a major integration task.

// ### CR Data
// - Project: ${PROJECT_DESCRIPTION}
// - Task: ${TASK}
// - Task Type: ${TASK_TYPE}
// - Remarks: ${REMARKS || "N/A"}
// - Task Steps: ${TASK_STEPS || "N/A"}
// - BR Summary: ${brReport.slice(0, 400)}
// - TR Summary: ${trReport.slice(0, 400)}
// - Start Time: ${START_TIME || "N/A"}
// - End Time: ${END_TIME || "N/A"}

// ### Output Format (STRICT)
// Return only valid JSON:
// {
//   "estimateHours": <integer>
// }

// No text, no explanations, no extra content.
// `;


// const estRes = await groq.chat.completions.create({
//       model: model,
//       messages: [
//         { role: "system", content: "You are an expert project estimator." },
//         { role: "user", content: estPrompt },
//       ],
//       temperature: 0,
//       max_tokens: 100,
//     });

//     let rawEstimate = estRes.choices?.[0]?.message?.content?.trim();
// let estimateHours = null;
// try {
//   const raw = estRes.choices?.[0]?.message?.content?.trim() || "";
//   const parsed = JSON.parse(raw);
//   if (parsed && typeof parsed.estimateHours === "number") {
//     estimateHours = parsed.estimateHours;
//   }
// } catch {
//   const rawText = estRes.choices?.[0]?.message?.content?.trim() || "";
//   const numeric = parseInt(rawText.replace(/[^0-9]/g, ""), 10);
//   if (!isNaN(numeric)) estimateHours = numeric;
// }

// // 🔒 Safety cap for realism
// if (estimateHours > 16) estimateHours = 16;
// if (estimateHours < 1) estimateHours = 1;

// if (isNaN(estimateHours)) estimateHours = null;



//     // --- Save to CR_TABLE ---
//     await new Promise((resolve, reject) => {
//       const updateSql = `UPDATE CR_TABLE SET BR_DOC = ?, TR_DOC = ?, ESTIMATE_HOURS = ?  WHERE CR_ID = ?`;
//       pmoConnection.query(updateSql, [brReport, trReport, estimateHours, crid], (uErr) => {
//         if (uErr) return reject(uErr);
//         resolve();
//       });
//     });

//     // --- Store original Project BR/TR before first overwrite ---
//     const historyCheckSql = `
//       SELECT COUNT(*) AS cnt 
//       FROM PROJECTHISTORY 
//       WHERE PROJECT_ID = ?
//     `;
//     const historyCount = await new Promise((resolve, reject) => {
//       pmoConnection.query(historyCheckSql, [PROJECT_ID], (err, rows) => {
//         if (err) return reject(err);
//         resolve(rows[0].cnt);
//       });
//     });

//     if (historyCount === 0) {
//       // fetch current original docs
//       const projectDocs = await new Promise((resolve, reject) => {
//         pmoConnection.query(
//           "SELECT BR_DOC, TR_DOC FROM PROJECT WHERE PROJECT_ID = ?",
//           [PROJECT_ID],
//           (err, rows) => {
//             if (err) return reject(err);
//             resolve(rows[0]);
//           }
//         );
//       });

//       await new Promise((resolve, reject) => {
//         const insertOriginalSql = `
//           INSERT INTO PROJECTHISTORY (PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP)
//           VALUES (?, ?, ?, ?, NOW())
//         `;
//         pmoConnection.query(
//           insertOriginalSql,
//           [PROJECT_ID, 0, projectDocs.BR_DOC || "", projectDocs.TR_DOC || ""],
//           (err) => {
//             if (err) return reject(err);
//             resolve();
//           }
//         );
//       });
//     }

//     // Save generated docs to PROJECT table (append instead of overwrite)
//     await new Promise((resolve, reject) => {
//       const appendSql = `
//             UPDATE PROJECT
//             SET BR_DOC = CONCAT(COALESCE(BR_DOC, ''), '\\n\\n--- CR ${crid} Update ---\\n\\n', ?),
//                 TR_DOC = CONCAT(COALESCE(TR_DOC, ''), '\\n\\n--- CR ${crid} Update ---\\n\\n', ?),
//                 UPDATED_DATE = NOW()
//             WHERE PROJECT_ID = ?
//         `;
//       pmoConnection.query(
//         appendSql,
//         [brReport, trReport, PROJECT_ID],
//         (pErr) => {
//           if (pErr) return reject(pErr);
//           resolve();
//         }
//       );
//     });

//     // --- Save both BR + TR into PROJECTHISTORY ---
//     await new Promise((resolve, reject) => {
//       const insertHistorySql = `
//         INSERT INTO PROJECTHISTORY (PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP)
//         VALUES (?, ?, ?, ?, NOW())
//       `;
//       pmoConnection.query(
//         insertHistorySql,
//         [PROJECT_ID, crid, brReport, trReport],
//         (hErr) => {
//           if (hErr) return reject(hErr);
//           resolve();
//         }
//       );
//     });

//     console.log("Generated estimateHours:", estimateHours);
// res.json({ brReport, trReport, estimateHours });

//   } catch (error) {
//     console.error("Groq API Error:", error);
//     res.status(500).json({ error: "Failed to generate BR/TR/Estimate" });
//   }
// });
// //
// // =======================
// // 📌 Project History API
// // =======================
// app.get("/api/project/:projectId/history", (req, res) => {
//   const projectId = req.params.projectId;

//     const query = `
//     SELECT HISTORYID, PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP
//     FROM PROJECTHISTORY
//     WHERE PROJECT_ID = ?
//     ORDER BY \`TIMESTAMP\` DESC
//     `;


//   pmoConnection.query(query, [projectId], (err, rows) => {
//     if (err) return res.status(500).json({ error: "Failed to fetch history" });
//     res.json(rows);
//   });
// });
// //

// //added to display crid projecthistory- 3-9-255
// app.get("/api/projecthistory/cr/:crid", (req, res) => {
//   const crid = req.params.crid;

//   const query = `
//     SELECT HISTORYID,PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP
//     FROM PROJECTHISTORY
//     WHERE CRID = ?
//     ORDER BY TIMESTAMP DESC
//   `;

//   pmoConnection.query(query, [crid], (err, rows) => {
//     if (err) return res.status(500).json({ error: "Failed to fetch CR history" });
//     res.json(rows);
//   });
// });

// //

// // ✅ Get master BR/TR docs from PROJECT table -
// app.get("/api/project/:projectId/master-docs", (req, res) => {
//   const projectId = req.params.projectId;

//   const query = `
//     SELECT BR_DOC, TR_DOC
//     FROM PROJECT
//     WHERE PROJECT_ID = ?
//   `;

//   pmoConnection.query(query, [projectId], (err, result) => {
//     if (err) return res.status(500).json({ error: "DB query failed" });
//     if (result.length === 0) return res.status(404).json({ error: "Project not found" });

//     res.json({
//       masterBR: result[0].BR_DOC || "No BR document yet",
//       masterTR: result[0].TR_DOC || "No TR document yet",
//     });
//   });
// });

// //
// /**
//  * Update CR (status + br_dtls validation)
//  */
// app.put("/api/crentry/:crid", (req, res) => {
//   const crid = req.params.crid;
//   const { status, br_dtls, task, task_steps,
//     // ✅ NEW FIELDS
//     dev_updt_time, dev_url_dtls,
//     qa_updt_time, qa_url_dtls,
//     prod_updt_time, prod_url_dtls
//    } = req.body;

//   // Step 1: If status = Completed, validate BR_DOC exists
//   if (status === "Completed") {
//     const checkSql = `SELECT BR_DOC FROM CR_TABLE WHERE CR_ID = ?`;
//     pmoConnection.query(checkSql, [crid], (err, rows) => {
//       if (err) return res.status(500).json({ error: "Validation failed" });
//       if (!rows[0]?.BR_DOC) {
//         return res
//           .status(400)
//           .json({ error: "BR Document is required before marking as Completed" });
//       }

//       // ✅ Update CR (safe since BR exists)
//       updateCR();
//     });
//   } else {
//     updateCR(); // ✅ No BR check if not Completed
//   }

//   function updateCR() {
//     const updateSql = `
//       UPDATE CR_TABLE
//       SET STATUS = ?, BR_DTLS = ?, TASK = ?, TASK_STEPS = ?,
//         DEV_UPDT_TIME = ?, DEV_URL_DTLS = ?, 
//           QA_UPDT_TIME = ?, QA_URL_DTLS = ?, 
//           PROD_UPDT_TIME = ?, PROD_URL_DTLS = ?
//       WHERE CR_ID = ?
//     `;
//     pmoConnection.query(
//     updateSql,
//     [
//       status,
//       br_dtls,
//       task,
//       task_steps,
//       dev_updt_time || null,
//       dev_url_dtls || null,
//       qa_updt_time || null,
//       qa_url_dtls || null,
//       prod_updt_time || null,
//       prod_url_dtls || null,
//       crid
//     ], (err) => {
//       if (err) {
//       console.error("CR Entry Update Error:", err);   // 👈 add this
//       return res.status(500).json({ error: "Failed to update CR entry", details: err.sqlMessage });
//     }
//      res.json({ success: true });
//     });
//   }
// });

// //updated -22-09-25 - api
// app.post("/api/save-llm-details", (req, res) => {
//   const { userId, firmId, provider, modelName, apiKey, modelUrl } = req.body;

//   if (!userId || !firmId || !provider || !modelName || !apiKey) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const insertQuery = `
//     INSERT INTO API_KEY_MANAGER 
//       (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, MODEL_URL, APP_NAME, API_KEY, STATUS, BLOCKED, INSRT_DTM)
//     VALUES (?, ?, ?, ?, ?, 'CRENTRY', ?, 'ACTIVE', 'NO', NOW())
//   `;

//   connection_trn.query(insertQuery, [userId, firmId, provider, modelName, modelUrl || '', apiKey], (err, result) => {
//     if (err) {
//       console.error("Failed to save LLM details:", err);
//       return res.status(500).json({ error: "Failed to save LLM details" });
//     }
//     res.json({ success: true, id: result.insertId });
//   });
// });

// // api key status -- 26-9-25
// // ===============================
// //  SAVE NEW LLM API KEY 
// //  (Supports multiple apps)
// // ===============================
// app.post("/api/save-llm-key", async (req, res) => {
//   try {
//     const { userId, firmId, provider, model, apiKey, appName } = req.body;

//     // Validate
//     if (!userId || !firmId || !provider || !model || !apiKey || !appName) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     // 1️⃣ Inactivate existing keys for this user & app
//     await new Promise((resolve, reject) => {
//       connection_trn.query(
//         `
//         UPDATE API_KEY_MANAGER
//         SET STATUS='INACTIVE'
//         WHERE USERID=? AND APP_NAME=?
//         `,
//         [userId, appName],
//         (err) => (err ? reject(err) : resolve())
//       );
//     });

//     // 2️⃣ Insert new ACTIVE key
//     await new Promise((resolve, reject) => {
//       connection_trn.query(
//         `
//         INSERT INTO API_KEY_MANAGER
//           (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, APP_NAME, API_KEY, STATUS, SHOW_IN_UI, SPEED, INSRT_DTM)
//         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'YES', 3, NOW())
//         `,
//         [userId, firmId, provider, model, appName, apiKey],
//         (err) => (err ? reject(err) : resolve())
//       );
//     });

//     return res.json({
//       success: true,
//       message: `New key saved for ${appName}, previous keys deactivated.`,
//     });
//   } catch (err) {
//     console.error("❌ Save LLM Key Error:", err);
//     return res.status(500).json({ error: "Failed to save LLM key" });
//   }
// });

// // ===============================
// //  FETCH KEYS FOR USER + APP NAME
// // ===============================
// app.get("/api/user-keys/:userid/:appName", async (req, res) => {
//   const { userid, appName } = req.params;

//   try {
//     const keys = await new Promise((resolve, reject) => {
//       connection_trn.query(
//         `
//         SELECT ID, LLM_PROVIDER, MODEL_NAME, API_KEY, STATUS
//         FROM API_KEY_MANAGER
//         WHERE USERID=? AND APP_NAME=?
//         ORDER BY ID DESC
//         `,
//         [userid, appName],
//         (err, rows) => (err ? reject(err) : resolve(rows))
//       );
//     });

//     return res.json(keys);
//   } catch (err) {
//     console.error("❌ Fetch Keys Error:", err);
//     return res.status(500).json({ error: "Failed to load keys" });
//   }
// });

// // ===============================
// //  TOGGLE KEY (ACTIVE / INACTIVE)
// // ===============================
// app.put("/api/toggle-key/:id", async (req, res) => {
//   const keyId = req.params.id;
//   const { newStatus } = req.body;

//   try {
//     await new Promise((resolve, reject) => {
//       connection_trn.query(
//         `UPDATE API_KEY_MANAGER SET STATUS=? WHERE ID=?`,
//         [newStatus, keyId],
//         (err) => (err ? reject(err) : resolve())
//       );
//     });

//     return res.json({ success: true, message: "Status updated" });
//   } catch (err) {
//     console.error("❌ Toggle Key Error:", err);
//     return res.status(500).json({ error: "Failed to update key status" });
//   }
// });


// //
// Middleware to validate CR fields
function validateCR(req, res, next) {
    const { task, task_type, task_size, story_points, project_id, status, start_time, end_time, br_dtls, remarks } = req.body;

    if (!task || !task.trim()) return res.status(400).json({ error: "Task is required" });
    if (!task_type) return res.status(400).json({ error: "Task type is required" });
    if (!project_id) return res.status(400).json({ error: "Project is required" });
    if (!status) return res.status(400).json({ error: "Status is required" });
    if (!start_time) return res.status(400).json({ error: "Start time is required" });
    if (!end_time) return res.status(400).json({ error: "End time is required" });
    if (!br_dtls) return res.status(400).json({ error: "br is required" });
    if (!remarks) return res.status(400).json({ error: "remarks is required" });
    if (!task_size) {
        return res.status(400).json({ error: "Task size is required" });
    }
    if (!story_points) {
        return res.status(400).json({ error: "Story points is required" });
    }

    // ✅ STORY POINTS VALIDATION (THIS IS THE ANSWER)
    const allowedPoints = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (!story_points) {
        return res.status(400).json({ error: "Story points is required" });
    }
    if (!allowedPoints.includes(Number(story_points))) {
        return res.status(400).json({ error: "Invalid story points" });
    }

    //if (remarks && remarks.length > 50) return res.status(400).json({ error: "Remarks cannot exceed 50 characters" });

    next();
}
//25-07
//cr entry - business app
app.post('/api/crentry', validateCR, (req, res) => {
    const {
        task, emp_id, emp_name, task_type, task_size, story_points,
        project_id, remarks, start_time, end_time,
        task_steps, br_dtls, status,
        // ✅ NEW FIELDS
        dev_updt_time, dev_url_dtls,
        qa_updt_time, qa_url_dtls,
        prod_updt_time, prod_url_dtls
    } = req.body;

    // ✅ NEW: Prevent CR creation without Employee ID or Name
    if (!emp_id || !emp_name) {
        console.warn("CR creation blocked — missing employee info:", { emp_id, emp_name });
        return res.status(400).json({
            error: "Employee ID or Name missing. Please log in again before submitting a CR."
        });
    }
    //

    const insertQuery = `
    INSERT INTO CR_TABLE 
    (TASK, EMP_ID, EMP_NAME, TASK_TYPE, TASK_SIZE, PROJECT_ID, REMARKS, STORY_POINTS,
     START_TIME, END_TIME, TASK_STEPS, BR_DTLS, STATUS,
     DEV_UPDT_TIME, DEV_URL_DTLS, QA_UPDT_TIME, QA_URL_DTLS, PROD_UPDT_TIME, PROD_URL_DTLS)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const values = [
        task,                 // TASK
        emp_id,               // EMP_ID
        emp_name,             // EMP_NAME
        task_type,            // TASK_TYPE
        task_size,            // TASK_SIZE
        project_id,           // PROJECT_ID
        remarks,              // REMARKS
        Number(story_points), // STORY_POINTS  ✅ THIS FIXES YOUR ERROR
        start_time,           // START_TIME
        end_time,             // END_TIME
        task_steps,           // TASK_STEPS
        br_dtls,              // BR_DTLS
        status,               // STATUS
        dev_updt_time || null,
        dev_url_dtls || null,
        qa_updt_time || null,
        qa_url_dtls || null,
        prod_updt_time || null,
        prod_url_dtls || null
    ];


    pmoConnection.query(insertQuery, values, (err, result) => {
        if (err) {
            console.error('Insert failed:', err);
            return res.status(500).json({ error: 'Insert failed', details: err.message });
        }

        const insertedCID = result.insertId;

        // Update CR_ID to match CID
        const updateQuery = `UPDATE CR_TABLE SET CR_ID = ? WHERE CID = ?`;

        pmoConnection.query(updateQuery, [insertedCID, insertedCID], (err2) => {
            if (err2) {
                console.error('Failed to update CR_ID:', err2);
                return res.status(500).json({ error: 'CR_ID update failed', details: err2.message });
            }

            return res.status(200).json({ message: 'CR Entry submitted', crid: insertedCID });
        });
    });
});

// Get CR entries with status Pending or In Progress for employee
app.get('/api/existing-crs', (req, res) => {
    const empId = req.query.empid;

    if (!empId) {
        return res.status(400).json({ error: 'Missing empid' });
    }

    const query = `
    SELECT CR_ID, TASK, TASK_SIZE, STORY_POINTS, PROJECT_ID, REMARKS, TASK_STEPS, BR_DTLS,
           DEV_UPDT_TIME, DEV_URL_DTLS, QA_UPDT_TIME, QA_URL_DTLS, PROD_UPDT_TIME, PROD_URL_DTLS
    FROM CR_TABLE  
    WHERE EMP_ID = ? AND STATUS IN ('Pending', 'In Progress')
  `;

    pmoConnection.query(query, [empId], (err, result) => {
        if (err) {
            console.error('Error fetching existing CRs:', err);
            return res.status(500).json({ error: 'Failed to fetch existing CRs' });
        }
        res.json(result);
    });
});

//estimation update
app.get("/api/generate-docs/:crid", async (req, res) => {
    try {
        const { client: groq, model } = await getUserLLMClient(
            req.headers["x-user-id"],
            req.headers["x-firm-id"]
        );

        const crid = req.params.crid;

        const query = `
      SELECT T.TASK, T.TASK_SIZE, T.REMARKS, T.TASK_STEPS, T.BR_DTLS, T.START_TIME, T.END_TIME, T.TASK_TYPE,
             P.DESCRIPTION AS PROJECT_DESCRIPTION, 
             P.PROJECT_ID, P.BR_DOC AS PROJECT_BR_DOC, P.TR_DOC AS PROJECT_TR_DOC
      FROM CR_TABLE T
      JOIN PROJECT P ON T.PROJECT_ID = P.PROJECT_ID
      WHERE T.CR_ID = ?
    `;

        // ✅ Wrap query in Promise
        const result = await new Promise((resolve, reject) => {
            pmoConnection.query(query, [crid], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        if (result.length === 0) {
            return res.status(404).json({ error: "CR not found" });
        }

        const {
            TASK,
            REMARKS,
            TASK_STEPS,
            TASK_SIZE,
            BR_DTLS,
            PROJECT_DESCRIPTION,
            PROJECT_ID,
            PROJECT_BR_DOC,
            PROJECT_TR_DOC,
            TASK_TYPE,
            START_TIME,
            END_TIME,
        } = result[0];

        // ✅ Fetch latest history entry for this CRID
        const historyQuery = `
      SELECT UPDATEDBRDOC, UPDATEDTRDOC 
      FROM PROJECTHISTORY 
      WHERE CRID = ? 
      ORDER BY TIMESTAMP DESC 
      LIMIT 1
    `;
        const historyRows = await new Promise((resolve, reject) => {
            pmoConnection.query(historyQuery, [crid], (hErr, hRes) => {
                if (hErr) return reject(hErr);
                resolve(hRes);
            });
        });

        const existingHistoryBR =
            historyRows.length > 0 ? historyRows[0].UPDATEDBRDOC : null;
        const existingHistoryTR =
            historyRows.length > 0 ? historyRows[0].UPDATEDTRDOC : null;

        // --- Generate BR ---
        const trim = (text, limit = 1000) =>
            text && text.length > limit ? text.substring(0, limit) + "..." : text;
        const brPrompt = `
        You are a professional Business Analyst. Write a **one-page Business Requirement (BR) Document** 
        for the following Change Request (CR).

        📌 Project: ${PROJECT_DESCRIPTION}
        📌 Existing Project BR (master): ${trim(PROJECT_BR_DOC)}
        📌 Latest CR BR (if any): ${existingHistoryBR}
        📌 CR Task: ${TASK}
        📌 Remarks: ${REMARKS}
        📌 Task Steps: ${TASK_STEPS}
        📌 User Notes: ${BR_DTLS}

        👉 The BR document must:  
        - Focus only on this CR (self-contained one page).  
        - Clearly describe the **business needs, goals, and expected value** of this CR.  
        - Be **concise, structured, and professional**, suitable for management.  
    `;

        const brRes = await groq.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: "You are a professional BRD generator." },
                { role: "user", content: brPrompt },
            ],
            temperature: 0.7,
            max_tokens: 2048,
        });

        const brReport = brRes.choices?.[0]?.message?.content || "";

        // --- Generate TR ---

        const trPrompt = `
        You are a technical architect. Write a clear, structured Technical Requirement (TR) Document
      for the following Change Request (CR). using master tr_doc from project table

      📌 Project: ${PROJECT_DESCRIPTION}
      📌 Existing Project TR Document: ${trim(PROJECT_TR_DOC || 'N/A')}
      📌 Latest Project TR Document: ${existingHistoryTR || 'N/A'}
      📌 CR Task: ${TASK}
      📌 Technical Steps: ${TASK_STEPS || 'N\\A'}

      👉 The TR document must:  
        - Focus only on this CR (self-contained one page).  
        - Clearly describe the **technical changes, impacts, and implementation details**.  
        - Be **structured, detailed, and suitable for technical teams**.  
    `;

        const trRes = await groq.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: "You are a professional TRD generator." },
                { role: "user", content: trPrompt },
            ],
            temperature: 0.7,
            max_tokens: 2048,
        });

        const trReport = trRes.choices?.[0]?.message?.content || "";

        // --- 🧠 New: Fetch past CRs to learn from actual duration ---
        const pastCrQuery = `
      SELECT START_TIME, END_TIME, ESTIMATE_HOURS
      FROM CR_TABLE
      WHERE PROJECT_ID = ? 
        AND TASK_TYPE = ?
        AND STATUS = 'Completed'
        AND START_TIME IS NOT NULL
        AND END_TIME IS NOT NULL
      ORDER BY END_TIME DESC

      LIMIT 5
    `;
        const pastCrRows = await new Promise((resolve, reject) => {
            pmoConnection.query(pastCrQuery, [PROJECT_ID, TASK_TYPE], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        let avgActual = null;
        if (pastCrRows.length > 0) {
            const actuals = pastCrRows
                .map((r) => {
                    const start = new Date(r.START_TIME);
                    const end = new Date(r.END_TIME);
                    const diff = (end - start) / (1000 * 60 * 60); // hours
                    return diff > 0 ? diff : null;
                })
                .filter(Boolean);

            if (actuals.length > 0) {
                avgActual = Math.round(actuals.reduce((a, b) => a + b, 0) / actuals.length);
            }
        }

        // --- Generate Estimate ---
        // --- 🧮 Get total project hours logged this week ---
        const projectLoadQuery = `
  SELECT SUM(TIMESTAMPDIFF(HOUR, START_TIME, END_TIME)) AS total_hours
  FROM CR_TABLE
  WHERE PROJECT_ID = ?
    AND START_TIME >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)
    AND START_TIME < CURDATE();
`;

        const [projectLoadResult] = await new Promise((resolve, reject) => {
            pmoConnection.query(projectLoadQuery, [PROJECT_ID], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const totalHoursThisWeek = projectLoadResult?.total_hours || 0;

        const estPrompt = `
You are an experienced **Project Estimation Analyst** specializing in software development effort forecasting.

Your task is to output a **realistic total effort (in hours)** for completing this specific Change Request (CR).

### Priority Rules
1. If both Start Time and End Time are available → calculate the exact difference in hours (End - Start).  
   - Example: 9:00 → 15:00 = 6 hours.  
   - Use this as the base estimate (or adjust slightly ±1 hour if complexity suggests).  
2. If timestamps are missing → infer effort from:
   - Task complexity (steps, remarks, BR/TR details).  
   - Average time for similar CRs (${avgActual ? avgActual + " hours" : "No past data"}).  
   - Typical software effort patterns:  
     - Documentation / Analysis → 2–6 hrs  
     - Small Code Fix → 3–8 hrs  
     - New Feature → 6–10 hrs  
     - Major Enhancement → 10–14 hrs  
3. Consider current project load: this project already logged **${totalHoursThisWeek} hours** this week — avoid giving unrealistically high numbers for small CRs.
4. Never output estimates over 12 hours unless the CR clearly describes a major integration task.

### CR Data
- Project: ${PROJECT_DESCRIPTION}
- Task: ${TASK}
- Task Size: ${TASK_SIZE}
- Task Type: ${TASK_TYPE}
- Remarks: ${REMARKS || "N/A"}
- Task Steps: ${TASK_STEPS || "N/A"}
- BR Summary: ${brReport.slice(0, 400)}
- TR Summary: ${trReport.slice(0, 400)}
- Start Time: ${START_TIME || "N/A"}
- End Time: ${END_TIME || "N/A"}

### Output Format (STRICT)
Return only valid JSON:
{
  "estimateHours": <integer>
}

No text, no explanations, no extra content.
`;


        const estRes = await groq.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: "You are an expert project estimator." },
                { role: "user", content: estPrompt },
            ],
            temperature: 0,
            max_tokens: 100,
        });

        let rawEstimate = estRes.choices?.[0]?.message?.content?.trim();
        let estimateHours = null;
        try {
            const raw = estRes.choices?.[0]?.message?.content?.trim() || "";
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.estimateHours === "number") {
                estimateHours = parsed.estimateHours;
            }
        } catch {
            const rawText = estRes.choices?.[0]?.message?.content?.trim() || "";
            const numeric = parseInt(rawText.replace(/[^0-9]/g, ""), 10);
            if (!isNaN(numeric)) estimateHours = numeric;
        }

        // 🔒 Safety cap for realism
        if (estimateHours > 16) estimateHours = 16;
        if (estimateHours < 1) estimateHours = 1;

        if (isNaN(estimateHours)) estimateHours = null;



        // --- Save to CR_TABLE ---
        await new Promise((resolve, reject) => {
            const updateSql = `UPDATE CR_TABLE SET BR_DOC = ?, TR_DOC = ?, ESTIMATE_HOURS = ?  WHERE CR_ID = ?`;
            pmoConnection.query(updateSql, [brReport, trReport, estimateHours, crid], (uErr) => {
                if (uErr) return reject(uErr);
                resolve();
            });
        });

        // --- Store original Project BR/TR before first overwrite ---
        const historyCheckSql = `
      SELECT COUNT(*) AS cnt 
      FROM PROJECTHISTORY 
      WHERE PROJECT_ID = ?
    `;
        const historyCount = await new Promise((resolve, reject) => {
            pmoConnection.query(historyCheckSql, [PROJECT_ID], (err, rows) => {
                if (err) return reject(err);
                resolve(rows[0].cnt);
            });
        });

        if (historyCount === 0) {
            // fetch current original docs
            const projectDocs = await new Promise((resolve, reject) => {
                pmoConnection.query(
                    "SELECT BR_DOC, TR_DOC FROM PROJECT WHERE PROJECT_ID = ?",
                    [PROJECT_ID],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows[0]);
                    }
                );
            });

            await new Promise((resolve, reject) => {
                const insertOriginalSql = `
          INSERT INTO PROJECTHISTORY (PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP)
          VALUES (?, ?, ?, ?, NOW())
        `;
                pmoConnection.query(
                    insertOriginalSql,
                    [PROJECT_ID, 0, projectDocs.BR_DOC || "", projectDocs.TR_DOC || ""],
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        }

        // Save generated docs to PROJECT table (append instead of overwrite)
        await new Promise((resolve, reject) => {
            const appendSql = `
            UPDATE PROJECT
            SET BR_DOC = CONCAT(COALESCE(BR_DOC, ''), '\\n\\n--- CR ${crid} Update ---\\n\\n', ?),
                TR_DOC = CONCAT(COALESCE(TR_DOC, ''), '\\n\\n--- CR ${crid} Update ---\\n\\n', ?),
                UPDATED_DATE = NOW()
            WHERE PROJECT_ID = ?
        `;
            pmoConnection.query(
                appendSql,
                [brReport, trReport, PROJECT_ID],
                (pErr) => {
                    if (pErr) return reject(pErr);
                    resolve();
                }
            );
        });

        // --- Save both BR + TR into PROJECTHISTORY ---
        await new Promise((resolve, reject) => {
            const insertHistorySql = `
        INSERT INTO PROJECTHISTORY (PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP)
        VALUES (?, ?, ?, ?, NOW())
      `;
            pmoConnection.query(
                insertHistorySql,
                [PROJECT_ID, crid, brReport, trReport],
                (hErr) => {
                    if (hErr) return reject(hErr);
                    resolve();
                }
            );
        });

        console.log("Generated estimateHours:", estimateHours);
        res.json({ brReport, trReport, estimateHours });

    } catch (error) {
        console.error("Groq API Error:", error);
        res.status(500).json({ error: "Failed to generate BR/TR/Estimate" });
    }
});
//
// =======================
// 📌 Project History API
// =======================
app.get("/api/project/:projectId/history", (req, res) => {
    const projectId = req.params.projectId;

    const query = `
    SELECT HISTORYID, PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP
    FROM PROJECTHISTORY
    WHERE PROJECT_ID = ?
    ORDER BY \`TIMESTAMP\` DESC
    `;


    pmoConnection.query(query, [projectId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch history" });
        res.json(rows);
    });
});

//added to display crid projecthistory- 3-9-255
app.get("/api/projecthistory/cr/:crid", (req, res) => {
    const crid = req.params.crid;

    const query = `
    SELECT HISTORYID,PROJECT_ID, CRID, UPDATEDBRDOC, UPDATEDTRDOC, TIMESTAMP
    FROM PROJECTHISTORY
    WHERE CRID = ?
    ORDER BY TIMESTAMP DESC
  `;

    pmoConnection.query(query, [crid], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch CR history" });
        res.json(rows);
    });
});

//

// ✅ Get master BR/TR docs from PROJECT table -
app.get("/api/project/:projectId/master-docs", (req, res) => {
    const projectId = req.params.projectId;

    const query = `
    SELECT BR_DOC, TR_DOC
    FROM PROJECT
    WHERE PROJECT_ID = ?
  `;

    pmoConnection.query(query, [projectId], (err, result) => {
        if (err) return res.status(500).json({ error: "DB query failed" });
        if (result.length === 0) return res.status(404).json({ error: "Project not found" });

        res.json({
            masterBR: result[0].BR_DOC || "No BR document yet",
            masterTR: result[0].TR_DOC || "No TR document yet",
        });
    });
});

/**
 * Update CR (status + br_dtls validation)
 */
app.put("/api/crentry/:crid", (req, res) => {
    const crid = req.params.crid;
    const { status, br_dtls, task, task_steps, task_size, story_points,
        // ✅ NEW FIELDS
        dev_updt_time, dev_url_dtls,
        qa_updt_time, qa_url_dtls,
        prod_updt_time, prod_url_dtls
    } = req.body;

    // Step 1: If status = Completed, validate BR_DOC exists
    if (status === "Completed") {
        const checkSql = `SELECT BR_DOC FROM CR_TABLE WHERE CR_ID = ?`;
        pmoConnection.query(checkSql, [crid], (err, rows) => {
            if (err) return res.status(500).json({ error: "Validation failed" });
            if (!rows[0]?.BR_DOC) {
                return res
                    .status(400)
                    .json({ error: "BR Document is required before marking as Completed" });
            }

            // ✅ Update CR (safe since BR exists)
            updateCR();
        });
    } else {
        updateCR(); // ✅ No BR check if not Completed
    }

    function updateCR() {
        const updateSql = `
      UPDATE CR_TABLE
      SET STATUS = ?, BR_DTLS = ?, TASK = ?, TASK_STEPS = ?, TASK_SIZE = ?, STORY_POINTS = ?,
        DEV_UPDT_TIME = ?, DEV_URL_DTLS = ?, 
          QA_UPDT_TIME = ?, QA_URL_DTLS = ?, 
          PROD_UPDT_TIME = ?, PROD_URL_DTLS = ?
      WHERE CR_ID = ?
    `;
        pmoConnection.query(
            updateSql,
            [
                status,
                br_dtls,
                task,
                task_steps,
                task_size,
                story_points,
                dev_updt_time || null,
                dev_url_dtls || null,
                qa_updt_time || null,
                qa_url_dtls || null,
                prod_updt_time || null,
                prod_url_dtls || null,
                crid
            ], (err) => {
                if (err) {
                    console.error("CR Entry Update Error:", err);   // 👈 add this
                    return res.status(500).json({ error: "Failed to update CR entry", details: err.sqlMessage });
                }
                res.json({ success: true });
            });
    }
});

//updated -22-09-25 - api
app.post("/api/save-llm-details", (req, res) => {
    const { userId, firmId, provider, modelName, apiKey, modelUrl } = req.body;

    if (!userId || !firmId || !provider || !modelName || !apiKey) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const insertQuery = `
    INSERT INTO API_KEY_MANAGER 
      (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, MODEL_URL, APP_NAME, API_KEY, STATUS, BLOCKED, INSRT_DTM)
    VALUES (?, ?, ?, ?, ?, 'CRENTRY', ?, 'ACTIVE', 'NO', NOW())
  `;

    connection_trn.query(insertQuery, [userId, firmId, provider, modelName, modelUrl || '', apiKey], (err, result) => {
        if (err) {
            console.error("Failed to save LLM details:", err);
            return res.status(500).json({ error: "Failed to save LLM details" });
        }
        res.json({ success: true, id: result.insertId });
    });
});

// api key status -- 26-9-25
// ===============================
//  SAVE NEW LLM API KEY 
//  (Supports multiple apps)
// ===============================
app.post("/api/save-llm-key", async (req, res) => {
    try {
        const { userId, firmId, provider, model, apiKey, appName } = req.body;

        // Validate
        if (!userId || !firmId || !provider || !model || !apiKey || !appName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 1️⃣ Inactivate existing keys for this user & app
        await new Promise((resolve, reject) => {
            connection_trn.query(
                `
        UPDATE API_KEY_MANAGER
        SET STATUS='INACTIVE'
        WHERE USERID=? AND APP_NAME=?
        `,
                [userId, appName],
                (err) => (err ? reject(err) : resolve())
            );
        });

        // 2️⃣ Insert new ACTIVE key
        await new Promise((resolve, reject) => {
            connection_trn.query(
                `
        INSERT INTO API_KEY_MANAGER
          (USERID, FIRMID, LLM_PROVIDER, MODEL_NAME, APP_NAME, API_KEY, STATUS, SHOW_IN_UI, SPEED, INSRT_DTM)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'YES', 3, NOW())
        `,
                [userId, firmId, provider, model, appName, apiKey],
                (err) => (err ? reject(err) : resolve())
            );
        });

        return res.json({
            success: true,
            message: `New key saved for ${appName}, previous keys deactivated.`,
        });
    } catch (err) {
        console.error("❌ Save LLM Key Error:", err);
        return res.status(500).json({ error: "Failed to save LLM key" });
    }
});

// ===============================
//  FETCH KEYS FOR USER + APP NAME
// ===============================
app.get("/api/user-keys/:userid/:appName", async (req, res) => {
    const { userid, appName } = req.params;

    try {
        const keys = await new Promise((resolve, reject) => {
            connection_trn.query(
                `
        SELECT ID, LLM_PROVIDER, MODEL_NAME, API_KEY, STATUS
        FROM API_KEY_MANAGER
        WHERE USERID=? AND APP_NAME=?
        ORDER BY ID DESC
        `,
                [userid, appName],
                (err, rows) => (err ? reject(err) : resolve(rows))
            );
        });

        return res.json(keys);
    } catch (err) {
        console.error("❌ Fetch Keys Error:", err);
        return res.status(500).json({ error: "Failed to load keys" });
    }
});

// ===============================
//  TOGGLE KEY (ACTIVE / INACTIVE)
// ===============================
app.put("/api/toggle-key/:id", async (req, res) => {
    const keyId = req.params.id;
    const { newStatus } = req.body;

    try {
        await new Promise((resolve, reject) => {
            connection_trn.query(
                `UPDATE API_KEY_MANAGER SET STATUS=? WHERE ID=?`,
                [newStatus, keyId],
                (err) => (err ? reject(err) : resolve())
            );
        });

        return res.json({ success: true, message: "Status updated" });
    } catch (err) {
        console.error("❌ Toggle Key Error:", err);
        return res.status(500).json({ error: "Failed to update key status" });
    }
});




app.get("/api/scrapper-tool", (req, res) => {

    if (!req.query.version) {
        return res.send([]);
    }

    const QUERY = `
        SELECT FILE_NAME, VERSION
        FROM SCRAPPER_TOOL_FILES
        WHERE STATUS = 'ACTIVE'
          AND VERSION = '${req.query.version}'
        LIMIT 1
    `;

    connection_trn.query(QUERY, (err, result) => {
        if (err) {
            console.error(err);
            return res.send([]);
        }

        res.send(result);
    });
});




// Assign Project
// Get all projects from PROJECT table
app.get('/api/projects', (req, res) => {
    pmoConnection.query('SELECT PROJECT_ID, PROJECT FROM PROJECT', (err, result) => {
        if (err) res.status(500).send(err);
        else res.json(result);
    });
});

// Get active employees from EMPLOY_REGISTRATION
app.get('/api/employees/active', (req, res) => {
    pmoConnection.query('SELECT EMPID, EMPNAME FROM EMPLOY_REGISTRATION WHERE STATUS = "Active"', (err, result) => {
        if (err) res.status(500).send(err);
        else res.json(result);
    });
});

// Assign a project to employee (insert into MY_PROJECT)

app.post('/api/assign-project', (req, res) => {
    const { emp_id, project_id, admin_id } = req.body;

    if (!emp_id || !project_id || !admin_id) {
        return res.status(400).json({ error: 'Missing emp_id, project_id or admin_id' });
    }

    // Get the project description first
    const getDescriptionQuery = 'SELECT DESCRIPTION FROM PROJECT WHERE PROJECT_ID = ?';

    pmoConnection.query(getDescriptionQuery, [project_id], (err, results) => {
        if (err || results.length === 0) {
            console.error('Error fetching project description:', err);
            return res.status(500).json({ error: 'Failed to fetch project description' });
        }

        const description = results[0].DESCRIPTION;

        // Now insert into MY_PROJECT table with all fields
        const insertQuery = `
      INSERT INTO MY_PROJECT 
      (EMP_ID, TRAINEE_ID, PROJECT_ID, DESCRIPTION, CREATED_BY_ID, CREATED_DATE, STATUS)
      VALUES (?, ?, ?, ?, ?, NOW(), 'Active')
    `;

        const values = [emp_id, emp_id, project_id, description, admin_id];

        pmoConnection.query(insertQuery, values, (insertErr, insertResult) => {
            if (insertErr) {
                console.error('Insert Error:', insertErr);
                return res.status(500).json({ error: 'Failed to assign project' });
            }

            return res.status(200).json({ message: 'Project assigned successfully' });
        });
    });
});


//updated -22-08-25 - admin - businessuser - approval
// ✅ Get all inactive users
app.get('/api/admin/users/pending', (req, res) => {
    const query = `
        SELECT 
  EMPID   AS empid,
  EMPNAME AS empname,
  DESIGNATION AS designation,
  STATUS  AS status
FROM EMPLOY_REGISTRATION
WHERE STATUS = 'Inactive';

    `;

    pmoConnection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching pending users:', err);
            return res.status(500).send("Error fetching pending users");
        }
        res.json(results);
    });
});

// ✅ Approve a user (set STATUS = Active)
app.post('/api/admin/users/approve', (req, res) => {
    const { empId } = req.body;

    if (!empId) {
        return res.status(400).send("empId is required");
    }

    const query = `UPDATE EMPLOY_REGISTRATION SET STATUS = 'Active' WHERE EMPID = ?`;

    pmoConnection.query(query, [empId], (err, result) => {
        if (err) {
            console.error('Error approving user:', err);
            return res.status(500).send("Error approving user");
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("User not found or already active");
        }

        res.json({ message: "User approved successfully", empId });
    });
});



/**
 * Escapes special regex characters to prevent regex injection attacks
 * @param {string} string - The string to escape
 * @returns {string} - The escaped string safe for use in regex
 */
function escapeRegex(string) {
    if (!string) return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fallbackSearchFromPincodeTable({ pin, searchcity, db }) {
    console.log("[Fallback] ========== STARTING FALLBACK SEARCH ==========");
    console.log("[Fallback] Input -> pin:", pin, "| searchcity:", searchcity);

    // Build match condition for PINCODE_TABLE
    // For city search: look in PORTALNAME (contains village/localbody names)
    const pincodeMatch = pin
        ? { PINCODE: parseInt(pin) }
        : { PORTALNAME: { $regex: escapeRegex(searchcity), $options: "i" } };

    console.log("[Fallback] PINCODE_TABLE query:", JSON.stringify(pincodeMatch));

    const pincodeDoc = await db
        .collection("PINCODE_TABLE")
        .findOne(pincodeMatch);

    if (!pincodeDoc) {
        console.log("[Fallback] ❌ No record found in PINCODE_TABLE");
        console.log("[Fallback] ========== END FALLBACK SEARCH ==========");
        return [];
    }

    // Log the found document details
    console.log("[Fallback] ✅ Found in PINCODE_TABLE:");
    console.log("[Fallback]    - PINCODE:", pincodeDoc.PINCODE);
    console.log("[Fallback]    - PORTALNAME:", pincodeDoc.PORTALNAME);
    console.log("[Fallback]    - DISTRICT_NAME:", pincodeDoc.DISTRICT_NAME);
    console.log("[Fallback]    - STATE_NAME:", pincodeDoc.STATE_NAME);
    console.log("[Fallback]    - SUB_DISTRICT_NAME:", pincodeDoc.SUB_DISTRICT_NAME);

    const portalName = pincodeDoc.PORTALNAME;
    const districtName = pincodeDoc.DISTRICT_NAME;
    const stateName = pincodeDoc.STATE_NAME;

    let portalResults = [];

    // Step 1: Try exact match by PORTALNAME -> portal.portalname
    if (portalName && portalName.trim()) {
        console.log("[Fallback] Step 1: Searching portal by PORTALNAME -> portalname");
        console.log("[Fallback]    Query: portalname =", portalName);

        portalResults = await db
            .collection("portal")
            .find({
                portalname: { $regex: `^${escapeRegex(portalName)}$`, $options: "i" },
                status: "ACTIVE"
            })
            .limit(5)
            .toArray();

        if (portalResults.length > 0) {
            console.log("[Fallback] ✅ Step 1 SUCCESS! Found", portalResults.length, "results");
            portalResults.forEach((p, i) => {
                console.log(`[Fallback]    Result ${i + 1}: portalname="${p.portalname}", portalid=${p.portalid}, district="${p.district}"`);
            });
            console.log("[Fallback] ========== END FALLBACK SEARCH ==========");
            return portalResults;
        }
        console.log("[Fallback] ❌ Step 1: No match found");
    } else {
        console.log("[Fallback] Step 1: SKIPPED (PORTALNAME is null or empty)");
    }

    // Step 2: Search by district (ONLY if districtName has a value)
    if (districtName && districtName.trim()) {
        console.log("[Fallback] Step 2: Searching portal by DISTRICT_NAME -> district");
        console.log("[Fallback]    Query: district =", districtName);

        portalResults = await db
            .collection("portal")
            .find({
                district: { $regex: `^${escapeRegex(districtName)}$`, $options: "i" },
                status: "ACTIVE"
            })
            .limit(5)
            .toArray();

        if (portalResults.length > 0) {
            console.log("[Fallback] ✅ Step 2 SUCCESS! Found", portalResults.length, "results");
            portalResults.forEach((p, i) => {
                console.log(`[Fallback]    Result ${i + 1}: portalname="${p.portalname}", portalid=${p.portalid}, district="${p.district}"`);
            });
            console.log("[Fallback] ========== END FALLBACK SEARCH ==========");
            return portalResults;
        }
        console.log("[Fallback] ❌ Step 2: No match found");
    } else {
        console.log("[Fallback] Step 2: SKIPPED (DISTRICT_NAME is null or empty)");
    }

    // Step 3: Fallback to state search (ONLY if stateName has a value)
    if (stateName && stateName.trim()) {
        console.log("[Fallback] Step 3: Searching portal by STATE_NAME -> state");
        console.log("[Fallback]    Query: state =", stateName);

        portalResults = await db
            .collection("portal")
            .find({
                state: { $regex: `^${escapeRegex(stateName)}$`, $options: "i" },
                status: "ACTIVE"
            })
            .limit(5)
            .toArray();

        if (portalResults.length > 0) {
            console.log("[Fallback] ✅ Step 3 SUCCESS! Found", portalResults.length, "results");
            portalResults.forEach((p, i) => {
                console.log(`[Fallback]    Result ${i + 1}: portalname="${p.portalname}", portalid=${p.portalid}, state="${p.state}"`);
            });
        } else {
            console.log("[Fallback] ❌ Step 3: No match found");
        }
    } else {
        console.log("[Fallback] Step 3: SKIPPED (STATE_NAME is null or empty)");
    }

    console.log("[Fallback] ========== END FALLBACK SEARCH ==========");
    return portalResults;
}

app.post("/pincode", async (req, res) => {
    console.log("[API] /pincode hit");

    try {
        let { pin, searchcity } = req.body;

        // ========== INPUT SANITIZATION ==========
        // Sanitize pincode: allow only digits, max 6 characters
        if (pin) {
            pin = String(pin).replace(/[^0-9]/g, '').slice(0, 6);
            if (pin.length < 3) {
                return res.status(400).json({
                    source: "ERROR",
                    message: "Pincode/Zipcode must be at least 3 digits",
                    data: []
                });
            }
        }

        // Sanitize city: remove dangerous characters, limit length
        if (searchcity) {
            searchcity = String(searchcity)
                .replace(/[${}()\[\]]/g, '')  // Remove regex/injection chars
                .trim()
                .slice(0, 100);

            if (searchcity.length < 2) {
                return res.status(400).json({
                    source: "ERROR",
                    message: "City name must be at least 2 characters",
                    data: []
                });
            }
        }

        // Validate: at least one must be provided
        if (!pin && !searchcity) {
            return res.status(400).json({
                source: "ERROR",
                message: "Please provide pin or searchcity",
                data: []
            });
        }

        // ========== BUILD QUERY ==========
        const matchCondition = pin
            ? { zipcode: parseInt(pin) }
            : { portalname: { $regex: escapeRegex(searchcity), $options: "i" } };

        console.log("[API] Query:", JSON.stringify(matchCondition));

        const pipeline = [
            { $match: matchCondition },
            {
                $lookup: {
                    from: "portal",
                    localField: "parentportalid",
                    foreignField: "portalid",
                    as: "parentPortal"
                }
            },
            { $unwind: "$parentPortal" },
            {
                $lookup: {
                    from: "portal",
                    localField: "parentPortal.parentportalid",
                    foreignField: "portalid",
                    as: "statePortal"
                }
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    portalname: 1,
                    portalid: 1,
                    parentportalid: 1,
                    parentport: "$parentPortal.portalname",
                    type: 1,
                    state: "$statePortal.portalname"
                }
            }
        ];

        const primaryResult = await db
            .collection("portal")
            .aggregate(pipeline)
            .toArray();

        console.log("[API] Primary results:", primaryResult.length);

        if (primaryResult.length > 0) {
            return res.send({
                source: "PRIMARY",
                message: "",
                data: primaryResult
            });
        }

        // Fallback to pincode table search
        console.log("[API] No primary results, trying fallback...");

        const fallbackResult = await fallbackSearchFromPincodeTable({
            pin,
            searchcity,
            db
        });

        console.log("[API] Fallback results:", fallbackResult.length);

        if (fallbackResult.length > 0) {
            return res.send({
                source: "FALLBACK",
                message: "We couldn't find an exact match. Here are some related locations.",
                data: fallbackResult
            });
        }

        // No results found
        console.log("[API] No results found");
        return res.send({
            source: "NONE",
            message: "No locations found.",
            data: []
        });

    } catch (err) {
        console.error("[API] Error:", err.message);
        res.status(500).json({
            source: "ERROR",
            message: "An error occurred while processing your request.",
            data: []
        });
    }
});




//AGRI
app.post('/news/headlines/agri', async (req, res) => {
    try {
        const data = await db.collection('kf_docmnt')
            .find({
                DOC_STATUS: 1,
                DOC_PRICE: { $gt: 2 },
                DOC_CATEGRY: {
                    $in: [
                        'AGRI',
                        'Agriculture',
                        'Farming',
                        'Fresh Products'
                    ]
                }
            })
            .sort({ DOC_ID: -1 })
            .limit(8)
            .toArray();

        res.json(data);
    } catch (error) {
        console.error('AGRI Mongo error:', error);
        res.status(500).json({ error: 'Failed to fetch agri content' });
    }
});


app.post('/news/headlines/agri/more', async (req, res) => {
    try {
        const data = await db.collection('kf_docmnt')
            .find({
                DOC_STATUS: 1,
                DOC_PRICE: { $gt: 2 },
                DOC_CATEGRY: {
                    $in: [
                        'AGRI',
                        'Agriculture',
                        'Farming',
                        'Fresh Products'
                    ]
                }
            })
            .sort({ DOC_ID: -1 })
            .toArray();

        res.json(data);
    } catch (error) {
        console.error('AllAgri Mongo error:', error);
        res.status(500).json({ error: 'Failed to fetch all agri content' });
    }
});




//casestudy
app.post('/news/headlines/casestudy', async (req, res) => {
    try {
        const query = {
            DOC_STATUS: 1,
            DOC_PRICE: { $gt: 2 },
            DOC_CATEGRY: {
                $in: [
                    'Case Study',
                    'Benchmark',
                    'User Story',
                    'Startup Story',
                    'Agent Story'
                ]
            }
        };

        // Only fetch required fields for better performance
        const projection = {
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_URL: 1,
            image: 1,
            image1: 1
        };

        const data = await db.collection('kf_docmnt')
            .find(query)
            .project(projection)
            .sort({ DOC_ID: -1 })
            .limit(8)  // Frontend only uses 8 items
            .toArray();

        res.json(data);
    } catch (error) {
        console.error('CaseStudy Mongo error:', error);
        res.status(500).json({ error: 'Failed to fetch case studies' });
    }
});

app.post('/news/headlines/casestudy/more', async (req, res) => {
    try {
        const query = {
            DOC_STATUS: 1,
            DOC_PRICE: { $gt: 2 },
            DOC_CATEGRY: {
                $in: [
                    'Case Study',
                    'Benchmark',
                    'User Story',
                    'Startup Story',
                    'Agent Story'
                ]
            }
        };

        // Only fetch required fields for better performance
        const projection = {
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_URL: 1,
            image: 1,
            image1: 1
        };

        const data = await db.collection('kf_docmnt')
            .find(query)
            .project(projection)
            .sort({ DOC_ID: -1 })
            .limit(100)  // Reasonable limit for "More" page
            .toArray();

        res.json(data);
    } catch (error) {
        console.error('AllCaseStudy Mongo error:', error);
        res.status(500).json({ error: 'Failed to fetch all case studies' });
    }
});



//businessnews
app.post('/news/headlines/businessnews', async (req, res) => {
    try {
        const query = {
            DOC_STATUS: 1,
            DOC_PRICE: { $gt: 2 },
            DOC_CATEGRY: 'BUSINESS NEWS'
        };

        const projection = {
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_URL: 1,
            image: 1,
            image1: 1
        };

        const data = await db.collection('kf_docmnt')
            .find(query)
            .project(projection)
            .sort({ DOC_ID: -1 })
            .limit(8)
            .toArray();

        res.json(data);
    } catch (error) {
        console.error('BusinessNews Mongo error:', error);
        res.status(500).json({ error: 'Failed to fetch business news' });
    }
});

app.post('/news/headlines/businessnews/more', async (req, res) => {
    try {
        const query = {
            DOC_STATUS: 1,
            DOC_PRICE: { $gt: 2 },
            DOC_CATEGRY: 'BUSINESS NEWS'
        };

        const projection = {
            DOC_ID: 1,
            DOC_TITL: 1,
            DOC_CATEGRY: 1,
            DOC_PUBDATE: 1,
            DOC_URL: 1,
            image: 1,
            image1: 1
        };

        const data = await db.collection('kf_docmnt')
            .find(query)
            .project(projection)
            .sort({ DOC_ID: -1 })
            .limit(100)
            .toArray();

        res.json(data);
    } catch (error) {
        console.error('AllBusinessNews Mongo error:', error);
        res.status(500).json({ error: 'Failed to fetch all business news' });
    }
});


// ================= API Key Manager Endpoints =================

// Get all API keys for a user/firm
app.get("/api/apikey-manager/list", async (req, res) => {
    const { userid, firmid } = req.query;

    if (!userid || !firmid) {
        return res.status(400).json({ error: "USERID and FIRMID are required." });
    }

    try {
        const query = `
            SELECT 
                ID, USERID, FIRMID, LLM_PROVIDER, LLM_PROVIDER_TYPE,
                MODEL_NAME, MODEL_URL, MODEL_RESPONSE_VARIABLE,
                API_KEY, STATUS, BLOCKED, SHOW_IN_UI, SPEED, INSRT_DTM, UPD_DTM
            FROM API_KEY_MANAGER 
            WHERE USERID = ? AND FIRMID = ? AND SHOW_IN_UI = 'YES'
            ORDER BY ID DESC
        `;
        const params = [userid, firmid];

        connection_trn.query(query, params, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Database query failed." });
            }
            res.json(results);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Add a new API key
app.post("/api/apikey-manager/add", (req, res) => {
    const {
        USERID, FIRMID, LLM_PROVIDER, API_KEY,
        LLM_PROVIDER_TYPE = 'TEXT-TO-TEXT',
        MODEL_RESPONSE_VARIABLE = null,
        SHOW_IN_UI = 'YES'
    } = req.body;

    let MODEL_NAME = req.body.MODEL_NAME;

    console.log(
        `Received request to add API Key for USERID: ${USERID}, FIRMID: ${FIRMID}, LLM_PROVIDER: ${LLM_PROVIDER}, MODEL: ${MODEL_NAME}`
    );

    // API_KEY is optional for MYBLOCKS_SERVERS provider
    const isMyBlocksServer = LLM_PROVIDER && LLM_PROVIDER.startsWith('MYBLOCKS_SERVERS');

    if (!USERID || !FIRMID || !LLM_PROVIDER) {
        console.log("Validation failed: Missing fields in request body.");
        return res.status(400).json({
            success: false,
            message: "Required fields: USERID, FIRMID, LLM_PROVIDER",
        });
    }

    // API_KEY is required for non-MYBLOCKS_SERVERS providers
    if (!isMyBlocksServer && !API_KEY) {
        console.log("Validation failed: API_KEY is required for this provider.");
        return res.status(400).json({
            success: false,
            message: "API_KEY is required for this provider",
        });
    }

    // Helper: fetch PROVIDER_URL and insert the record
    const resolveModelAndInsert = (resolvedModelName) => {
        const providerUrlQuery = `
            SELECT PROVIDER_URL 
            FROM LLM_PROVIDER_MODELS 
            WHERE PROVIDER_VALUE = ? AND MODEL_VALUE = ?
            LIMIT 1
        `;

        connection_trn.query(providerUrlQuery, [LLM_PROVIDER, resolvedModelName], (err, providerResults) => {
            if (err) {
                console.error("Error fetching provider URL:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error while fetching provider URL",
                    details: err.message,
                });
            }

            const modelUrl = providerResults.length > 0 ? providerResults[0].PROVIDER_URL : null;
            console.log(`Fetched PROVIDER_URL: ${modelUrl} for provider: ${LLM_PROVIDER}, model: ${resolvedModelName}`);

            const insertQuery = `
                INSERT INTO API_KEY_MANAGER (
                    USERID, FIRMID, LLM_PROVIDER, LLM_PROVIDER_TYPE, MODEL_NAME,
                    MODEL_URL, MODEL_RESPONSE_VARIABLE, API_KEY, 
                    STATUS, BLOCKED, SHOW_IN_UI
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'NO', ?)
            `;

            const apiKeyValue = API_KEY || '';

            connection_trn.query(
                insertQuery,
                [USERID, FIRMID, LLM_PROVIDER, LLM_PROVIDER_TYPE, resolvedModelName,
                    modelUrl, MODEL_RESPONSE_VARIABLE, apiKeyValue, SHOW_IN_UI],
                (err, result) => {
                    if (err) {
                        console.error("Error inserting API Key:", err);
                        return res.status(500).json({
                            success: false,
                            message: "Database error",
                            details: err.message,
                        });
                    }

                    console.log(
                        `API Key added successfully for USERID: ${USERID}, LLM_PROVIDER: ${LLM_PROVIDER}, MODEL: ${resolvedModelName}, MODEL_URL: ${modelUrl}`
                    );
                    res.status(201).json({
                        success: true,
                        message: "API Key added successfully",
                        id: result.insertId,
                        model_assigned: resolvedModelName,
                    });
                }
            );
        });
    };

    if (MODEL_NAME) {
        // MODEL_NAME explicitly provided — use it directly
        resolveModelAndInsert(MODEL_NAME);
    } else {
        // No MODEL_NAME provided — auto-pick the first (default) model for this provider
        const defaultModelQuery = `
            SELECT MODEL_VALUE 
            FROM LLM_PROVIDER_MODELS 
            WHERE PROVIDER_VALUE = ?
            ORDER BY MODEL_VALUE ASC
            LIMIT 1
        `;
        connection_trn.query(defaultModelQuery, [LLM_PROVIDER], (err, results) => {
            if (err) {
                console.error("Error fetching default model:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error while fetching default model",
                    details: err.message,
                });
            }

            const defaultModel = results.length > 0 ? results[0].MODEL_VALUE : null;
            console.log(`Auto-assigned default model: ${defaultModel} for provider: ${LLM_PROVIDER}`);
            resolveModelAndInsert(defaultModel);
        });
    }
});


// Toggle API key status (enable/disable)
app.post("/api/apikey-manager/toggle-status", async (req, res) => {
    const { id, userid, firmid } = req.body;

    if (!id || !userid || !firmid) {
        return res.status(400).json({ error: "ID, USERID, and FIRMID are required." });
    }

    try {
        // Get the current status of the selected entry
        connection_trn.query(
            `SELECT STATUS FROM API_KEY_MANAGER WHERE ID = ? AND USERID = ? AND FIRMID = ?`,
            [id, userid, firmid],
            (err, results) => {
                if (err || results.length === 0) {
                    console.error(err);
                    return res.status(500).json({ error: "Failed to fetch status." });
                }

                const currentStatus = results[0].STATUS;
                const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

                // Toggle the status for this specific key only
                connection_trn.query(
                    `UPDATE API_KEY_MANAGER SET STATUS = ? WHERE ID = ? AND USERID = ? AND FIRMID = ?`,
                    [newStatus, id, userid, firmid],
                    (err) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ error: "Failed to update status." });
                        }
                        console.log(`API Key ID ${id} status changed to ${newStatus}`);
                        res.json({ success: true, newStatus });
                    }
                );
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Toggle BLOCKED status
app.post("/api/apikey-manager/toggle-blocked", async (req, res) => {
    const { id, userid, firmid } = req.body;

    if (!id || !userid || !firmid) {
        return res.status(400).json({ error: "ID, USERID, and FIRMID are required." });
    }

    try {
        connection_trn.query(
            `SELECT BLOCKED FROM API_KEY_MANAGER WHERE ID = ? AND USERID = ? AND FIRMID = ?`,
            [id, userid, firmid],
            (err, results) => {
                if (err || results.length === 0) {
                    console.error(err);
                    return res.status(500).json({ error: "Failed to fetch blocked status." });
                }

                const currentBlocked = results[0].BLOCKED;
                const newBlocked = currentBlocked === "YES" ? "NO" : "YES";

                connection_trn.query(
                    `UPDATE API_KEY_MANAGER SET BLOCKED = ? WHERE ID = ?`,
                    [newBlocked, id],
                    (err) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ error: "Failed to update blocked status." });
                        }
                        res.json({ success: true, newBlocked });
                    }
                );
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Delete API Key (soft delete by setting SHOW_IN_UI = 'NO')
app.delete("/api/apikey-manager/delete/:id", async (req, res) => {
    const { id } = req.params;
    const { userid, firmid } = req.query;

    if (!id || !userid || !firmid) {
        return res.status(400).json({ error: "ID, USERID, and FIRMID are required." });
    }

    try {
        connection_trn.query(
            `UPDATE API_KEY_MANAGER SET SHOW_IN_UI = 'NO', STATUS = 'INACTIVE' WHERE ID = ? AND USERID = ? AND FIRMID = ?`,
            [id, userid, firmid],
            (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "Failed to delete API key." });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "API key not found." });
                }
                res.json({ success: true, message: "API key deleted successfully." });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Update API Key details
app.put("/api/apikey-manager/update/:id", async (req, res) => {
    const { id } = req.params;
    const {
        userid, firmid, LLM_PROVIDER, LLM_PROVIDER_TYPE, MODEL_NAME,
        API_KEY
    } = req.body;

    if (!id || !userid || !firmid) {
        return res.status(400).json({ error: "ID, USERID, and FIRMID are required." });
    }

    try {
        const updateFields = [];
        const params = [];

        if (LLM_PROVIDER) { updateFields.push("LLM_PROVIDER = ?"); params.push(LLM_PROVIDER); }
        if (LLM_PROVIDER_TYPE) { updateFields.push("LLM_PROVIDER_TYPE = ?"); params.push(LLM_PROVIDER_TYPE); }
        if (MODEL_NAME) { updateFields.push("MODEL_NAME = ?"); params.push(MODEL_NAME); }
        if (API_KEY) { updateFields.push("API_KEY = ?"); params.push(API_KEY); }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update." });
        }

        params.push(id, userid, firmid);

        const query = `
            UPDATE API_KEY_MANAGER 
            SET ${updateFields.join(", ")} 
            WHERE ID = ? AND USERID = ? AND FIRMID = ?
        `;

        connection_trn.query(query, params, (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Failed to update API key." });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "API key not found." });
            }
            res.json({ success: true, message: "API key updated successfully." });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Get list of available providers (Dynamic)
app.get("/api/apikey-manager/providers", async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT PROVIDER_VALUE, PROVIDER_LABEL, PROVIDER_TYPE 
            FROM LLM_PROVIDER_MODELS 
            ORDER BY PROVIDER_LABEL ASC
        `;

        connection_trn.query(query, (err, results) => {
            if (err) {
                console.error("Error fetching providers:", err);
                return res.status(500).json({ error: "Failed to fetch providers." });
            }
            res.json(results);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});

// Get available models for a provider (Dynamic from DB)
app.get("/api/apikey-manager/models", async (req, res) => {
    const { provider } = req.query;

    if (!provider) {
        return res.status(400).json({ error: "Provider is required." });
    }

    try {
        const query = `
            SELECT MODEL_VALUE 
            FROM LLM_PROVIDER_MODELS 
            WHERE PROVIDER_VALUE = ?
            ORDER BY MODEL_VALUE ASC
        `;

        connection_trn.query(query, [provider], (err, results) => {
            if (err) {
                console.error("Error fetching models:", err);
                return res.status(500).json({ error: "Failed to fetch models." });
            }

            // Extract just the model names to match the expected frontend format
            const models = results.map(row => row.MODEL_VALUE);
            res.json(models);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
    }
});




// app.post('/upload/newsgen/imagegen', upload_resume_smp.single('image'), async function (req, res) {
//     try {

//         const imageFilePath = req.file.path;
//         console.log("path", imageFilePath);

//         // Normalize path
//         const imagePathNew = imageFilePath.replace(/\\/g, '/');
//         const isWin = process.platform === 'win32';

//         let imagePathNew1;

//         if (isWin) {
//             imagePathNew1 = imagePathNew.replace(
//                 'D:/myblocks/react trainee/Techieindex-New/public',
//                 ''
//             );
//         } else {
//             imagePathNew1 = imagePathNew.replace(
//                 '/var/www/rafalin/mongo_react',
//                 ''
//             );
//         }

//         // Final saved path
//         const savedPath = `..${imagePathNew1}`;

//         console.log("✅ File uploaded successfully:", savedPath);

//         // Return uploaded file path
//         res.json({
//             success: true,
//             path: savedPath
//         });

//     } catch (error) {

//         console.error("❗ Upload error:", error);

//         return res.status(500).json({
//             error: "Internal error"
//         });

//     }
// });


app.post('/upload/newsgen/imagegen', upload_resume_smp.single('image'), async function (req, res) {
    console.log("🔹 [START] /upload/newsgen/imagegen API hit");
    console.log("🔹 Timestamp:", new Date().toISOString());

    try {
        // Request metadata
        console.log("🔹 Headers:", req.headers);
        console.log("🔹 Body:", req.body);
        console.log("🔹 File Info:", req.file);

        if (!req.file) {
            console.error("❌ No file received in request");
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const imageFilePath = req.file.path;
        console.log("📂 Raw file path:", imageFilePath);

        // Normalize path
        const imagePathNew = imageFilePath.replace(/\\/g, '/');
        console.log("🔄 Normalized path:", imagePathNew);

        const isWin = process.platform === 'win32';
        console.log("💻 Platform:", process.platform, "| isWin:", isWin);

        let imagePathNew1;

        if (isWin) {
            console.log("🪟 Windows path transformation");
            imagePathNew1 = imagePathNew.replace(
                'D:/myblocks/react trainee/Techieindex-New/public',
                ''
            );
        } else {
            console.log("🐧 Linux path transformation");
            imagePathNew1 = imagePathNew.replace(
                '/var/www/rafalin/mongo_react',
                ''
            );
        }

        console.log("✂️ Trimmed path:", imagePathNew1);

        // Final saved path
        const savedPath = `..${imagePathNew1}`;
        console.log("✅ Final saved path:", savedPath);

        console.log("🔹 [SUCCESS] Upload completed");

        return res.json({
            success: true,
            path: savedPath
        });

    } catch (error) {
        console.error("❗ [ERROR] Upload failed");
        console.error("❗ Message:", error.message);
        console.error("❗ Stack:", error.stack);
        console.error("❗ Full Error Object:", error);

        return res.status(500).json({
            success: false,
            error: "Internal error"
        });
    } finally {
        console.log("🔹 [END] /upload/newsgen/imagegen API\n");
    }
});





// ===== ENV =====
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;


// ===== RAW BODY (for signature verification) =====
app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
        console.log("📦 Raw body captured for signature verification");
    }
}));

// ======================================================
// 🔐 VERIFY WEBHOOK (GET)
// ======================================================
app.get("/webhook", (req, res) => {
    console.log("🔹 [GET] /webhook hit");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    console.log(`🔹 [GET] /webhook params - mode: ${mode}, token: ${token}`);

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ WEBHOOK VERIFIED");
        return res.status(200).send(challenge);
    } else {
        console.error("❌ Verification failed");
        return res.sendStatus(403);
    }
});

// ======================================================
// 🔐 SIGNATURE VALIDATION (SECURITY - IMPORTANT)
// ======================================================
function verifySignature(req) {
    console.log("🔹 Verifying signature...");

    const signature = req.headers["x-hub-signature-256"];

    if (!signature) {
        console.log("❌ No signature found in headers");
        return false;
    }

    // 🔥 ADD THIS CHECK
    if (!req.rawBody) {
        console.log("❌ rawBody missing");
        return false;
    }

    const expected = crypto
        .createHmac("sha256", APP_SECRET)
        .update(req.rawBody)
        .digest("hex");

    const isValid = signature === `sha256=${expected}`;

    console.log(`🔹 Signature verification result: ${isValid}`);

    return isValid;
}

// ======================================================
// 📩 RECEIVE EVENTS (POST)
// ======================================================
app.post("/webhook", async (req, res) => {
    console.log("🔹 [POST] /webhook hit");


    console.log("🔹 rawBody exists:", !!req.rawBody);
    console.log("🔹 rawBody length:", req.rawBody?.length);
    try {
        // 🔐 Verify request from Meta
        if (!verifySignature(req)) {
            console.error("❌ Invalid signature");
            return res.sendStatus(403);
        }

        const body = req.body;
        console.log("🔹 [POST] Webhook body received:", JSON.stringify(body, null, 2));

        // Only process page events
        if (body.object === "page") {

            for (const entry of body.entry) {
                for (const event of entry.messaging) {
                    console.log("🔹 Processing event:", JSON.stringify(event, null, 2));

                    const senderPsid = event.sender.id;
                    console.log(`🔹 senderPsid: ${senderPsid}`);

                    // ===== MESSAGE =====
                    if (event.message) {
                        await handleMessage(senderPsid, event.message);
                    }

                    // ===== POSTBACK =====
                    else if (event.postback) {
                        await handlePostback(senderPsid, event.postback);
                    }
                }
            }

            return res.sendStatus(200);
        }

        return res.sendStatus(404);

    } catch (err) {
        console.error("🔥 Webhook error:", err.message);
        return res.sendStatus(500);
    }
});

// ======================================================
// 🤖 HANDLE MESSAGE
// ======================================================
async function handleMessage(psid, message) {
    console.log(`🔹 handleMessage called for PSID: ${psid}, message:`, JSON.stringify(message, null, 2));
    let response;

    if (message.text) {
        response = { text: `You said: "${message.text}"` };
    } else if (message.attachments) {
        response = { text: "Attachment received 👍" };
    }

    await sendMessage(psid, response);
}

// ======================================================
// 🔘 HANDLE POSTBACK
// ======================================================
async function handlePostback(psid, postback) {
    console.log(`🔹 handlePostback called for PSID: ${psid}, postback:`, JSON.stringify(postback, null, 2));
    const payload = postback.payload;

    let response;

    if (payload === "GET_STARTED") {
        response = { text: "Welcome! 👋" };
    } else {
        response = { text: `Postback: ${payload}` };
    }

    await sendMessage(psid, response);
}

// ======================================================
// 📤 SEND MESSAGE (Graph API)
// ======================================================
async function sendMessage(psid, message) {
    console.log(`🔹 sendMessage called for PSID: ${psid}, payload to send:`, JSON.stringify(message, null, 2));
    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/me/messages`,
            {
                recipient: { id: psid },
                message: message
            },
            {
                params: { access_token: PAGE_ACCESS_TOKEN }
            }
        );

        console.log("✅ Message sent");

    } catch (error) {
        console.error("❌ Send API error:", error.response?.data || error.message);
    }
}






// app.get("/webhook", (req, res) => {
//     const VERIFY_TOKEN = "your_verify_token123";

//     const mode = req.query["hub.mode"];
//     const token = req.query["hub.verify_token"];
//     const challenge = req.query["hub.challenge"];

//     console.log("Query:", req.query);

//     if (mode === "subscribe" && token === VERIFY_TOKEN) {
//         console.log("VERIFIED");
//         return res.status(200).send(challenge);
//     } else {
//         console.log("FAILED", token);
//         return res.sendStatus(403);
//     }
// });
