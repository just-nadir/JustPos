const axios = require('axios');
const FormData = require('form-data');
const { db } = require('../database.cjs');
const log = require('electron-log');

// ============================================
// TOKEN BOSHQARUVI (Markazlashtirilgan)
// ============================================
let token = null;

// ============================================
// YORDAMCHI FUNKSIYALAR
// ============================================

/**
 * Sozlamalarni bazadan olish
 * @returns {{email: string|null, password: string|null, nickname: string}}
 */
const getCredentials = () => {
    const email = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_email'").get()?.value;
    const password = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_password'").get()?.value;
    const nickname = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_nickname'").get()?.value || '4546';
    return { email, password, nickname };
};

/**
 * Telefon raqamni formatlash (998 prefiksi bilan)
 * @param {string} phone - Kiruvchi telefon raqam
 * @returns {{valid: boolean, phone: string|null, error: string|null}}
 */
const formatPhone = (phone) => {
    let cleanPhone = phone.replace(/\D/g, ''); // Faqat raqamlar
    
    if (cleanPhone.length === 9) {
        cleanPhone = '998' + cleanPhone; // 998 prefiksini qo'shish
    }
    
    if (cleanPhone.length !== 12) {
        return {
            valid: false,
            phone: null,
            error: `Noto'g'ri raqam formati: ${phone} (12 raqam bo'lishi kerak, masalan: 998901234567)`
        };
    }
    
    return { valid: true, phone: cleanPhone, error: null };
};

// ============================================
// ESKIZ.UZ API FUNKSIYALARI
// ============================================

/**
 * Eskiz.uz ga login qilish va token olish
 * @returns {Promise<string|null>} Token yoki null
 */
const loginToEskiz = async () => {
    const { email, password } = getCredentials();
    
    if (!email || !password) {
        log.warn("SMS Service: Eskiz login/parol sozlanmagan");
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        const response = await axios.post('https://notify.eskiz.uz/api/auth/login', formData, {
            headers: formData.getHeaders(),
            timeout: 10000 // 10 soniya timeout
        });

        if (response.data && response.data.data && response.data.data.token) {
            token = response.data.data.token;
            log.info("SMS Service: Eskiz.uz ga muvaffaqiyatli login qilindi");
            return token;
        } else {
            log.error("SMS Service: Token olinmadi, javob:", response.data);
            return null;
        }
    } catch (error) {
        log.error("SMS Service: Eskiz Login Xatosi:", error.response?.data || error.message);
        return null;
    }
};

/**
 * SMS yuborish (Avtomatik login va retry logikasi bilan)
 * @param {string} phone - Telefon raqam
 * @param {string} message - SMS matni
 * @param {string} type - SMS turi (manual, birthday, debt_reminder, news)
 * @param {number} retryCount - Retry hisoblagich (ichki)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
const sendSMS = async (phone, message, type = 'manual', retryCount = 0) => {
    // 1. Telefon raqamni tekshirish
    const phoneValidation = formatPhone(phone);
    if (!phoneValidation.valid) {
        log.warn(`SMS Service: ${phoneValidation.error}`);
        return { success: false, error: phoneValidation.error };
    }
    
    const cleanPhone = phoneValidation.phone;
    const { nickname } = getCredentials();

    // 2. Token mavjudligini tekshirish
    if (!token) {
        log.info("SMS Service: Token yo'q, login qilinmoqda...");
        await loginToEskiz();
        
        if (!token) {
            const errorMsg = "Avtorizatsiya xatosi: Token olinmadi";
            log.error(`SMS Service: ${errorMsg}`);
            
            // Bazaga failed status yozish
            db.prepare(
                "INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)"
            ).run(cleanPhone, message, 'failed', type);
            
            return { success: false, error: errorMsg };
        }
    }

    // 3. SMS yuborish
    try {
        const formData = new FormData();
        formData.append('mobile_phone', cleanPhone);
        formData.append('message', message);
        formData.append('from', nickname);

        const response = await axios.post('https://notify.eskiz.uz/api/message/sms/send', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            },
            timeout: 15000 // 15 soniya timeout
        });

        // Muvaffaqiyatli yuborildi
        const status = 'sent';
        db.prepare(
            "INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)"
        ).run(cleanPhone, message, status, type);
        
        log.info(`SMS Service: SMS yuborildi - ${cleanPhone} (${type})`);
        return { success: true, data: response.data };

    } catch (error) {
        const errorDetail = error.response?.data?.message || error.message;
        
        // 4. 401 xato (Token eskirgan) - Retry logikasi
        if (error.response?.status === 401 && retryCount < 1) {
            log.warn("SMS Service: Token eskirgan (401), qayta login qilinmoqda...");
            token = null; // Tokenni tozalash
            
            // Rekursiv chaqiruv (1 marta retry)
            return await sendSMS(phone, message, type, retryCount + 1);
        }

        // 5. Xato yuz berdi
        const status = 'failed';
        db.prepare(
            "INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)"
        ).run(cleanPhone, message, status, type);
        
        log.error(`SMS Service: SMS yuborishda xato - ${cleanPhone}:`, errorDetail);
        if (error.response?.data) {
            log.error("SMS Service: Eskiz Response:", JSON.stringify(error.response.data));
        }
        
        return { success: false, error: errorDetail };
    }
};

/**
 * Tokenni tashqi kod orqali bekor qilish (sozlamalar o'zgarganda)
 */
const resetToken = () => {
    token = null;
    log.info("SMS Service: Token bekor qilindi (sozlamalar yangilandi)");
};

// ============================================
// EKSPORT
// ============================================
module.exports = {
    sendSMS,
    loginToEskiz,
    resetToken,
    formatPhone // Test uchun eksport
};