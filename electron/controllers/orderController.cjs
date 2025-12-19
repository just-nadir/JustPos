const { db, notify } = require('../database.cjs');
const printerService = require('../services/printerService.cjs');
const log = require('electron-log');
const shiftController = require('../controllers/shiftController.cjs'); // YANGI


function getOrCreateCheckNumber(tableId) {
    const table = db.prepare('SELECT current_check_number FROM tables WHERE id = ?').get(tableId);
    if (table && table.current_check_number > 0) return table.current_check_number;

    const nextNumObj = db.prepare("SELECT value FROM settings WHERE key = 'next_check_number'").get();
    let nextNum = nextNumObj ? parseInt(nextNumObj.value) : 1;

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('next_check_number', ?)").run(String(nextNum + 1));
    db.prepare("UPDATE tables SET current_check_number = ? WHERE id = ?").run(nextNum, tableId);

    return nextNum;
}

function getDefaultKitchen() {
    try {
        const firstKitchen = db.prepare('SELECT id FROM kitchens ORDER BY id ASC LIMIT 1').get();
        return firstKitchen ? String(firstKitchen.id) : '1';
    } catch (err) {
        log.error("Default oshxonani olishda xato:", err);
        return '1';
    }
}

module.exports = {
    getTableItems: (id) => db.prepare('SELECT * FROM order_items WHERE table_id = ?').all(id),

    addItem: (data) => {
        try {
            // Smena ochiqligini tekshirish
            const activeShift = shiftController.getShiftStatus();
            if (!activeShift) throw new Error("Smena ochilmagan! Iltimos, avval smenani oching.");

            let checkNumber = 0;
            const addItemTransaction = db.transaction((item) => {
                const { tableId, productName, price, quantity, destination } = item;
                checkNumber = getOrCreateCheckNumber(tableId);

                db.prepare(`INSERT INTO order_items (table_id, product_name, price, quantity, destination) VALUES (?, ?, ?, ?, ?)`).run(tableId, productName, price, quantity, destination);

                const currentTable = db.prepare('SELECT total_amount, waiter_name FROM tables WHERE id = ?').get(tableId);
                const newTotal = (currentTable ? currentTable.total_amount : 0) + (price * quantity);

                let waiterName = currentTable.waiter_name;
                if (!waiterName || waiterName === 'Noma\'lum') {
                    waiterName = 'Kassir';
                }

                db.prepare(`UPDATE tables SET status = 'occupied', total_amount = ?, start_time = COALESCE(start_time, ?), waiter_name = ? WHERE id = ?`)
                    .run(newTotal, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), waiterName, tableId);
            });

            const res = addItemTransaction(data);
            notify('tables', null);
            notify('table-items', data.tableId);
            return res;
        } catch (err) {
            log.error("addItem xatosi:", err);
            throw err;
        }
    },

    addBulkItems: (tableId, items, waiterId) => {
        try {
            let checkNumber = 0;
            let waiterName = "Noma'lum";

            if (waiterId) {
                const user = db.prepare('SELECT name FROM users WHERE id = ?').get(waiterId);
                if (user) {
                    waiterName = user.name;
                }
            }

            const addBulkTransaction = db.transaction((itemsList) => {
                checkNumber = getOrCreateCheckNumber(tableId);

                let additionalTotal = 0;
                const insertStmt = db.prepare(`INSERT INTO order_items (table_id, product_name, price, quantity, destination) VALUES (?, ?, ?, ?, ?)`);

                const productStmt = db.prepare('SELECT destination FROM products WHERE name = ?');
                const validatedItems = [];

                for (const item of itemsList) {
                    let actualDestination = item.destination;

                    try {
                        const product = productStmt.get(item.name);
                        if (product && product.destination) {
                            actualDestination = product.destination;

                            if (item.destination !== actualDestination) {
                                log.warn(`🔄 Destination o'zgardi: "${item.name}" - Old: ${item.destination} → New: ${actualDestination}`);
                            }
                        } else {
                            log.warn(`⚠️ Taom bazadan topilmadi yoki destination yo'q: "${item.name}", Default ishlatilmoqda`);
                            actualDestination = getDefaultKitchen();
                        }
                    } catch (dbErr) {
                        log.error(`Taom destination olishda xato: ${item.name}`, dbErr);
                        actualDestination = getDefaultKitchen();
                    }

                    insertStmt.run(tableId, item.name, item.price, item.qty, actualDestination);
                    additionalTotal += (item.price * item.qty);

                    validatedItems.push({
                        name: item.name,
                        product_name: item.name,
                        price: item.price,
                        qty: item.qty,
                        quantity: item.qty,
                        destination: actualDestination
                    });
                }

                const currentTable = db.prepare('SELECT total_amount, waiter_id, waiter_name, status FROM tables WHERE id = ?').get(tableId);
                const newTotal = (currentTable ? currentTable.total_amount : 0) + additionalTotal;
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const isOrphan = !currentTable.waiter_id || currentTable.waiter_id === 0;
                const isUnknown = currentTable.waiter_name === "Noma'lum" || currentTable.waiter_name === "Kassir";
                const isFree = currentTable.status === 'free';

                if (isFree || isOrphan || isUnknown) {
                    db.prepare(`UPDATE tables SET status = 'occupied', total_amount = ?, start_time = COALESCE(start_time, ?), waiter_id = ?, waiter_name = ? WHERE id = ?`)
                        .run(newTotal, time, waiterId, waiterName, tableId);
                } else {
                    db.prepare(`UPDATE tables SET total_amount = ? WHERE id = ?`)
                        .run(newTotal, tableId);
                }

                return validatedItems;
            });

            const validatedItems = addBulkTransaction(items);
            notify('tables', null);
            notify('table-items', tableId);

            setTimeout(async () => {
                try {
                    const freshTable = db.prepare('SELECT name, waiter_name FROM tables WHERE id = ?').get(tableId);
                    const tableName = freshTable ? freshTable.name : "Stol";
                    const nameToPrint = (waiterName && waiterName !== "Noma'lum") ? waiterName : (freshTable.waiter_name || "Kassir");

                    log.info(`📄 Printer uchun tayyor: ${validatedItems.length} ta taom, Check #${checkNumber}`);
                    await printerService.printKitchenTicket(validatedItems, tableName, checkNumber, nameToPrint);
                } catch (printErr) {
                    log.error("Oshxona printeri xatosi:", printErr);
                    notify('printer-error', `Oshxona printeri: ${printErr.message}`);
                }
            }, 100);

            return validatedItems;
        } catch (err) {
            log.error("addBulkItems xatosi:", err);
            throw err;
        }
    },

    printCheck: async (tableId) => {
        try {
            const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
            if (!table) {
                throw new Error('Stol topilmadi');
            }

            const items = db.prepare('SELECT * FROM order_items WHERE table_id = ?').all(tableId);
            if (items.length === 0) {
                throw new Error('Buyurtmalar mavjud emas');
            }

            const checkNumber = getOrCreateCheckNumber(tableId);

            const settingsRows = db.prepare('SELECT * FROM settings').all();
            const settings = settingsRows.reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});

            const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const guestsCount = table.guests || 0;

            let service = 0;
            const svcValue = Number(settings.serviceChargeValue) || 0;

            if (settings.serviceChargeType === 'percent') {
                service = (subtotal * svcValue) / 100;
            } else {
                service = guestsCount * svcValue;
            }

            const total = subtotal + service;

            await printerService.printBill({
                checkNumber,
                tableName: table.name,
                waiterName: table.waiter_name || 'Ofitsiant',
                items,
                subtotal,
                service,
                total
            });

            db.prepare("UPDATE tables SET status = 'payment' WHERE id = ?").run(tableId);
            notify('tables', null);

            log.info(`HISOB chop etildi: Stol #${tableId}, Check #${checkNumber}`);
            return { success: true, checkNumber };

        } catch (err) {
            log.error("printCheck xatosi:", err);
            notify('printer-error', `HISOB chiqarishda xato: ${err.message}`);
            throw err;
        }
    },

    checkout: async (data) => {
        const { tableId, total, subtotal, discount, paymentMethod, customerId, items, dueDate, paymentDetails } = data;
        const date = new Date().toISOString();

        try {
            let checkNumber = 0;
            let waiterName = "";
            let guestCount = 0;

            const performCheckout = db.transaction(() => {
                const activeShift = shiftController.getShiftStatus(); // YANGI: Smena ID ni olish
                if (!activeShift) throw new Error("Smena ochilmagan!");

                const table = db.prepare('SELECT current_check_number, waiter_name, guests FROM tables WHERE id = ?').get(tableId);
                checkNumber = table ? table.current_check_number : 0;
                waiterName = table ? table.waiter_name : "Kassir";
                guestCount = table ? table.guests : 0;

                // Prepare items_json with payment details if split payment
                let itemsJson;
                if (paymentMethod === 'split' && paymentDetails) {
                    // Include payment details in the JSON
                    itemsJson = JSON.stringify({
                        items: items,
                        paymentDetails: paymentDetails
                    });
                } else {
                    itemsJson = JSON.stringify(items);
                }

                db.prepare(`INSERT INTO sales (date, total_amount, subtotal, discount, payment_method, customer_id, items_json, check_number, waiter_name, guest_count, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(date, total, subtotal, discount, paymentMethod, customerId, itemsJson, checkNumber, waiterName, guestCount, activeShift.id);

                // Handle debt for split payments
                if (paymentMethod === 'split' && paymentDetails && customerId) {
                    // Check if any payment is debt type
                    const debtPayments = paymentDetails.filter(p => p.method === 'debt');
                    if (debtPayments.length > 0) {
                        const totalDebt = debtPayments.reduce((sum, p) => sum + p.amount, 0);

                        db.prepare('UPDATE customers SET debt = debt + ? WHERE id = ?').run(totalDebt, customerId);
                        db.prepare('INSERT INTO debt_history (customer_id, amount, type, date, comment) VALUES (?, ?, ?, ?, ?)').run(customerId, totalDebt, 'debt', date, `Savdo #${checkNumber} (${waiterName}) - Split`);

                        // Insert each debt into customer_debts
                        debtPayments.forEach(debtPayment => {
                            db.prepare('INSERT INTO customer_debts (customer_id, amount, due_date, is_paid, created_at) VALUES (?, ?, ?, ?, ?)').run(customerId, debtPayment.amount, debtPayment.dueDate, 0, date);
                        });
                    }
                } else if (paymentMethod === 'debt' && customerId) {
                    // Original debt handling for single payment
                    db.prepare('UPDATE customers SET debt = debt + ? WHERE id = ?').run(total, customerId);
                    db.prepare('INSERT INTO debt_history (customer_id, amount, type, date, comment) VALUES (?, ?, ?, ?, ?)').run(customerId, total, 'debt', date, `Savdo #${checkNumber} (${waiterName})`);

                    // YANGI: customer_debts jadvaliga qarz yozish
                    db.prepare('INSERT INTO customer_debts (customer_id, amount, due_date, is_paid, created_at) VALUES (?, ?, ?, ?, ?)').run(customerId, total, dueDate, 0, date);
                }

                if (customerId) {
                    const customer = db.prepare('SELECT type, value, balance FROM customers WHERE id = ?').get(customerId);
                    if (customer && customer.type === 'cashback' && customer.value > 0) {
                        const cashbackAmount = (total * customer.value) / 100;
                        db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(cashbackAmount, customerId);
                    }
                }

                db.prepare('DELETE FROM order_items WHERE table_id = ?').run(tableId);
                db.prepare("UPDATE tables SET status = 'free', guests = 0, start_time = NULL, total_amount = 0, current_check_number = 0, waiter_id = 0, waiter_name = NULL WHERE id = ?").run(tableId);
            });

            const res = performCheckout();

            notify('tables', null);
            notify('sales', null);
            if (customerId) notify('customers', null);

            setTimeout(async () => {
                try {
                    const tableName = db.prepare('SELECT name FROM tables WHERE id = ?').get(tableId)?.name || "Stol";
                    const service = total - (subtotal - discount);

                    await printerService.printOrderReceipt({
                        checkNumber,
                        tableName,
                        waiterName,
                        items,
                        subtotal,
                        total,
                        discount,
                        service,
                        paymentMethod,
                        paymentDetails // Pass payment details for split payment receipts
                    });
                } catch (err) {
                    log.error("Kassa printeri xatosi:", err);
                    notify('printer-error', `Kassa printeri: ${err.message}`);
                }
            }, 100);
            return res;
        } catch (err) {
            log.error("Checkout xatosi:", err);
            throw err;
        }
    },

    getSales: (startDate, endDate) => {
        try {
            if (!startDate || !endDate) {
                return db.prepare('SELECT * FROM sales ORDER BY date DESC LIMIT 100').all();
            }

            const query = `
            SELECT * FROM sales 
            WHERE datetime(date, 'localtime') >= datetime(?) 
              AND datetime(date, 'localtime') <= datetime(?)
            ORDER BY date DESC
        `;

            const sales = db.prepare(query).all(startDate, endDate);

            log.info(`getSales: ${startDate} dan ${endDate} gacha ${sales.length} ta savdo topildi`);
            return sales;

        } catch (err) {
            log.error("getSales xatosi:", err);
            throw err;
        }
    },

    cancelOrder: (tableId) => {
        try {
            const cancelTransaction = db.transaction(() => {
                // 1. O'chirilayotgan narsalarni olish
                const items = db.prepare('SELECT * FROM order_items WHERE table_id = ?').all(tableId);
                const table = db.prepare('SELECT waiter_name, total_amount, name FROM tables WHERE id = ?').get(tableId);

                if (items.length > 0) {
                    // 2. Bekor qilinganlar ro'yxatiga qo'shish
                    const cancelledData = {
                        table_id: tableId,
                        date: new Date().toISOString(),
                        total_amount: table ? table.total_amount : 0,
                        waiter_name: table ? table.waiter_name : "Noma'lum",
                        items_json: JSON.stringify(items),
                        reason: "Kassir tomonidan o'chirildi"
                    };

                    db.prepare(`INSERT INTO cancelled_orders (table_id, date, total_amount, waiter_name, items_json, reason) VALUES (?, ?, ?, ?, ?, ?)`).run(
                        cancelledData.table_id, cancelledData.date, cancelledData.total_amount, cancelledData.waiter_name, cancelledData.items_json, cancelledData.reason
                    );
                }

                // 3. Tozalash
                db.prepare('DELETE FROM order_items WHERE table_id = ?').run(tableId);
                db.prepare("UPDATE tables SET status = 'free', guests = 0, start_time = NULL, total_amount = 0, current_check_number = 0, waiter_id = 0, waiter_name = NULL WHERE id = ?").run(tableId);
            });

            cancelTransaction();
            notify('tables', null);
            notify('table-items', tableId);
            log.info(`Stol #${tableId} buyurtmasi bekor qilindi va arxivlandi`);
            return { success: true };
        } catch (err) {
            log.error("Order cancel error:", err);
            throw err;
        }
    },

    getCancelledOrders: (startDate, endDate) => {
        try {
            if (!startDate || !endDate) {
                return db.prepare('SELECT * FROM cancelled_orders ORDER BY date DESC LIMIT 100').all();
            }
            const query = `
            SELECT * FROM cancelled_orders 
            WHERE datetime(date, 'localtime') >= datetime(?) 
              AND datetime(date, 'localtime') <= datetime(?)
            ORDER BY date DESC
            `;
            return db.prepare(query).all(startDate, endDate);
        } catch (err) {
            log.error("getCancelledOrders xatosi:", err);
            throw err;
        }
    },

    getSalesTrend: () => {
        try {
            // Oxirgi 30 kunlik statistika
            const query = `
                SELECT 
                    strftime('%Y-%m-%d', date) as day, 
                    SUM(total_amount) as total 
                FROM sales 
                WHERE date(date) >= date('now', '-30 days') 
                GROUP BY strftime('%Y-%m-%d', date) 
                ORDER BY day ASC
            `;
            const results = db.prepare(query).all();
            return results;
        } catch (err) {
            log.error("getSalesTrend xatosi:", err);
            return [];
        }
    }
};
