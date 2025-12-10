const { db } = require('../database.cjs');
const log = require('electron-log');
const crypto = require('crypto');

// --- XAVFSIZLIK SOZLAMALARI ---
const SECRET_PHRASE = 'MENING_POS_LOYIHAM_MAXFIY_KALITI_2025';
// AES-256 uchun 32 baytlik kalit (Generator bilan bir xil bo'lishi SHART)
const SECRET_KEY = crypto.createHash('sha256').update(SECRET_PHRASE).digest();
const ALGORITHM = 'aes-256-cbc';

// DEKODER FUNKSIYASI
function decrypt(text) {
    try {
        const textParts = text.split(':');
        // Format tekshirish: IV:Data
        if (textParts.length !== 2) return null;

        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        // Dekodlash xatosi (noto'g'ri kalit)
        return null;
    }
}

const formatInfo = (info) => {
    return {
        active: info.is_active === 1,
        type: info.type,
        expiry: info.expiry_date,
        lastOnline: info.last_login
    };
};

const licenseController = {

    // 1. Litsenziya holatini tekshirish
    checkLicense: () => {
        try {
            // 1. Bazadan ma'lumot olish
            const license = db.prepare("SELECT * FROM license_data LIMIT 1").get();

            if (!license) {
                return { active: false, reason: 'no_license' };
            }

            // 2. Faolligini tekshirish
            if (license.is_active !== 1) {
                return { active: false, reason: 'blocked' };
            }

            // 3. Vaqt manipulyatsiyasini tekshirish (Time Tampering)
            const currentTime = new Date();
            const lastLoginTime = new Date(license.last_login);

            // Agar joriy vaqt oxirgi kirgan vaqtdan orqada bo'lsa (1 soatlik buffer bilan)
            // Buffer: kompyuter soati ozgina o'zgargan bo'lishi mumkin
            if (currentTime < lastLoginTime && (lastLoginTime - currentTime) > 3600000) {
                log.warn(`⚠️ Vaqt manipulyatsiyasi aniqlandi! Joriy: ${currentTime}, Oxirgi: ${lastLoginTime}`);
                return { active: false, reason: 'time_tampered', lastOnline: license.last_login };
            }

            // 4. Muddatni tekshirish (faqat Oylik obuna uchun)
            if (license.type === 'monthly') {
                const expiryDate = new Date(license.expiry_date);
                if (currentTime > expiryDate) {
                    return { active: false, reason: 'expired', expiry: license.expiry_date };
                }
            }

            // 5. Muvaffaqiyatli: Vaqtni yangilash
            const nowISO = currentTime.toISOString();
            db.prepare("UPDATE license_data SET last_login = ? WHERE id = ?").run(nowISO, license.id);

            return { active: true, type: license.type, expiry: license.expiry_date };

        } catch (error) {
            log.error('Litsenziya tekshirishda xato:', error);
            return { active: false, reason: 'error' };
        }
    },

    // 2. Litsenziyani faollashtirish
    activateLicense: (key) => {
        try {
            const result = validateKeyReal(key);

            if (!result.valid) {
                return { success: false, message: 'Kalit yaroqsiz yoki shikastlangan!' };
            }

            const activeDate = new Date(); // Hozirgi vaqt

            // Bazani tozalash (eski litsenziyalarni o'chirish)
            db.prepare("DELETE FROM license_data").run();

            // Yangi litsenziyani saqlash
            const stmt = db.prepare(`
                INSERT INTO license_data (key, type, expiry_date, last_login, is_active)
                VALUES (?, ?, ?, ?, 1)
            `);

            stmt.run(key, result.type, result.expiryDate, activeDate.toISOString());
            log.info(`✅ Yangi litsenziya faollashtirildi: ${result.client} (${result.type})`);

            return { success: true, type: result.type };

        } catch (error) {
            log.error('Litsenziya faollashtirishda xato:', error);
            return { success: false, message: 'Server xatosi' };
        }
    }
};

// --- REAL VALIDATION LOGIC ---
function validateKeyReal(key) {
    key = key.trim();

    // 1. Dekodlash
    const jsonString = decrypt(key);
    if (!jsonString) {
        return { valid: false };
    }

    try {
        const payload = JSON.parse(jsonString);

        // 2. Ma'lumotlarni tekshirish
        if (!payload.client || !payload.type) {
            return { valid: false };
        }

        // 3. Muddatni tekshirish (Agar import paytida o'tib ketgan bo'lsa)
        if (payload.type === 'monthly' && payload.expiry) {
            const expiryDate = new Date(payload.expiry);
            if (new Date() > expiryDate) {
                return { valid: false, message: 'Kalit muddati tugagan!' };
            }
            return {
                valid: true,
                type: 'monthly',
                expiryDate: payload.expiry,
                client: payload.client
            };
        }

        if (payload.type === 'lifetime') {
            return {
                valid: true,
                type: 'lifetime',
                expiryDate: null,
                client: payload.client
            };
        }

        return { valid: false };

    } catch (e) {
        return { valid: false };
    }
}

module.exports = licenseController;
