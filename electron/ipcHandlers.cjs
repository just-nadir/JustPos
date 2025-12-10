const { app } = require('electron');
const { db, notify } = require('./database.cjs');
const log = require('electron-log');

// Controllerlarni import qilish
const tableController = require('./controllers/tableController.cjs');
const productController = require('./controllers/productController.cjs');
const orderController = require('./controllers/orderController.cjs');
const settingsController = require('./controllers/settingsController.cjs');
const staffController = require('./controllers/staffController.cjs');
const userController = require('./controllers/userController.cjs'); // Customers & Debtors
const smsController = require('./controllers/smsController.cjs');   // SMS Marketing
const licenseController = require('./controllers/licenseController.cjs'); // License System

function registerIpcHandlers(ipcMain) {

    // ==========================================
    // 1. AUTH (Tizimga kirish)
    // ==========================================
    ipcMain.handle('login', async (event, pin) => {
        try {
            return staffController.login(pin);
        } catch (error) {
            log.warn('Login failed:', error.message);
            throw error; // Frontendga xatoni qaytaramiz
        }
    });

    // ==========================================
    // 2. TABLES & HALLS (Zallar va Stollar)
    // ==========================================
    ipcMain.handle('get-halls', () => tableController.getHalls());
    ipcMain.handle('add-hall', (e, name) => tableController.addHall(name));
    ipcMain.handle('delete-hall', (e, id) => tableController.deleteHall(id));

    ipcMain.handle('get-tables', () => tableController.getTables());
    ipcMain.handle('get-tables-by-hall', (e, id) => tableController.getTablesByHall(id));
    ipcMain.handle('add-table', (e, { hallId, name }) => tableController.addTable(hallId, name));
    ipcMain.handle('delete-table', (e, id) => tableController.deleteTable(id));
    ipcMain.handle('update-table-status', (e, { id, status }) => tableController.updateTableStatus(id, status));

    // ==========================================
    // 3. MENU (Kategoriya va Mahsulotlar)
    // ==========================================
    ipcMain.handle('get-categories', () => productController.getCategories());
    ipcMain.handle('add-category', (e, name) => productController.addCategory(name));
    ipcMain.handle('update-category', (e, { id, name }) => productController.updateCategory(id, name));
    ipcMain.handle('delete-category', (e, id) => productController.deleteCategory(id));

    ipcMain.handle('get-products', () => productController.getProducts());
    ipcMain.handle('add-product', (e, product) => productController.addProduct(product));
    ipcMain.handle('toggle-product-status', (e, { id, status }) => productController.toggleProductStatus(id, status));
    ipcMain.handle('delete-product', (e, id) => productController.deleteProduct(id));

    // ==========================================
    // 4. ORDERS & CHECKOUT (Buyurtma va To'lov)
    // ==========================================
    ipcMain.handle('get-table-items', (e, tableId) => orderController.getTableItems(tableId));

    // Desktopdan buyurtma qo'shish (OrderSummary.jsx da ishlatilishi mumkin, lekin hozir asosan waiterapp da)
    // Agar OrderSummary da 'add-order-item' ishlatilayotgan bo'lsa:
    ipcMain.handle('add-order-item', (e, item) => orderController.addItem(item));

    // YANGI: HISOB chiqarish (Pre-check)
    ipcMain.handle('print-check', async (e, tableId) => {
        try {
            return await orderController.printCheck(tableId);
        } catch (error) {
            log.error('print-check xatosi:', error);
            throw error;
        }
    });

    ipcMain.handle('checkout', async (e, data) => {
        return await orderController.checkout(data);
    });

    // Hisobotlar uchun
    ipcMain.handle('get-sales', (e, { startDate, endDate }) => orderController.getSales(startDate, endDate));

    // ==========================================
    // 5. CUSTOMERS & DEBTORS (Mijozlar va Qarzdorlar)
    // ==========================================
    ipcMain.handle('get-customers', () => userController.getCustomers());
    ipcMain.handle('add-customer', (e, customer) => userController.addCustomer(customer));
    ipcMain.handle('delete-customer', (e, id) => userController.deleteCustomer(id));

    ipcMain.handle('get-debtors', () => userController.getDebtors());
    ipcMain.handle('get-debt-history', (e, id) => userController.getDebtHistory(id));
    ipcMain.handle('pay-debt', (e, { customerId, amount, comment }) => userController.payDebt(customerId, amount, comment));

    // ==========================================
    // 6. SETTINGS & STAFF (Sozlamalar va Xodimlar)
    // ==========================================
    ipcMain.handle('get-settings', () => settingsController.getSettings());
    ipcMain.handle('save-settings', (e, settings) => settingsController.saveSettings(settings));

    ipcMain.handle('get-kitchens', () => settingsController.getKitchens());
    ipcMain.handle('save-kitchen', (e, kitchen) => settingsController.saveKitchen(kitchen));
    ipcMain.handle('delete-kitchen', (e, id) => settingsController.deleteKitchen(id));

    ipcMain.handle('get-users', () => staffController.getUsers());
    ipcMain.handle('save-user', (e, user) => staffController.saveUser(user));
    ipcMain.handle('delete-user', (e, id) => staffController.deleteUser(id));

    ipcMain.handle('backup-db', () => settingsController.backupDB());

    // ==========================================
    // 7. SMS MARKETING (Yangi Modul)
    // ==========================================
    ipcMain.handle('get-sms-templates', () => smsController.getTemplates());

    // Frontend {type, content, ...} jo'natadi, Controller (type, text) kutadi
    ipcMain.handle('save-sms-template', (e, data) => smsController.updateTemplate(data.type, data.content));

    ipcMain.handle('get-sms-logs', () => smsController.getHistory());

    ipcMain.handle('send-mass-sms', async (e, { message, filter }) => {
        // Hozircha filter logikasi controller ichida oddiy broadcast
        return await smsController.sendBroadcast(message);
    });

    // ==========================================
    // 8. LICENSE SYSTEM (Litsenziya)
    // ==========================================
    ipcMain.handle('license-check', () => licenseController.checkLicense());
    ipcMain.handle('license-activate', (e, key) => licenseController.activateLicense(key));
}

module.exports = registerIpcHandlers;