const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'uas_bu_andita_secret_key_2026';
const WA_ADMIN_NUMBER = process.env.WA_ADMIN_NUMBER || '6289603535193';

// Middleware
app.use(cors());
app.use(express.json());

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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    const [admins] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
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

// 6. Create Product (Admin only)
app.post('/api/products', authenticateToken, isAdmin, async (req, res) => {
  const { nama, harga, gambar, deskripsi } = req.body;
  if (!nama || !harga || !gambar || !deskripsi) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO produk (nama, harga, gambar, deskripsi) VALUES (?, ?, ?, ?)',
      [nama, harga, gambar, deskripsi]
    );
    res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan produk' });
  }
});

// 7. Update Product (Admin only)
app.put('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { nama, harga, gambar, deskripsi } = req.body;
  
  if (!nama || !harga || !gambar || !deskripsi) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  try {
    const [check] = await db.query('SELECT id FROM produk WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    await db.query(
      'UPDATE produk SET nama = ?, harga = ?, gambar = ?, deskripsi = ? WHERE id = ?',
      [nama, harga, gambar, deskripsi, id]
    );
    res.json({ success: true, message: 'Produk berhasil diubah' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengubah produk' });
  }
});

// 8. Delete Product (Admin only)
app.delete('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [check] = await db.query('SELECT id FROM produk WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
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


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
