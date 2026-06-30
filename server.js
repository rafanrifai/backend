const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'uas_bu_andita_secret_key_2026';
const WA_ADMIN_NUMBER = process.env.WA_ADMIN_NUMBER || '6289603535193';

// Middleware
const allowedOrigins = [
  'https://rafanrifai.github.io',
  'http://localhost:5500',   // Live Server VS Code
  'http://localhost:3000',   // local dev fallback
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (jpeg, jpg, png, gif, webp) yang diperbolehkan'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Helper: Authenticate JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Akses ditolak: Token tidak ditemukan' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Akses ditolak: Token tidak valid' });
    req.user = user;
    next();
  });
};

// Helper: Verify Admin Role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Akses ditolak: Hanya untuk Admin' });
  }
};

// --- AUTHENTICATION ROUTES ---

// 1. Register Customer
app.post('/api/auth/register', async (req, res) => {
  const { nama, email, password } = req.body;
  if (!nama || !email || !password) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email sudah terdaftar' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    await db.query('INSERT INTO users (nama, email, password) VALUES (?, ?, ?)', [nama, email, hashedPassword]);
    
    res.status(201).json({ success: true, message: 'Registrasi berhasil' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. Login Customer
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Email atau password salah' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email atau password salah' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, nama: user.nama, email: user.email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, nama: user.nama, email: user.email, role: 'user' }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. Login Admin
app.post('/api/auth/admin/login', async (req, res) => {
  const { username, email, password } = req.body;
  const loginIdentifier = username || email; // Support both username and email
  
  if (!loginIdentifier || !password) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    const [admins] = await db.query('SELECT * FROM admins WHERE username = ?', [loginIdentifier]);
    if (admins.length === 0) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }

    // Generate token
    const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      success: true,
      token,
      admin: { id: admin.id, username: admin.username, role: 'admin' }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


// --- PRODUCTS ROUTES ---

// 4. Get All Products (support ?cari=keyword)
app.get('/api/products', async (req, res) => {
  const { cari } = req.query;
  try {
    let query = 'SELECT * FROM produk';
    let params = [];
    
    if (cari) {
      query += ' WHERE nama LIKE ?';
      params.push(`%${cari}%`);
    }

    const [products] = await db.query(query, params);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data produk' });
  }
});

// 5. Get Product by ID
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [products] = await db.query('SELECT * FROM produk WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    res.json(products[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil detail produk' });
  }
});

