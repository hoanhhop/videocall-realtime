# 🎥 Video Call Integration Package

Gói tích hợp video call với dịch thuật thời gian thực vào website React hiện có.

## 📁 Cấu trúc thư mục

```
video-call-integration/
├── server/                    # Triển khai trên VM (https://34.142.175.163)
│   ├── controllers/           # API controllers
│   ├── middleware/            # Authentication middleware  
│   ├── routes/               # API routes
│   ├── websocket/            # WebSocket handlers
│   ├── adapters/             # Database adapter
│   ├── scripts/              # Deployment scripts
│   └── package.json          # Server dependencies
│
├── client-components/         # Copy vào React website
│   ├── components/           # React components
│   ├── styles/              # CSS styles
│   ├── package.json         # Client dependencies
│   └── README.md            # Integration guide
│
└── database/                 # Database setup
    ├── migration.sql        # Tạo bảng bổ sung
    └── setup.js            # Setup script
```

## 🗄️ Database Integration

### Sử dụng database hiện có:
- **Host**: localhost
- **User**: root  
- **Password**: (empty)
- **Database**: `hommy_database`

### Bảng hiện có (không thay đổi):
- `taikhoan` - Quản lý user accounts
- `cuochen` - Quản lý cuộc hẹn

### Bảng bổ sung cần tạo:
- `user_online_status` - Trạng thái online 
- `video_call_sessions` - Session video call
- `call_notifications` - Thông báo cuộc gọi

## 🚀 Hướng dẫn triển khai

### Bước 1: Triển khai Server trên VM
```bash
cd server/
npm install
npm run setup-database  # Tạo bảng bổ sung
npm run start           # Khởi động server
```

### Bước 2: Tích hợp Client vào React Website
```bash
cd client-components/
npm install             # Cài dependencies
# Copy components vào project React của bạn
```

### Bước 3: Cấu hình
1. Cấu hình URL server trong client components
2. Import và sử dụng components trong React app
3. Test video call functionality

## 📋 Tính năng

- ✅ Authentication với bảng `taikhoan` hiện có
- ✅ Video call 1-1 với WebRTC  
- ✅ Dịch thuật thời gian thực (Việt ↔ Anh)
- ✅ Chat text trong cuộc gọi
- ✅ Quản lý cuộc hẹn từ bảng `cuochen`
- ✅ Notification system
- ✅ Online status tracking
- ✅ Mobile responsive

## 🔧 API Endpoints

- `POST /api/auth/login` - Đăng nhập
- `GET /api/users/available` - Danh sách user online
- `POST /api/video-call/initiate` - Bắt đầu cuộc gọi
- `GET /api/appointments/upcoming` - Cuộc hẹn sắp tới
- `GET /api/notifications/unread` - Thông báo chưa đọc

## 🌐 WebSocket Events

- `user-connected` / `user-disconnected` - User join/leave
- `offer` / `answer` / `ice-candidate` - WebRTC signaling  
- `translation-result` - Kết quả dịch thuật
- `chat-message` - Tin nhắn chat
- `call-notification` - Thông báo cuộc gọi

## 📞 Liên hệ

- Support: [Your Contact Info]
- Documentation: [Your Docs URL]
