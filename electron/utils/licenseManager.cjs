const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const nodeCrypto = require('crypto');
const os = require('os');
const log = require('electron-log');

// --- CONSTANTS ---
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtdENqz3eme8UgfjBZGuI
R7nFyYaT8xqyQYh84i1CDjLkN+cwrxJBWpUF57syvtJZfabe6v5mQyJs9CespkMU
AwDC1aupLfqUYRALcQlRL6c8y3Wp69fhciycK/ZYph54QFBgmI5Nu2eGAlp4fxb6
Y5mVbBIXxE6saiDKEmFq1prU3GxbzMBjeLET6ENd19UcChCMDEgXo6s4fRiEc1gE
TDWzSj4NA03mF85gmyxX4zDOUuPvc98oLS00QaO22vDIO5b6HqEHebAydyRu6mNU
4ZHzgKVb4mxhUJvkaSzgu8OsHPNrIuvjtHmibqilFhJM1C4MEpuMW3GZQm2To8dq
pQIDAQAB
-----END PUBLIC KEY-----`;

const APP_DIR = path.dirname(app.getAppPath()); // Production da resources papkasi yoki exe yonida
const CHECK_FILE_DIR = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();

// --- UTILS ---

/**
 * Hardware ID generatsiya qilish
 * Format: XXXX-XXXX-XXXX-XXXX-XXXX (20 ta belgi)
 */
function getHardwareId() {
    try {
        const cpus = os.cpus();
        const networkInterfaces = os.networkInterfaces();

        const cpuModel = cpus[0]?.model || 'unknown-cpu';
        const macAddress = Object.values(networkInterfaces)
            .flat()
            .find(iface => !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00')?.mac || 'unknown-mac';
        const hostname = os.hostname();

        const rawId = `${cpuModel}-${macAddress}-${hostname}`;
        const hash = nodeCrypto.createHash('sha256').update(rawId).digest('hex').toUpperCase();

        // 20 ta belgi olamiz va 4 tadan guruhlaymiz
        const shortHash = hash.substring(0, 20);
        const parts = shortHash.match(/.{1,4}/g);

        return parts.join('-');
    } catch (error) {
        log.error('HWID Error:', error);
        return '0000-0000-0000-0000-0000';
    }
}

/**
 * Litsenziya ma'lumotlarini tekshirish
 */
function verifyLicenseData(encryptedData, signature) {
    try {
        // 1. Imzoni tekshirish
        const verify = nodeCrypto.createVerify('SHA256');
        verify.update(encryptedData);
        verify.end();

        const isVerified = verify.verify(PUBLIC_KEY, signature, 'hex');
        if (!isVerified) return { valid: false, error: 'signature_invalid' };

        // 2. Dekodlash (Public Key bilan faqat verify qilinadi, shifrlash private bilan bo'lgan)
        // Lekin bizda ma'lumot shifrlangan. Odatda RSA da Private bilan shifrlab Public bilan ochilmaydi (faqat imzo).
        // Shuning uchun bu yerda biz oddiy Base64 encoded JSON ishlatamiz, RSA faqat imzo uchun.
        // YOKI: Ma'lumot AES bilan shifrlangan va kalit RSA bilan himoyalangan bo'lishi mumkin.
        // Soddalashtirish uchun: Content ochiq (JSON base64), lekin TAGIDA IMZO bor. 

        // Logika o'zgarishi:
        // License File Content: BASE64_PAYLOAD.SIGNATURE_HEX

        const payloadBuffer = Buffer.from(encryptedData, 'base64'); // encryptedData aslida payload
        const payload = JSON.parse(payloadBuffer.toString('utf8'));

        return { valid: true, payload };

    } catch (error) {
        log.error('Verify Error:', error);
        return { valid: false, error: 'parse_error' };
    }
}

// --- EXPORTED FUNCTIONS ---

const licenseManager = {
    getHwid: () => getHardwareId(),

    /**
     * Request fayl yaratish: JustPOS_HWID.hid
     */
    createRequestFile: () => {
        try {
            const hwid = getHardwareId();
            const fileName = `JustPOS_${hwid}.hid`;
            const filePath = path.join(CHECK_FILE_DIR, fileName);

            // Agar fayl allaqachon bo'lsa, qayta yozmaymiz (yoki yangilaymiz)
            if (!fs.existsSync(filePath)) {
                const content = JSON.stringify({
                    product: 'JustPos',
                    hwid: hwid,
                    date: new Date().toISOString()
                }, null, 2);
                fs.writeFileSync(filePath, content);
            }

            return { success: true, path: filePath };
        } catch (error) {
            log.error('Request Create Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Litsenziyani tekshirish
     * Izlaydi: JustPOS_<HWID>.license
     */
    checkLicense: () => {
        try {
            const hwid = getHardwareId();
            const fileName = `JustPOS_${hwid}.license`;
            const filePath = path.join(CHECK_FILE_DIR, fileName);

            if (!fs.existsSync(filePath)) {
                // AUTO-GEN: Litsenziya yo'q bo'lsa, avtomatik so'rov faylini yaratamiz
                licenseManager.createRequestFile();
                return { active: false, status: 'missing_file', hwid };
            }

            const fileContent = fs.readFileSync(filePath, 'utf8').trim();
            const [payloadBase64, signature] = fileContent.split('.');

            if (!payloadBase64 || !signature) {
                return { active: false, status: 'corrupted_file', hwid };
            }

            // Imzoni tekshirish (Payload + Signature)
            const verify = nodeCrypto.createVerify('SHA256');
            verify.update(payloadBase64);
            verify.end();

            if (!verify.verify(PUBLIC_KEY, signature, 'hex')) {
                return { active: false, status: 'invalid_signature', hwid };
            }

            // Payloadni o'qish
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

            // HWID mosligini tekshirish
            if (payload.hwid !== hwid) {
                return { active: false, status: 'hwid_mismatch', hwid };
            }

            // Muddatni tekshirish
            if (payload.type === 'monthly' && payload.expiry) {
                if (new Date() > new Date(payload.expiry)) {
                    return { active: false, status: 'expired', expiry: payload.expiry, hwid };
                }
            }

            return {
                active: true,
                status: 'active',
                type: payload.type,
                client: payload.client,
                expiry: payload.expiry,
                hwid
            };

        } catch (error) {
            log.error('Check License Error:', error);
            return { active: false, status: 'error', message: error.message };
        }
    }
};

module.exports = licenseManager;
