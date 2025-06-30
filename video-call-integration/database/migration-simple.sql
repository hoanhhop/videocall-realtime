-- Video Call Integration - Simple Migration Script
-- Chỉ tạo indexes cơ bản và data cần thiết

USE video_call_database;

-- Indexes cho video call sessions
CREATE INDEX `idx_video_call_sessions_caller` ON `video_call_sessions`(`caller_id`);
CREATE INDEX `idx_video_call_sessions_callee` ON `video_call_sessions`(`callee_id`);
CREATE INDEX `idx_video_call_sessions_status` ON `video_call_sessions`(`status`);
CREATE INDEX `idx_video_call_sessions_room` ON `video_call_sessions`(`room_id`);

-- Indexes cho user online status
CREATE INDEX `idx_user_online_status_user` ON `user_online_status`(`user_id`);

-- Insert sample online status cho users hiện có (nếu chưa có)
INSERT IGNORE INTO user_online_status (user_id, is_online, last_seen) 
SELECT Id, 0, NOW() FROM taikhoan;

-- Confirm migration completed
SELECT 'Video Call Integration Migration Completed Successfully' as result;
