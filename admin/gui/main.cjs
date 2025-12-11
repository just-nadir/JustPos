const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
const ROOT_DIR = path.resolve(__dirname, '../../'); // JustPos root
const ADMIN_DIR = path.resolve(__dirname, '../');   // JustPos/admin

// Private Keyni o'qish
const PRIVATE_KEY_PATH = path.join(ADMIN_DIR, 'private.pem');
let PRIVATE_KEY;

try {
    PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
} catch (e) {
    console.error("Private Key topilmadi:", e);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: "JustPos License Generator"
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// 1. HID fayllarni qidirish
ipcMain.handle('scan-files', () => {
    try {
        // Root papkani qidiramiz
        const files = fs.readdirSync(ROOT_DIR)
            .filter(f => f.startsWith('JustPOS_') && f.endsWith('.hid'))
            .map(f => ({ name: f, path: path.join(ROOT_DIR, f) }));
        return { success: true, files };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 2. HID faylni o'qish
ipcMain.handle('read-hid', (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 2.5 Fayl tanlash (Dialog)
ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Request Files', extensions: ['hid'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
});

// 3. Litsenziya generatsiya qilish
ipcMain.handle('generate', (event, { hidPath, clientName, type, days }) => {
    try {
        if (!PRIVATE_KEY) throw new Error("Private Key (admin/private.pem) topilmadi!");

        // HID o'qish
        const hidContent = fs.readFileSync(hidPath, 'utf8');
        const hidData = JSON.parse(hidContent);

        // Muddatni hisoblash
        let expiry = 'NEVER';
        let typeStr = 'lifetime';

        if (type === 'monthly') {
            typeStr = 'monthly';
            const date = new Date();
            date.setDate(date.getDate() + parseInt(days));
            expiry = date.toISOString();
        }

        // Payload
        const payload = {
            client: clientName,
            hwid: hidData.hwid,
            type: typeStr,
            expiry: expiry,
            issuedAt: new Date().toISOString()
        };

        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

        // Imzolash
        const signer = crypto.createSign('SHA256');
        signer.update(payloadBase64);
        signer.end();
        const signature = signer.sign(PRIVATE_KEY, 'hex');

        // Yozish
        const finalContent = `${payloadBase64}.${signature}`;
        const outputFileName = `JustPOS_${hidData.hwid}.license`;
        const outputPath = path.join(ROOT_DIR, outputFileName);

        fs.writeFileSync(outputPath, finalContent);

        return { success: true, path: outputPath, filename: outputFileName };

    } catch (err) {
        return { success: false, error: err.message };
    }
});
