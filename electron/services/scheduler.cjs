const cron = require('node-cron');
const { db } = require('../database.cjs');
const { sendSMS } = require('./smsService.cjs');
const log = require('electron-log');

const initScheduler = () => {
    log.info("Scheduler: Xizmat ishga tushdi");

    // Har kuni ertalab 09:00 da ishga tushadi
    cron.schedule('0 9 * * *', async () => {
        log.info("Scheduler: Kunlik vazifalar bajarilmoqda...");
        await runBirthdayCheck();
        await runDebtReminderCheck();
    });

    // Test uchun: Har daqiqada ishga tushadi (developmentda yoqish mumkin)
    // cron.schedule('* * * * *', async () => {
    //     log.info("Scheduler: Test - har daqiqada");
    //     await runBirthdayCheck();
    // });
};

/**
 * Tug'ilgan kun tabrigi yuborish
 */
const runBirthdayCheck = async () => {
    try {
        const template = db.prepare(
            "SELECT content FROM sms_templates WHERE type = 'birthday' AND is_active = 1"
        ).get();
        
        if (!template) {
            log.info("Scheduler: Tug'ilgan kun shabloni o'chirilgan yoki yo'q");
            return;
        }

        // Bugungi sana (MM-DD formatida)
        const today = new Date().toISOString().slice(5, 10); // "12-06"

        const customers = db.prepare(
            `SELECT id, name, phone, birthday FROM customers 
             WHERE strftime('%m-%d', birthday) = ? 
             AND phone IS NOT NULL AND phone != ""`
        ).all(today);

        if (customers.length === 0) {
            log.info("Scheduler: Bugun tug'ilgan kun yo'q");
            return;
        }

        log.info(`Scheduler: ${customers.length} ta mijozga tug'ilgan kun SMS yuborilmoqda`);

        for (const customer of customers) {
            const message = template.content.replace('{name}', customer.name);
            
            const result = await sendSMS(customer.phone, message, 'birthday');
            
            if (result.success) {
                log.info(`Scheduler: Tug'ilgan kun SMS yuborildi - ${customer.name}`);
            } else {
                log.error(`Scheduler: Tug'ilgan kun SMS xatosi - ${customer.name}: ${result.error}`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        log.error("Scheduler: Tug'ilgan kun tekshiruvida xato:", error.message);
    }
};

/**
 * Qarz eslatmasi yuborish
 */
const runDebtReminderCheck = async () => {
    try {
        const template = db.prepare(
            "SELECT content FROM sms_templates WHERE type = 'debt_reminder' AND is_active = 1"
        ).get();
        
        if (!template) {
            log.info("Scheduler: Qarz eslatmasi shabloni o'chirilgan yoki yo'q");
            return;
        }

        const today = new Date().toISOString().slice(0, 10); // "2025-12-06"

        // Qarz muddati kelgan va 3 kundan beri SMS yuborilmagan qarzdorlar
        const debts = db.prepare(`
            SELECT d.id, d.customer_id, d.amount, d.due_date, d.last_sms_date,
                   c.name, c.phone 
            FROM customer_debts d
            JOIN customers c ON d.customer_id = c.id
            WHERE d.is_paid = 0 
              AND d.due_date <= ?
              AND c.phone IS NOT NULL 
              AND c.phone != ""
              AND (d.last_sms_date IS NULL OR date(d.last_sms_date) <= date('now', '-3 days'))
        `).all(today);

        if (debts.length === 0) {
            log.info("Scheduler: Qarz eslatmasi yuborish kerak bo'lgan mijozlar yo'q");
            return;
        }

        log.info(`Scheduler: ${debts.length} ta mijozga qarz eslatmasi yuborilmoqda`);

        for (const debt of debts) {
            const message = template.content
                .replace('{name}', debt.name)
                .replace('{amount}', debt.amount.toLocaleString());
            
            const result = await sendSMS(debt.phone, message, 'debt_reminder');
            
            if (result.success) {
                // SMS yuborilgan sanani yangilash
                db.prepare(
                    "UPDATE customer_debts SET last_sms_date = datetime('now', 'localtime') WHERE id = ?"
                ).run(debt.id);
                
                log.info(`Scheduler: Qarz eslatmasi yuborildi - ${debt.name} (${debt.amount} so'm)`);
            } else {
                log.error(`Scheduler: Qarz eslatmasi xatosi - ${debt.name}: ${result.error}`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        log.error("Scheduler: Qarz eslatmasi tekshiruvida xato:", error.message);
    }
};

module.exports = initScheduler;