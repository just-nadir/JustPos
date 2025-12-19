const axios = require('axios');
const log = require('electron-log');
const { db } = require('../database.cjs');

// Settings yordamchisi
const getSetting = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
};

const telegramController = {
    // 1. Xabar yuborish (Universal)
    sendMessage: async (text) => {
        try {
            const token = getSetting('telegram_bot_token');
            const chatId = getSetting('telegram_chat_id');

            if (!token || !chatId) {
                log.warn("Telegram sozlangan emas (Token yoki ChatID yo'q)");
                throw new Error("Telegram sozlangan emas");
            }

            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            await axios.post(url, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            });

            log.info("Telegram xabar yuborildi");
            return { success: true };
        } catch (error) {
            log.error("Telegram error:", error.message);
            throw new Error(`Telegram xatosi: ${error.message}`);
        }
    },

    // 2. Sinov xabari
    sendTestMessage: async () => {
        return await telegramController.sendMessage("✅ <b>JustPos:</b> Aloqa muvaffaqiyatli o'rnatildi!");
    },

    // 3. Kunlik Hisobot (Z-Report) yuborish
    sendDailyReport: async (dateStr = null) => {
        try {
            // Agar sana berilmasa, bugungi sana
            const today = new Date();
            const date = dateStr || today.toISOString().split('T')[0];

            // Ma'lumotlarni yig'ish (Sales)
            const query = `
                SELECT 
                    SUM(total_amount) as total,
                    SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END) as cash,
                    SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END) as card,
                    SUM(CASE WHEN payment_method = 'transfer' THEN total_amount ELSE 0 END) as transfer,
                    COUNT(*) as count,
                    SUM(guest_count) as guests
                FROM sales 
                WHERE date(date) = date(?)
            `;
            const stats = db.prepare(query).get(date);

            // Bekor qilinganlar
            const cancelQuery = `SELECT COUNT(*) as count, SUM(total_amount) as total FROM cancelled_orders WHERE date(date) = date(?)`;
            const cancelled = db.prepare(cancelQuery).get(date);

            // Agar savdo bo'lmasa
            if (!stats || stats.count === 0) {
                return await telegramController.sendMessage(`📅 <b>${date}</b> uchun savdolar yo'q.`);
            }

            // Xabarni shakllantirish
            const text = `
📊 <b>KUNLIK HISOBOT: ${date}</b>

💰 <b>Jami Savdo:</b> ${stats.total?.toLocaleString()} so'm

💳 <b>Naqd:</b> ${stats.cash?.toLocaleString()} so'm
💳 <b>Karta:</b> ${stats.card?.toLocaleString()} so'm
💳 <b>O'tkazma:</b> ${stats.transfer?.toLocaleString()} so'm

🧾 <b>Cheklar soni:</b> ${stats.count} ta
👥 <b>Mehmonlar:</b> ${stats.guests || 0} ta

❌ <b>Bekor qilingan:</b> ${cancelled.count} ta (${cancelled.total?.toLocaleString() || 0} so'm)

<i>JustPos avtomatik hisobot tizimi</i>
            `;

            return await telegramController.sendMessage(text);

        } catch (error) {
            log.error("Report sending failed:", error);
            throw error;
        }
    },

    // 4. Z-Report (Smena yopilganda) - YANGI
    sendShiftReport: async (shiftId) => {
        try {
            const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(shiftId);
            if (!shift) return;

            const restaurantName = getSetting('restaurantName') || 'Restoran';

            const report = `
📢 <b>Z-REPORT (SMENA YOPILDI)</b>
🏪 <b>${restaurantName}</b>

🆔 Smena ID: #${shift.id}
👤 Kassir: ${shift.cashier_name}
⏰ Boshlandi: ${new Date(shift.start_time).toLocaleString()}
🏁 Tugadi: ${new Date(shift.end_time).toLocaleString()}

💰 <b>MOLIYAVIY HISOBOT:</b>

💵 <b>NAQD PUL (CASH):</b>
   🔹 Tizim bo'yicha: ${shift.total_cash?.toLocaleString()} so'm
   🔹 Kassa Boshida: ${shift.start_cash?.toLocaleString()} so'm
   🔹 Kutilayotgan: ${(shift.total_cash + shift.start_cash)?.toLocaleString()} so'm
   🔸 <b>Haqiqiy: ${shift.declared_cash?.toLocaleString()} so'm</b>
   ${shift.difference_cash < 0
                    ? `🔴 <b>Kamomat: ${shift.difference_cash?.toLocaleString()} so'm</b>`
                    : shift.difference_cash > 0
                        ? `🟢 <b>Ortiqcha: +${shift.difference_cash?.toLocaleString()} so'm</b>`
                        : `✅ <b>Farq yo'q</b>`
                }

💳 <b>TERMINAL (CARD):</b>
   🔹 Tizim bo'yicha: ${shift.total_card?.toLocaleString()} so'm
   🔸 <b>Haqiqiy: ${shift.declared_card?.toLocaleString()} so'm</b>
   ${shift.difference_card < 0
                    ? `🔴 <b>Kamomat: ${shift.difference_card?.toLocaleString()} so'm</b>`
                    : shift.difference_card > 0
                        ? `🟢 <b>Ortiqcha: +${shift.difference_card?.toLocaleString()} so'm</b>`
                        : `✅ <b>Farq yo'q</b>`
                }

📲 <b>O'tkazma (Click/Payme):</b> ${shift.total_transfer?.toLocaleString()} so'm

💎 <b>JAMI SAVDO: ${shift.total_sales?.toLocaleString()} so'm</b>
            `;

            return await telegramController.sendMessage(report);
        } catch (error) {
            log.error("Telegram Z-Report error:", error.message);
        }
    }
};

module.exports = telegramController;
