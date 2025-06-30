-- Video Call Integration - Database Migration Script Fixed
-- Chỉ thêm các indexes cần thiết cho tables hiện có

USE video_call_database;

-- Chỉ tạo indexes cho columns thực sự tồn tại
CREATE INDEX `idx_taikhoan_email` ON `taikhoan`(`Email`);
CREATE INDEX `idx_taikhoan_tendangnhap` ON `taikhoan`(`TenDangNhap`);

-- Kiểm tra và tạo các indexes cho video call tables
CREATE INDEX `idx_video_call_sessions_user_id` ON `video_call_sessions`(`user_id`);
CREATE INDEX `idx_video_call_sessions_status` ON `video_call_sessions`(`status`);
CREATE INDEX `idx_video_call_sessions_created_at` ON `video_call_sessions`(`created_at`);

CREATE INDEX `idx_user_online_status_user_id` ON `user_online_status`(`user_id`);
CREATE INDEX `idx_user_online_status_is_online` ON `user_online_status`(`is_online`);

-- Insert sample online status cho users hiện tại
INSERT IGNORE INTO user_online_status (user_id, is_online, last_seen) 
SELECT Id, 0, NOW() FROM taikhoan;

-- Confirm migration completed
SELECT 'Video Call Integration Migration Completed Successfully' as status;
