const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const log = require('electron-log');

// Setup Logging
log.transports.file.level = 'info';
log.info('Admin Tool Starting...');

// --- DB SETUP ---
const dbPath = path.join(app.getPath('userData'), 'licenses.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    hwid TEXT NOT NULL,
    type TEXT NOT NULL, 
    expiry TEXT,
    issued_at TEXT NOT NULL,
    license_file_path TEXT
  )
`);

// --- PRIVATE KEY ---
// We expect the private key to be in the same folder as this script, or in the parent folder during dev
let PRIVATE_KEY;
try {
    // Try local dev path first (admin-tool/electron/private.pem)
    let keyPath = path.join(__dirname, 'private.pem');
    if (!fs.existsSync(keyPath)) {
        // Try copying from main project admin folder if not found (Helper for dev)
        const mainAdminKey = path.join(__dirname, '..', '..', 'admin', 'private.pem');
        if (fs.existsSync(mainAdminKey)) {
            PRIVATE_KEY = fs.readFileSync(mainAdminKey, 'utf8');
            // Save it here for future
            fs.writeFileSync(keyPath, PRIVATE_KEY);
            log.info('Private key imported from main project.');
        } else {
            throw new Error('Private key not found!');
        }
    } else {
        PRIVATE_KEY = fs.readFileSync(keyPath, 'utf8');
    }
} catch (e) {
    log.error('Failed to load private key:', e);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Simplifying for this internal tool
        },
        title: "NadPos License Manager",
        autoHideMenuBar: true
    });

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

    if (process.env.BROWSER === 'none') {
        win.loadURL('http://localhost:5174');
        win.webContents.openDevTools();
    } else {
        win.loadURL(startUrl);
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC HANDLERS ---

ipcMain.handle('get-history', () => {
    const stmt = db.prepare('SELECT * FROM licenses ORDER BY id DESC');
    return stmt.all();
});

ipcMain.handle('generate-license', async (event, { clientName, hwid, type, days }) => {
    try {
        if (!PRIVATE_KEY) throw new Error('Private Key is missing!');

        log.info(`Generating license for ${clientName} (${hwid})`);

        let expiry = 'NEVER';
        let typeStr = 'lifetime';

        if (type === 'monthly') {
            typeStr = 'monthly';
            const date = new Date();
            date.setDate(date.getDate() + parseInt(days));
            expiry = date.toISOString();
        }

        // 1. Create Payload
        const payload = {
            client: clientName,
            hwid: hwid,
            type: typeStr,
            expiry: expiry,
            issuedAt: new Date().toISOString()
        };

        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

        // 2. Sign
        const signer = crypto.createSign('SHA256');
        signer.update(payloadBase64);
        signer.end();
        const signature = signer.sign(PRIVATE_KEY, 'hex');

        // 3. Create File Content
        const finalContent = `${payloadBase64}.${signature}`;
        const outputFileName = `JustPOS_${hwid}.license`; // Matches the checkLicense logic

        // 4. Save to Disk (Ask user where)
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save License File',
            defaultPath: outputFileName,
            filters: [{ name: 'License File', extensions: ['license'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, finalContent);

            // 5. Save to DB
            const stmt = db.prepare(`
        INSERT INTO licenses (client_name, hwid, type, expiry, issued_at, license_file_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(clientName, hwid, typeStr, expiry, payload.issuedAt, filePath);

            return { success: true, filePath };
        } else {
            return { success: false, error: 'Cancelled by user' };
        }

    } catch (error) {
        log.error('License Generation Error:', error);
        return { success: false, error: error.message };
    }
});

// Helper to read .hid file content
ipcMain.handle('read-hid-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        return { error: 'Invalid file format' };
    }
});
