-- SQL Script for Video Call Integration with External Website
-- Run this script in your phpMyAdmin or MySQL database

-- Table for storing external users for video calling
CREATE TABLE IF NOT EXISTS `video_call_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `external_user_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `avatar` text,
  `source` varchar(50) DEFAULT 'external_website',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_external_user` (`external_user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for tracking user online status
CREATE TABLE IF NOT EXISTS `user_online_status` (
  `user_id` int(11) NOT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `socket_id` varchar(100) DEFAULT NULL,
  `last_seen` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `video_call_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for storing video call sessions
CREATE TABLE IF NOT EXISTS `video_call_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `caller_id` int(11) NOT NULL,
  `callee_id` int(11) NOT NULL,
  `room_id` varchar(50) NOT NULL,
  `status` enum('pending','active','ended','rejected','missed') DEFAULT 'pending',
  `started_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `ended_at` timestamp NULL DEFAULT NULL,
  `duration` int(11) DEFAULT 0,
  `call_quality` enum('excellent','good','fair','poor') DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_room` (`room_id`),
  KEY `idx_caller` (`caller_id`),
  KEY `idx_callee` (`callee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_started_at` (`started_at`),
  FOREIGN KEY (`caller_id`) REFERENCES `video_call_users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`callee_id`) REFERENCES `video_call_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for call notifications
CREATE TABLE IF NOT EXISTS `call_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('incoming_call','missed_call','call_ended','call_accepted','call_rejected') NOT NULL,
  `data` json DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `video_call_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for call analytics (optional)
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

-- Insert sample data (optional - remove in production)
-- INSERT INTO `video_call_users` (`external_user_id`, `username`, `email`, `avatar`) VALUES
-- (1, 'John Doe', 'john@example.com', 'https://example.com/avatar1.jpg'),
-- (2, 'Jane Smith', 'jane@example.com', 'https://example.com/avatar2.jpg');

-- Indexes for better performance
CREATE INDEX `idx_call_sessions_caller_status` ON `video_call_sessions` (`caller_id`, `status`);
CREATE INDEX `idx_call_sessions_callee_status` ON `video_call_sessions` (`callee_id`, `status`);
CREATE INDEX `idx_notifications_user_unread` ON `call_notifications` (`user_id`, `is_read`);

-- Views for easier querying
CREATE OR REPLACE VIEW `active_calls` AS
SELECT 
  vcs.id,
  vcs.room_id,
  vcs.started_at,
  caller.username AS caller_username,
  caller.avatar AS caller_avatar,
  callee.username AS callee_username,
  callee.avatar AS callee_avatar,
  TIMESTAMPDIFF(SECOND, vcs.started_at, NOW()) AS duration_seconds
FROM video_call_sessions vcs
JOIN video_call_users caller ON vcs.caller_id = caller.id
JOIN video_call_users callee ON vcs.callee_id = callee.id
WHERE vcs.status = 'active';

CREATE OR REPLACE VIEW `user_call_history` AS
SELECT 
  vcs.id,
  vcs.room_id,
  vcs.status,
  vcs.started_at,
  vcs.ended_at,
  vcs.duration,
  caller.id AS caller_id,
  caller.username AS caller_username,
  caller.avatar AS caller_avatar,
  callee.id AS callee_id,
  callee.username AS callee_username,
  callee.avatar AS callee_avatar,
  CASE 
    WHEN vcs.caller_id = caller.id THEN 'outgoing'
    ELSE 'incoming'
  END AS call_direction
FROM video_call_sessions vcs
JOIN video_call_users caller ON vcs.caller_id = caller.id
JOIN video_call_users callee ON vcs.callee_id = callee.id
ORDER BY vcs.started_at DESC;

-- Stored procedures for common operations
DELIMITER //

CREATE OR REPLACE PROCEDURE GetUserCallStats(IN user_id INT)
BEGIN
  SELECT 
    COUNT(*) as total_calls,
    SUM(CASE WHEN status = 'ended' THEN 1 ELSE 0 END) as successful_calls,
    SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed_calls,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_calls,
    AVG(duration) as avg_call_duration,
    MAX(started_at) as last_call_time
  FROM video_call_sessions 
  WHERE caller_id = user_id OR callee_id = user_id;
END //

CREATE OR REPLACE PROCEDURE CleanupExpiredNotifications()
BEGIN
  DELETE FROM call_notifications 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END //

DELIMITER ;

-- Event to cleanup expired notifications (run every hour)
CREATE EVENT IF NOT EXISTS cleanup_notifications
ON SCHEDULE EVERY 1 HOUR
DO
  CALL CleanupExpiredNotifications();

-- Comments for documentation
ALTER TABLE `video_call_users` COMMENT = 'Stores user information for video call integration';
ALTER TABLE `user_online_status` COMMENT = 'Tracks real-time online status of users';
ALTER TABLE `video_call_sessions` COMMENT = 'Stores video call session data and history';
ALTER TABLE `call_notifications` COMMENT = 'Manages call-related notifications for users';
ALTER TABLE `call_analytics` COMMENT = 'Stores call analytics and events for reporting';
