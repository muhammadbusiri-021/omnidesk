const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3920;
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- 1. Python Native Input Engine Subprocess ---
let pythonInputProcess = null;
let inputReady = false;

function startInputEngine() {
    try {
        const pythonPath = 'python';
        const scriptPath = path.join(__dirname, 'host', 'input_engine.py');
        
        console.log(`[OmniDesk] Memulai Python Native Input Engine: ${scriptPath}`);
        pythonInputProcess = spawn(pythonPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        pythonInputProcess.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg.includes('INPUT_ENGINE_STDIN_READY')) {
                inputReady = true;
                console.log('[OmniDesk] Windows Input Engine SIAP (DPI-Aware SendInput)');
            }
        });

        pythonInputProcess.stderr.on('data', (err) => {
            console.error('[OmniDesk Input Engine Error]:', err.toString());
        });

        pythonInputProcess.on('close', (code) => {
            console.log(`[OmniDesk] Input Engine berhenti dengan kode: ${code}`);
            inputReady = false;
        });
    } catch (err) {
        console.error('[OmniDesk] Gagal menginisialisasi Python Input Engine:', err.message);
    }
}

function sendCommandToInputEngine(cmd) {
    if (!pythonInputProcess || !inputReady) {
        return false;
    }
    try {
        pythonInputProcess.stdin.write(JSON.stringify(cmd) + '\n');
        return true;
    } catch (err) {
        console.error('[OmniDesk] Gagal mengirim perintah ke Input Engine:', err);
        return false;
    }
}

// Start the engine
startInputEngine();

// --- 2. HTTP Server for Static Assets & Local API ---
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    // CORS headers for local flexibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API: Forward input events from Host WebRTC session to Windows OS
    if (req.url === '/api/input' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const cmd = JSON.parse(body);
                const success = sendCommandToInputEngine(cmd);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: success ? 'ok' : 'engine_not_ready' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // API: System status
    if (req.url === '/api/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            inputEngineReady: inputReady,
            platform: process.platform,
            time: new Date().toISOString()
        }));
        return;
    }

    // Serve PeerJS vendor file from node_modules directly
    if (req.url === '/vendor/peerjs.min.js') {
        const peerJsPath = path.join(__dirname, 'node_modules', 'peerjs', 'dist', 'peerjs.min.js');
        if (fs.existsSync(peerJsPath)) {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            fs.createReadStream(peerJsPath).pipe(res);
            return;
        }
    }

    // Static Files
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    
    const filePath = path.join(PUBLIC_DIR, reqPath);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Server Error: ' + err.message);
            }
        } else {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            res.end(content);
        }
    });
});

// --- 3. Built-in WebSocket Signaling Server (for Local/LAN & Custom Relay) ---
const wss = new WebSocketServer({ server, path: '/ws' });
const registeredPeers = new Map(); // id -> { ws, role, pin }

wss.on('connection', (ws) => {
    let peerId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register_host') {
                peerId = data.id;
                registeredPeers.set(peerId, { ws, role: 'host', pin: data.pin });
                ws.send(JSON.stringify({ type: 'registered', id: peerId }));
                console.log(`[Signaling] Host terdaftar: ${peerId}`);
            } 
            else if (data.type === 'connect_request') {
                const targetHost = registeredPeers.get(data.targetId);
                if (!targetHost) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Device ID tidak ditemukan atau sedang offline.' }));
                    return;
                }
                if (targetHost.pin !== data.pin) {
                    ws.send(JSON.stringify({ type: 'error', message: 'PIN Salah! Minta PIN yang benar dari pemilik PC.' }));
                    return;
                }
                // Forward handshake request to Host
                targetHost.ws.send(JSON.stringify({
                    type: 'incoming_connection',
                    from: data.clientId,
                    clientName: data.clientName || 'Controller'
                }));
                console.log(`[Signaling] Controller ${data.clientId} meminta koneksi ke Host ${data.targetId}`);
            }
            else if (data.type === 'signal') {
                // Forward SDP Offer/Answer or ICE candidates
                const target = registeredPeers.get(data.targetId);
                if (target && target.ws.readyState === 1) {
                    target.ws.send(JSON.stringify({
                        type: 'signal',
                        from: data.from,
                        signalData: data.signalData
                    }));
                }
            }
        } catch (err) {
            console.error('[Signaling Message Error]:', err);
        }
    });

    ws.on('close', () => {
        if (peerId) {
            registeredPeers.delete(peerId);
            console.log(`[Signaling] Peer terputus: ${peerId}`);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 OmniDesk Core Server Berjalan di Port ${PORT}`);
    console.log(`  - Local URL:   http://localhost:${PORT}`);
    console.log(`  - Host Mode:   http://localhost:${PORT}/?mode=host`);
    console.log(`  - Remote Mode: http://localhost:${PORT}/?mode=controller`);
    console.log(`======================================================\n`);
});

// Clean shutdown handler
process.on('SIGINT', () => {
    console.log('\n[OmniDesk] Mematikan server...');
    if (pythonInputProcess) {
        pythonInputProcess.kill();
    }
    process.exit(0);
});
