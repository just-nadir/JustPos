const { db, notify } = require('../database.cjs');
const axios = require('axios');
const io = require('socket.io-client');
const log = require('electron-log');

const SYNC_INTERVAL = 60000; // 1 minute auto-sync

// Helper to get/set settings
const getSetting = (key) => {
    try {
        const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
        return row ? row.value : null;
    } catch (e) { return null; }
};

const setSetting = (key, value) => {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(key, value, value);
};

class SyncService {
    constructor() {
        this.isSyncing = false;
        this.socket = null;
        this.apiUrl = getSetting('cloud_api_url') || "http://localhost:3000/api";
        this.storeId = getSetting('store_id') || 'DEV-STORE';
        this.token = getSetting('api_token') || 'DEV-TOKEN';
    }

    init() {
        log.info("Initializing SyncService...");
        this.connectSocket();

        // Initial sync
        this.sync();

        // Periodic Sync
        setInterval(() => this.sync(), SYNC_INTERVAL);
    }

    connectSocket() {
        if (this.socket) return;

        log.info(`Connecting to Socket.io at ${this.apiUrl}`);
        this.socket = io(this.apiUrl, {
            auth: { token: this.token, storeId: this.storeId },
            reconnection: true,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            log.info("✅ Connected to Cloud Sync Server");
            this.pullChanges();
        });

        this.socket.on('data_update', (data) => {
            log.info("🔔 Received real-time update notification");
            this.pullChanges();
        });

        this.socket.on('connect_error', (err) => {
            // Quiet fail
        });
    }

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            await this.pushChanges();
            await this.pullChanges();
        } catch (error) {
            log.warn("Sync Cycle Error:", error.message);
        } finally {
            this.isSyncing = false;
        }
    }

    async pushChanges() {
        // 1. Get unprocessed queue items
        const queue = db.prepare("SELECT * FROM sync_queue WHERE is_processed = 0 ORDER BY id ASC LIMIT 50").all();
        if (queue.length === 0) return;

        log.info(`📤 Pushing ${queue.length} changes to cloud...`);

        // 2. Prepare payload
        const payload = queue.map(item => {
            let data = null;
            // For INSERT/UPDATE, fetch current row state
            if (item.action !== 'DELETE') {
                try {
                    const row = db.prepare(`SELECT * FROM ${item.table_name} WHERE server_id = ?`).get(item.record_id);
                    data = row || null; // If null (deleted meanwhile?), treat as delete?
                } catch (e) {
                    log.warn(`Could not fetch data for ${item.table_name}:${item.record_id}`);
                }
            }
            return {
                queue_id: item.id,
                table: item.table_name,
                record_id: item.record_id,
                action: item.action,
                data: data,
                occurred_at: item.created_at
            };
        });

        // 3. Send
        try {
            // Simulated endpoint structure
            const res = await axios.post(`${this.apiUrl}/sync/push`,
                { changes: payload, store_id: this.storeId },
                { headers: { Authorization: `Bearer ${this.token}` } }
            );

            if (res.data.success) {
                // 4. Mark processed
                const ids = queue.map(q => q.id);
                // Mark processed AND remove from queue to keep it clean (or just keep last 1000)
                // Here we just delete for simplicity
                const placeholders = ids.map(() => '?').join(',');
                db.prepare(`DELETE FROM sync_queue WHERE id IN (${placeholders})`).run(...ids);

                // Also update local `is_synced` to 1 for these records
                queue.forEach(q => {
                    if (q.action !== 'DELETE') {
                        try {
                            db.prepare(`UPDATE ${q.table_name} SET is_synced = 1 WHERE server_id = ?`).run(q.record_id);
                        } catch (e) { }
                    }
                });

                log.info(`✅ Pushed ${queue.length} changes successfully.`);

                // If we filled the batch, try pushing again immediately
                if (queue.length === 50) setImmediate(() => this.pushChanges());
            }
        } catch (e) {
            throw new Error(`Push failed: ${e.message}`);
        }
    }

    async pullChanges() {
        const lastPulledAt = getSetting('last_pulled_at') || 0;

        try {
            const res = await axios.get(`${this.apiUrl}/sync/pull`, {
                params: { last_pulled_at: lastPulledAt, store_id: this.storeId },
                headers: { Authorization: `Bearer ${this.token}` }
            });

            const { changes, server_time } = res.data;
            if (!changes || changes.length === 0) {
                setSetting('last_pulled_at', server_time);
                return;
            }

            log.info(`📥 Pulling ${changes.length} updates from cloud...`);

            // Apply updates in a transaction
            const transaction = db.transaction((updates) => {
                updates.forEach(change => {
                    const { table, record_id, action, data } = change;

                    try {
                        if (action === 'DELETE') {
                            db.prepare(`DELETE FROM ${table} WHERE server_id = ?`).run(record_id);
                        } else {
                            const existing = db.prepare(`SELECT id FROM ${table} WHERE server_id = ?`).get(record_id);

                            // Prepare columns (exclude id, ignore invalid cols)
                            // We can use PRAGMA to check cols, but assuming data matches schema
                            const dataKeys = Object.keys(data).filter(k => k !== 'id' && k !== 'is_synced' && k !== 'updated_at');

                            if (existing) {
                                const setClause = dataKeys.map(k => `${k} = @${k}`).join(', ');
                                db.prepare(`UPDATE ${table} SET ${setClause}, is_synced = 1, updated_at = @updated_at WHERE id = @id`)
                                    .run({ ...data, updated_at: server_time, id: existing.id });
                            } else {
                                const cols = [...dataKeys, 'server_id', 'is_synced', 'updated_at'];
                                const vals = [...dataKeys.map(k => `@${k}`), '@server_id', '1', '@updated_at'];
                                db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')})`)
                                    .run({ ...data, server_id: record_id, updated_at: server_time });
                            }
                        }
                    } catch (err) {
                        log.error(`Failed to apply sync for ${table}:${record_id}`, err);
                    }
                });
            });

            transaction(changes);
            setSetting('last_pulled_at', server_time);
            notify('remote_update_applied'); // Notify frontend

            log.info("✅ Sync Pull Complete.");

        } catch (e) {
            throw new Error(`Pull failed: ${e.message}`);
        }
    }
}

module.exports = new SyncService();
