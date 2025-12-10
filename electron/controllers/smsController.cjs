const { db } = require('../database.cjs');
const { sendSMS, resetToken } = require('../services/smsService.cjs');
const log = require('electron-log');

// ============================================
// YORDAMCHI FUNKSIYA - Sozlamalarni olish
// ============================================
const getSetting = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
};

// ============================================
// CONTROLLER FUNKSIYALARI
// ============================================

/**
 * SMS sozlamalarini saqlash
 * @param {Object} data - {eskiz_email, eskiz_password, eskiz_nickname}
 * @returns {{success: boolean}}
 */
const saveSettings = (data) => {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const update = db.transaction((settings) => {
            for (const [key, value] of Object.entries(settings)) {
                stmt.run(key, String(value));
            }
        });
        update(data);
        
        // Token bekor qilish (sozlamalar o'zgardi)
        resetToken();
        
        log.info("SMS Controller: Sozlamalar saqlandi");
        return { success: true };
    } catch (error) {
        log.error("SMS Controller: Sozlamalarni saqlashda xato:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * SMS sozlamalarini o'qish
 * @returns {{email: string, eskiz_nickname: string}}
 */
const getSettings = () => {
    const email = getSetting('eskiz_email') || '';
    const nickname = getSetting('eskiz_nickname') || '4546';
    return { email, eskiz_nickname: nickname };
};

/**
 * SMS shablonlarini olish
 * @returns {Array}
 */
const getTemplates = () => {
    return db.prepare('SELECT * FROM sms_templates').all();
};

/**
 * SMS shablonini yangilash
 * @param {string} type - Shablon turi (birthday, debt_reminder, news)
 * @param {string} text - Shablon matni
 * @returns {{success: boolean}}
 */
const updateTemplate = (type, text) => {
    try {
        db.prepare('UPDATE sms_templates SET content = ? WHERE type = ?').run(text, type);
        log.info(`SMS Controller: Shablon yangilandi - ${type}`);
        return { success: true };
    } catch (error) {
        log.error("SMS Controller: Shablonni yangilashda xato:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * SMS tarixini olish (oxirgi 100 ta)
 * @returns {Array}
 */
const getHistory = () => {
    return db.prepare('SELECT * FROM sms_logs ORDER BY id DESC LIMIT 100').all();
};

/**
 * Ommaviy SMS yuborish (Barcha mijozlarga)
 * @param {string} message - Yuborilishi kerak bo'lgan SMS matni
 * @returns {Promise<{success: boolean, count: number, failed?: number}>}
 */
const sendBroadcast = async (message) => {
    try {
        const customers = db.prepare('SELECT phone, name FROM customers WHERE phone IS NOT NULL AND phone != ""').all();
        
        let sentCount = 0;
        let failedCount = 0;
        const totalCustomers = customers.length;

        log.info(`SMS Controller: Ommaviy yuborish boshlandi - ${totalCustomers} ta mijoz`);

        for (const customer of customers) {
            // Rate limiting: sekundiga 2 ta SMS (500ms kutish)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const result = await sendSMS(customer.phone, message, 'news');
            
            if (result.success) {
                sentCount++;
            } else {
                failedCount++;
                log.warn(`SMS Controller: Xato - ${customer.name} (${customer.phone}): ${result.error}`);
            }
        }

        log.info(`SMS Controller: Ommaviy yuborish tugadi - Yuborildi: ${sentCount}, Xato: ${failedCount}`);
        
        return { 
            success: true, 
            count: sentCount,
            failed: failedCount,
            total: totalCustomers
        };
    } catch (error) {
        log.error("SMS Controller: Ommaviy yuborishda xato:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Bitta SMS yuborish (Frontend uchun)
 * @param {string} phone - Telefon raqam
 * @param {string} message - SMS matni
 * @param {string} type - SMS turi (default: manual)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
const sendOne = async (phone, message, type = 'manual') => {
    return await sendSMS(phone, message, type);
};

// ============================================
// EKSPORT
// ============================================
module.exports = {
    saveSettings,
    getSettings,
    getTemplates,
    updateTemplate,
    getHistory,
    sendBroadcast,
    sendSMS: sendOne // IPC uchun alias
};