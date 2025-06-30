-- Migration script để tạo các bảng bổ sung cho video call integration
-- Sử dụng với database standalone: video_call_database
-- Tạo tables độc lập cho video call integration

USE video_call_database;

-- Tạo bảng taikhoan cơ bản cho standalone mode
CREATE TABLE IF NOT EXISTS `taikhoan` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `TenDangNhap` varchar(255) NOT NULL,
  `MatKhau` varchar(255) NOT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `HoTen` varchar(255) DEFAULT NULL,
  `NgayTao` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `TenDangNhap` (`TenDangNhap`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tạo bảng cuochen cơ bản cho standalone mode
CREATE TABLE IF NOT EXISTS `cuochen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `taikhoan_id` int(11) NOT NULL,
  `tieu_de` varchar(255) NOT NULL,
  `noi_dung` text,
  `ngay_tao` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`taikhoan_id`) REFERENCES `taikhoan`(`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bảng trạng thái online của users (kết nối với taikhoan.Id)
CREATE TABLE IF NOT EXISTS `user_online_status` (
  `user_id` int(11) NOT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `last_seen` timestamp NULL DEFAULT NULL,
  `socket_id` varchar(255) DEFAULT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `taikhoan`(`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bảng session video call (kết nối với taikhoan.Id)
CREATE TABLE IF NOT EXISTS `video_call_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `caller_id` int(11) NOT NULL,
  `callee_id` int(11) NOT NULL,
  `room_id` varchar(255) NOT NULL,
  `status` enum('pending','active','ended','rejected') DEFAULT 'pending',
  `started_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `ended_at` timestamp NULL DEFAULT NULL,
  `duration` int(11) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_room` (`room_id`),
  KEY `idx_caller` (`caller_id`),
  KEY `idx_callee` (`callee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_started_at` (`started_at`),
  FOREIGN KEY (`caller_id`) REFERENCES `taikhoan`(`Id`) ON DELETE CASCADE,
  FOREIGN KEY (`callee_id`) REFERENCES `taikhoan`(`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bảng thông báo cuộc gọi (kết nối với taikhoan.Id)
CREATE TABLE IF NOT EXISTS `call_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `data` json DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `taikhoan`(`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bảng analytics cuộc gọi (optional)
CREATE TABLE IF NOT EXISTS `call_analytics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `event_data` json DEFAULT NULL,
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_timestamp` (`timestamp`),
  FOREIGN KEY (`session_id`) REFERENCES `video_call_sessions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes để tối ưu performance
CREATE INDEX `idx_taikhoan_status` ON `taikhoan`(`trangThai`);
CREATE INDEX `idx_taikhoan_email` ON `taikhoan`(`email`);
CREATE INDEX `idx_taikhoan_maTK` ON `taikhoan`(`maTK`);

-- Insert sample data (optional)
-- INSERT INTO user_online_status (user_id, is_online, last_seen) 
-- SELECT Id, 0, NOW() FROM taikhoan WHERE trangThai = 1;

-- Thông báo hoàn thành
SELECT 'Video call integration tables created successfully!' as message;
