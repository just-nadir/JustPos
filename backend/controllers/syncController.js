const { Pool } = require('pg');
// Assuming db connection is setup
const pool = new Pool(); // Config irrelevant for logic

const TABLES = ['products', 'categories', 'customers', 'sales', 'users', 'settings']; // Add all

exports.pushChanges = async (req, res) => {
    const client = await pool.connect();
    const { changes, store_id } = req.body;

    try {
        await client.query('BEGIN');

        for (const change of changes) {
            const { table, record_id, action, data } = change;

            // Security whitelist check for table name
            if (!TABLES.includes(table)) continue;

            if (action === 'DELETE') {
                // Soft Delete
                await client.query(
                    `UPDATE ${table} SET deleted_at = extract(epoch from now()) * 1000, updated_at = extract(epoch from now()) * 1000 WHERE server_id = $1 AND store_id = $2`,
                    [record_id, store_id]
                );
            } else if (action === 'INSERT' || action === 'UPDATE') {
                // Upsert
                // Remove id, map others
                const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'is_synced' && k !== 'updated_at');
                const values = keys.map(k => data[k]);

                // Add store_id, server_id, updated_at
                const colNames = [...keys, 'store_id', 'server_id', 'updated_at'].join(', ');
                const placeholders = [...keys.map((_, i) => `$${i + 1}`), `$${keys.length + 1}`, `$${keys.length + 2}`, `$${keys.length + 3}`].join(', ');

                const updateSet = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

                // PostGres UPSERT
                await client.query(
                    `INSERT INTO ${table} (${colNames}) 
                     VALUES (${placeholders})
                     ON CONFLICT (server_id) 
                     DO UPDATE SET ${updateSet}, updated_at = $${keys.length + 3}, deleted_at = NULL`,
                    [...values, store_id, record_id, Date.now()]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true });

        // Trigger Socket.io emission here
        // req.io.to(store_id).emit('data_update', { stored_at: Date.now() });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Push failed", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
};

exports.pullChanges = async (req, res) => {
    const { last_pulled_at, store_id } = req.query;
    const since = parseInt(last_pulled_at || 0);
    const client = await pool.connect();

    try {
        let allChanges = [];
        const serverTime = Date.now();

        // 1. Fetch updates from all tables
        for (const table of TABLES) {
            const query = `
                SELECT *, 
                CASE WHEN deleted_at IS NOT NULL THEN 'DELETE' ELSE 'UPDATE' END as action,
                server_id as record_id
                FROM ${table} 
                WHERE store_id = $1 AND updated_at > $2
            `;
            const result = await client.query(query, [store_id, since]);

            const tableChanges = result.rows.map(row => ({
                table: table,
                record_id: row.record_id,
                action: row.action, // Computed 'DELETE' logic
                data: row // Send full row
            }));

            allChanges = allChanges.concat(tableChanges);
        }

        res.json({
            success: true,
            server_time: serverTime,
            changes: allChanges
        });

    } catch (e) {
        console.error("Pull failed", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
};
