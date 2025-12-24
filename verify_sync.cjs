const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'electron') {
        return {
            app: {
                isPackaged: false,
                getPath: () => './'
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

const { db, initDB } = require('./electron/database.cjs');

console.log("Initializing DB...");
initDB();

console.log("Testing Triggers...");
try {
    // 1. Insert
    const info = db.prepare("INSERT INTO products (name, price, category_id) VALUES ('Sync Test Prod', 500, 1)").run();
    console.log("Inserted Product ID:", info.lastInsertRowid);

    // 2. Check sync_queue
    const queueInsert = db.prepare("SELECT * FROM sync_queue WHERE table_name = 'products' AND record_id IS NOT NULL AND action = 'INSERT' ORDER BY id DESC LIMIT 1").get();

    if (queueInsert) {
        console.log("✅ INSERT Trigger Working. Queue Item:", queueInsert);
    } else {
        console.error("❌ INSERT Trigger Failed! No queue item found.");
    }

    // 3. Update
    // Get server_id first
    const product = db.prepare("SELECT * FROM products WHERE rowid = ?").get(info.lastInsertRowid);
    console.log("Product Server ID:", product.server_id); // Should be a UUID

    db.prepare("UPDATE products SET price = 600 WHERE id = ?").run(info.lastInsertRowid);

    const queueUpdate = db.prepare("SELECT * FROM sync_queue WHERE table_name = 'products' AND action = 'UPDATE' ORDER BY id DESC LIMIT 1").get();
    if (queueUpdate && queueUpdate.record_id === product.server_id) {
        console.log("✅ UPDATE Trigger Working. Queue Item:", queueUpdate);
    } else {
        console.error("❌ UPDATE Trigger Failed.");
    }

    // 4. Delete
    db.prepare("DELETE FROM products WHERE id = ?").run(info.lastInsertRowid);
    const queueDelete = db.prepare("SELECT * FROM sync_queue WHERE table_name = 'products' AND action = 'DELETE' ORDER BY id DESC LIMIT 1").get();
    if (queueDelete && queueDelete.record_id === product.server_id) {
        console.log("✅ DELETE Trigger Working. Queue Item:", queueDelete);
    } else {
        console.error("❌ DELETE Trigger Failed.");
    }

} catch (e) {
    console.error("Verification Error:", e);
}