// 6. Create Product (Admin only) - with image upload
app.post('/api/products', authenticateToken, isAdmin, upload.single('gambar'), async (req, res) => {
  const { nama, harga, deskripsi } = req.body;
  
  if (!nama || !harga || !deskripsi) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  // Get uploaded file path or use provided gambar URL
  const gambar = req.file ? `/uploads/${req.file.filename}` : (req.body.gambar || '');
  
  if (!gambar) {
    return res.status(400).json({ message: 'Gambar produk harus diupload atau disediakan URL' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO produk (nama, harga, gambar, deskripsi) VALUES (?, ?, ?, ?)',
      [nama, harga, gambar, deskripsi]
    );
    res.status(201).json({ 
      success: true, 
      message: 'Produk berhasil ditambahkan', 
      id: result.insertId,
      gambar 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan produk' });
  }
});

// 7. Update Product (Admin only) - with image upload
app.put('/api/products/:id', authenticateToken, isAdmin, upload.single('gambar'), async (req, res) => {
  const { id } = req.params;
  const { nama, harga, deskripsi } = req.body;
  
  if (!nama || !harga || !deskripsi) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    const [check] = await db.query('SELECT * FROM produk WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    // Use new uploaded image if provided, otherwise keep existing or use body gambar
    let gambar;
    if (req.file) {
      gambar = `/uploads/${req.file.filename}`;
      // Delete old image if it was an uploaded file
      const oldGambar = check[0].gambar;
      if (oldGambar && oldGambar.startsWith('/uploads/')) {
        const oldPath = '.' + oldGambar;
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    } else {
      gambar = req.body.gambar || check[0].gambar;
    }

    await db.query(
      'UPDATE produk SET nama = ?, harga = ?, gambar = ?, deskripsi = ? WHERE id = ?',
      [nama, harga, gambar, deskripsi, id]
    );
    res.json({ success: true, message: 'Produk berhasil diubah', gambar });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengubah produk' });
  }
});

// 8. Delete Product (Admin only)
app.delete('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [check] = await db.query('SELECT * FROM produk WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    // Delete image file if it's an uploaded file
    const gambar = check[0].gambar;
    if (gambar && gambar.startsWith('/uploads/')) {
      const filePath = '.' + gambar;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.query('DELETE FROM produk WHERE id = ?', [id]);
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menghapus produk' });
  }
});


// --- CHECKOUT ROUTE ---

// 9. Process Checkout
app.post('/api/checkout', async (req, res) => {
  const { nama, alamat, cartItems, totalBelanja } = req.body;
  if (!nama || !alamat || !cartItems || cartItems.length === 0 || !totalBelanja) {
    return res.status(400).json({ message: 'Data checkout tidak lengkap' });
  }

  try {
    const tanggalSekarang = new Date();
    
    // Save to pesanan table
    const [orderResult] = await db.query(
      'INSERT INTO pesanan (nama_pelanggan, total_bayar, status, alamat, tanggal_pesan) VALUES (?, ?, ?, ?, ?)',
      [nama, totalBelanja, 'Pending', alamat, tanggalSekarang]
    );
    
    const orderId = orderResult.insertId;

    // Save details to pesanan_detail table
    let orderItemsText = '';
    for (const item of cartItems) {
      const subtotal = item.harga * item.qty;
      await db.query(
        'INSERT INTO pesanan_detail (pesanan_id, produk_id, nama_produk, harga, qty, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.id, item.nama, item.harga, item.qty, subtotal]
      );
      
      const priceFormatted = new Intl.NumberFormat('id-ID').format(item.harga);
      const subFormatted = new Intl.NumberFormat('id-ID').format(subtotal);
      orderItemsText += `• ${item.nama}\n  Harga: Rp${priceFormatted} x ${item.qty} = Rp${subFormatted}\n`;
    }

    // Construct WhatsApp message
    const totalFormatted = new Intl.NumberFormat('id-ID').format(totalBelanja);
    const rawMessage = `Halo Admin, saya ingin memesan:\n\n`
                     + `*Order ID:* #${orderId}\n`
                     + `------------------------------------\n`
                     + `${orderItemsText}`
                     + `------------------------------------\n`
                     + `*Total:* Rp${totalFormatted}\n\n`
                     + `*Pengiriman:*\n`
                     + `Nama: ${nama}\n`
                     + `Alamat: ${alamat}`;

    const waLink = `https://wa.me/${WA_ADMIN_NUMBER}?text=${encodeURIComponent(rawMessage)}`;

    res.status(201).json({
      success: true,
      message: 'Checkout berhasil',
      orderId,
      waLink
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memproses checkout' });
  }
});


// --- ADMIN SALES & ORDERS ROUTES (Admin only) ---

// 10. Get All Orders
app.get('/api/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM pesanan ORDER BY tanggal_pesan DESC');
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data pesanan' });
  }
});

// 11. Get Order details by ID (including items)
app.get('/api/orders/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [orders] = await db.query('SELECT * FROM pesanan WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const [details] = await db.query('SELECT * FROM pesanan_detail WHERE pesanan_id = ?', [id]);
    
    res.json({
      ...orders[0],
      items: details
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil detail pesanan' });
  }
});

// 12. Update Order Status
app.put('/api/orders/:id/status', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Pending', 'Selesai', 'Batal'
  
  if (!status) {
    return res.status(400).json({ message: 'Status tidak boleh kosong' });
  }

  try {
    const [check] = await db.query('SELECT id FROM pesanan WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    await db.query('UPDATE pesanan SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `Status pesanan berhasil diubah menjadi ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengubah status pesanan' });
  }
});

// 13. Daily Sales Report (revenue stats & list of items sold)
app.get('/api/reports/daily', authenticateToken, isAdmin, async (req, res) => {
  const { date } = req.query; // format: 'YYYY-MM-DD', defaults to today
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    // 1. Total revenue & transaction count
    const [totals] = await db.query(
      'SELECT SUM(total_bayar) as totalRevenue, COUNT(*) as transactionCount FROM pesanan WHERE DATE(tanggal_pesan) = ?',
      [targetDate]
    );

    // 2. Ordered products list with counts
    const [productsSold] = await db.query(
      `SELECT 
        pd.nama_produk as productName,
        SUM(pd.qty) as totalQty,
        pd.harga as unitPrice,
        SUM(pd.subtotal) as totalSubtotal
      FROM pesanan_detail pd
      JOIN pesanan p ON pd.pesanan_id = p.id
      WHERE DATE(p.tanggal_pesan) = ?
      GROUP BY pd.produk_id, pd.nama_produk, pd.harga
      ORDER BY totalQty DESC`,
      [targetDate]
    );

    // 3. Transactions list of the day
    const [orders] = await db.query(
      "SELECT *, DATE_FORMAT(tanggal_pesan, '%H:%i') as orderTime FROM pesanan WHERE DATE(tanggal_pesan) = ? ORDER BY tanggal_pesan DESC",
      [targetDate]
    );

    res.json({
      date: targetDate,
      totalRevenue: totals[0].totalRevenue || 0,
      transactionCount: totals[0].transactionCount || 0,
      productsSold,
      orders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menghasilkan laporan harian' });
  }
});


// --- USERS MANAGEMENT ROUTES (Admin only) ---

// 14. Get All Users
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, nama, email FROM users ORDER BY id DESC');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data pengguna' });
  }
});

// 15. Get User by ID
app.get('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await db.query('SELECT id, nama, email FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil detail pengguna' });
  }
});

// 16. Create User (Admin only)
app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
  const { nama, email, password } = req.body;
  
  if (!nama || !email || !password) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email sudah terdaftar' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (nama, email, password) VALUES (?, ?, ?)',
      [nama, email, hashedPassword]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Pengguna berhasil ditambahkan',
      id: result.insertId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan pengguna' });
  }
});

// 17. Update User (Admin only)
app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { nama, email, password } = req.body;
  
  if (!nama || !email) {
    return res.status(400).json({ message: 'Nama dan email harus diisi' });
  }

  try {
    const [check] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // Check if email already exists for other users
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email sudah digunakan oleh pengguna lain' });
    }

    // Update with or without password
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET nama = ?, email = ?, password = ? WHERE id = ?',
        [nama, email, hashedPassword, id]
      );
    } else {
      await db.query(
        'UPDATE users SET nama = ?, email = ? WHERE id = ?',
        [nama, email, id]
      );
    }
    
    res.json({ success: true, message: 'Pengguna berhasil diubah' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengubah pengguna' });
  }
});

// 18. Delete User (Admin only)
app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [check] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menghapus pengguna' });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
