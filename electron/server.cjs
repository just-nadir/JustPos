const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { onChange } = require('./database.cjs'); // Signal
const ip = require('ip');
const path = require('path');

// OPTIMIZATSIYA: Simple in-memory cache
const cache = new Map();

function getCachedData(key, fetcher, ttl = 60000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }
  const data = fetcher();
  cache.set(key, { data, time: Date.now() });
  return data;
}

// Cache ni tozalash (har 5 daqiqada)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.time > 300000) { // 5 daqiqa
      cache.delete(key);
    }
  }
}, 300000);

// Controllerlar
const tableController = require('./controllers/tableController.cjs');
const productController = require('./controllers/productController.cjs');
const orderController = require('./controllers/orderController.cjs');
const settingsController = require('./controllers/settingsController.cjs');
const staffController = require('./controllers/staffController.cjs');

function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  // OPTIMIZATSIYA: Room-based broadcasting
  // Har bir hall uchun alohida room yaratamiz
  io.on('connection', (socket) => {
    console.log('📱 Yangi qurilma ulandi:', socket.id);

    // Client o'zining hallini ko'rsatishi mumkin
    socket.on('join-hall', (hallId) => {
      socket.join(`hall-${hallId}`);
      console.log(`🏛️ Socket ${socket.id} joined hall-${hallId}`);
    });

    // Barcha yangilanishlarni olish uchun (admin va hisobotlar)
    socket.on('join-global', () => {
      socket.join('global');
      console.log(`🌍 Socket ${socket.id} joined global updates`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Qurilma uzildi:', socket.id);
    });
  });

  // OPTIMIZATSIYA: Intelligent broadcasting
  // Faqat kerakli room'ga yuborish
  onChange((type, id) => {
    console.log(`📡 Update: ${type} ${id || ''}`);

    // Table yangilanishi - faqat tegishli hallga
    if (type === 'table' && id) {
      const table = tableController.getTables().find(t => t.id == id);
      if (table && table.hall_id) {
        io.to(`hall-${table.hall_id}`).emit('update', { type, id });
        io.to('global').emit('update', { type, id }); // Admin uchun
        return;
      }
    }

    // Boshqa barcha yangilanishlar - hammaga
    io.emit('update', { type, id });
  });

  // OPTIMIZATSIYA: Cache invalidation on DB changes
  // Ma'lumotlar o'zgarganda cache ni tozalash
  onChange((type, id) => {
    if (type === 'products' || type === 'categories') {
      cache.delete('products');
      cache.delete('categories');
    } else if (type === 'settings' || type === 'kitchens') {
      cache.delete('settings');
    }
  });

  // --- API ---

  // YANGI: LOGIN API
  app.post('/api/login', (req, res) => {
    try {
      const { pin } = req.body;
      const user = staffController.login(pin); // Bazadan tekshiramiz
      res.json(user);
    } catch (e) {
      res.status(401).json({ error: "Noto'g'ri PIN kod" });
    }
  });

  app.get('/api/halls', (req, res) => {
    try { res.json(tableController.getHalls()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/tables', (req, res) => {
    try { res.json(tableController.getTables()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/categories', (req, res) => {
    try {
      const categories = getCachedData('categories', () => productController.getCategories(), 120000);
      res.json(categories);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/products', (req, res) => {
    try {
      const products = getCachedData('products', () =>
        productController.getProducts().filter(p => p.is_active === 1),
        90000
      );
      res.json(products);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/tables/:id/items', (req, res) => {
    try { res.json(orderController.getTableItems(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/orders/add', (req, res) => {
    try {
      orderController.addItem(req.body);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- TUZATILGAN JOY ---
  app.post('/api/orders/bulk-add', (req, res) => {
    try {
      // waiterId ni qabul qilib olamiz
      const { tableId, items, waiterId } = req.body;

      if (!tableId || !items || !Array.isArray(items)) throw new Error("Noto'g'ri ma'lumot");

      // Controllerga waiterId ni ham yuboramiz
      orderController.addBulkItems(tableId, items, waiterId);

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  // ---------------------

  app.get('/api/settings', (req, res) => {
    try {
      const settings = getCachedData('settings', () => settingsController.getSettings(), 300000);
      res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/tables/guests', (req, res) => {
    try {
      const { tableId, count } = req.body;
      tableController.updateTableGuests(tableId, count);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Static fayllarni ulash (Dist papkasi)
  app.use(express.static(path.join(__dirname, '../dist')));

  // Barcha boshqa so'rovlar uchun index.html qaytarish (SPA uchun)
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });



  httpServer.listen(PORT, '0.0.0.0', () => {
    const localIp = ip.address();
    console.log(`============================================`);
    console.log(`📡 REAL-TIME SERVER: http://${localIp}:${PORT}`);
    console.log(`============================================`);
  });
}

module.exports = startServer;