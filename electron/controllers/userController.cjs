const { db, notify } = require('../database.cjs');

module.exports = {
  getCustomers: () => db.prepare('SELECT * FROM customers').all(),
  
  addCustomer: (c) => {
      const res = db.prepare('INSERT INTO customers (name, phone, type, value, balance, birthday, debt) VALUES (?, ?, ?, ?, ?, ?, 0)').run(c.name, c.phone, c.type, c.value, 0, c.birthday);
      notify('customers', null);
      return res;
  },
  
  deleteCustomer: (id) => {
      const res = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      notify('customers', null);
      return res;
  },

  getDebtors: () => {
      const query = `
          SELECT 
              c.*,
              MIN(CASE WHEN cd.is_paid = 0 THEN cd.due_date ELSE NULL END) as next_due_date
          FROM customers c
          LEFT JOIN customer_debts cd ON c.id = cd.customer_id
          WHERE c.debt > 0
          GROUP BY c.id
      `;
      return db.prepare(query).all();
  },
  
  getDebtHistory: (id) => db.prepare('SELECT * FROM debt_history WHERE customer_id = ? ORDER BY id DESC').all(id),
  
  payDebt: (customerId, amount, comment) => {
    const date = new Date().toISOString();
    const updateDebt = db.transaction(() => {
      db.prepare('UPDATE customers SET debt = debt - ? WHERE id = ?').run(amount, customerId);
      db.prepare('INSERT INTO debt_history (customer_id, amount, type, date, comment) VALUES (?, ?, ?, ?, ?)').run(customerId, amount, 'payment', date, comment);
    });
    const res = updateDebt();
    notify('customers', null);
    notify('debtors', null);
    return res;
  }
};