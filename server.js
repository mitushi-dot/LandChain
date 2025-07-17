const express = require('express');
const multer = require('multer');
const cors = require('cors'); // Make sure 'cors' is imported
const { create } = require('ipfs-http-client');

const app = express();
const upload = multer();

// --- IPFS Client Configuration ---
// IMPORTANT: This MUST point to your running IPFS daemon's API port (default is 5001)
const ipfs = create({ host: 'localhost', port: '5001', protocol: 'http' });

// --- In-memory "Database" (for development only) ---
const documentsDb = [];
let docIdCounter = 1;

// --- Middleware ---
// THIS IS THE CRITICAL CORS CONFIGURATION BLOCK
app.use(cors({
    origin: 'http://localhost:5002', // Explicitly allow your frontend's origin
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], // Allow all necessary HTTP methods, including OPTIONS for preflight requests
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow common headers
    credentials: true, // Allow cookies to be sent (if your app ever uses them)
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Middleware to log all incoming requests (helpful for debugging)
app.use((req, res, next) => {
    console.log(`[Backend] Incoming request: ${req.method} ${req.url}`);
    // For OPTIONS preflight requests, respond immediately if CORS handled it
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json()); // Enable JSON body parsing for incoming requests

// --- Your API Routes (app.post, app.get, app.patch) should come AFTER all app.use() calls ---
// ... (your app.post('/api/documents/upload', ...), app.patch, app.get routes go here) ...

// --- Start the Server ---
const PORT = 5002;
app.listen(PORT, () => console.log(`Backend API running on http://localhost:${PORT}`));
