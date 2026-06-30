-- SQL Schema for toko_online database
-- UAS Web Development Project

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for admins
-- ----------------------------
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Admin (Password: admin123)
INSERT INTO `admins` (`id`, `username`, `password`) VALUES
(1, 'admin', '$2y$10$gE3y6ZtqC6ZcEClWq0r8K.cEa.D8pWl8Hh3X46l66.G/n5.eWl1nK');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Customer (Password: customer123)
INSERT INTO `users` (`id`, `nama`, `email`, `password`) VALUES
(1, 'Rafan Rifai', 'rafan@gmail.com', '$2y$10$p0c15N2Y.nI3Lz31sYh6yOfxKxX7g3t5s5yS2g2G7gH9d.8B7n4C2');

-- ----------------------------
-- Table structure for produk
-- ----------------------------
DROP TABLE IF EXISTS `produk`;
CREATE TABLE `produk` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama` varchar(150) NOT NULL,
  `harga` int(11) NOT NULL,
  `gambar` varchar(255) NOT NULL,
  `deskripsi` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Products
INSERT INTO `produk` (`id`, `nama`, `harga`, `gambar`, `deskripsi`) VALUES
(1, 'Sepatu Sneakers Nike Retro', 750000, 'sepatu_nike.jpg', 'Sepatu Nike dengan desain retro klasik yang sangat nyaman digunakan untuk kegiatan sehari-hari maupun olahraga ringan. Terbuat dari bahan kulit sintetis premium dengan sirkulasi udara yang baik.'),
(2, 'Kaos Polo Shirt Premium', 185000, 'kaos_polo.jpg', 'Kaos Polo lengan pendek dengan bahan katun combed 30s berkualitas tinggi. Adem, lembut, menyerap keringat, dan sangat cocok dipadukan dengan gaya casual Anda sehari-hari.'),
(3, 'Jaket Bomber Canvas Navy', 320000, 'jaket_bomber.jpg', 'Jaket bomber dengan bahan canvas tebal dan furing di bagian dalam. Memiliki desain modern, tahan angin, cocok untuk digunakan berkendara atau hang out malam hari.'),
(4, 'Celana Chino Slim Fit Black', 225000, 'celana_chino.jpg', 'Celana Chino pria potongan Slim Fit dengan bahan katun twill stretch (melar). Sangat nyaman dipakai bergerak dan cocok untuk acara formal maupun semi-formal.');

-- ----------------------------
-- Table structure for pesanan
-- ----------------------------
DROP TABLE IF EXISTS `pesanan`;
CREATE TABLE `pesanan` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama_pelanggan` varchar(100) NOT NULL,
  `total_bayar` int(11) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Pending',
  `alamat` text NOT NULL,
  `tanggal_pesan` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Sample Orders
INSERT INTO `pesanan` (`id`, `nama_pelanggan`, `total_bayar`, `status`, `alamat`, `tanggal_pesan`) VALUES
(1, 'Budi Santoso', 935000, 'Selesai', 'Jl. Sudirman No. 45, Jakarta Selatan', '2026-06-28 10:15:30'),
(2, 'Siti Aminah', 185000, 'Pending', 'Kost Putri Asri, Jl. Margonda Raya No. 12, Depok', '2026-06-29 14:22:45'),
(3, 'Andi Wijaya', 320000, 'Batal', 'Jl. Merdeka No. 89, Bandung', '2026-06-30 09:05:12');

-- ----------------------------
-- Table structure for pesanan_detail
-- ----------------------------
DROP TABLE IF EXISTS `pesanan_detail`;
CREATE TABLE `pesanan_detail` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pesanan_id` int(11) NOT NULL,
  `produk_id` int(11) NOT NULL,
  `nama_produk` varchar(150) NOT NULL,
  `harga` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  `subtotal` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pesanan_detail_pesanan` (`pesanan_id`),
  CONSTRAINT `fk_pesanan_detail_pesanan` FOREIGN KEY (`pesanan_id`) REFERENCES `pesanan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Sample Order Details
INSERT INTO `pesanan_detail` (`id`, `pesanan_id`, `produk_id`, `nama_produk`, `harga`, `qty`, `subtotal`) VALUES
(1, 1, 1, 'Sepatu Sneakers Nike Retro', 750000, 1, 750000),
(2, 1, 2, 'Kaos Polo Shirt Premium', 185000, 1, 185000),
(3, 2, 2, 'Kaos Polo Shirt Premium', 185000, 1, 185000),
(4, 3, 3, 'Jaket Bomber Canvas Navy', 320000, 1, 320000);

SET FOREIGN_KEY_CHECKS = 1;
