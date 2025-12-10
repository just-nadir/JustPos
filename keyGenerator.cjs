const crypto = require('crypto');

// 1. SOZLAMALAR
const SECRET_PHRASE = 'MENING_POS_LOYIHAM_MAXFIY_KALITI_2025';
// AES-256 uchun 32 baytlik kalit yaratamiz
const SECRET_KEY = crypto.createHash('sha256').update(SECRET_PHRASE).digest();
const ALGORITHM = 'aes-256-cbc';

// 2. SHIFRLASH FUNKSIYASI
function encrypt(text) {
    const iv = crypto.randomBytes(16); // Random Init Vector
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Natija: IV:EncryptedData
    return iv.toString('hex') + ':' + encrypted;
}

// 3. KALIT GENERATSIYA QILISH
const generateKey = (clientName, type, days = null) => {
    const payload = {
        client: clientName,
        type: type, // 'lifetime' or 'monthly'
        createdAt: new Date().toISOString()
    };

    if (type === 'monthly' && days) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days); // Kun qo'shish
        payload.expiry = expiryDate.toISOString();
    } else if (type === 'lifetime') {
        payload.expiry = 'NEVER';
    }

    const jsonString = JSON.stringify(payload);
    const licenseKey = encrypt(jsonString);

    console.log(`\n🔑 YANGI KALIT (${type.toUpperCase()}):`);
    console.log(`👤 Mijoz: ${clientName}`);
    if (payload.expiry !== 'NEVER') console.log(`📅 Tugash sanasi: ${payload.expiry}`);
    console.log(`---------------------------------------------------`);
    console.log(licenseKey);
    console.log(`---------------------------------------------------\n`);

    return licenseKey;
};

// 4. GENERATOR FUNKSIYALARI (API)
const generateLifetime = (clientName) => {
    return generateKey(clientName, 'lifetime');
};

const generateSubscription = (clientName, days) => {
    return generateKey(clientName, 'monthly', days);
};

// ==========================================
// TEST QILISH (SKRIPT ISHGA TUSHGANDA)
// ==========================================

console.log("🛠  Litsenziya Generatori ishga tushdi...");

// Misol 1: Umrbod Litsenziya
generateLifetime("Restoran Avto Test");

// Misol 2: 30 Kunlik Obuna
generateSubscription("Kafé Oylik Test", 30);
