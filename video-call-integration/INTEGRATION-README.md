# Video Call Integration System

Hệ thống tích hợp video call với translation cho website React hiện có.

## 📋 Tổng quan

Hệ thống này bao gồm:
- **Server-side components**: Triển khai trên VM (https://34.142.175.163)
- **Client-side React components**: Copy vào website React hiện có
- **Database integration**: Sử dụng database `hommy_database` hiện có

## 🚀 Cài đặt nhanh

### 1. Triển khai Server (VM) - Tự động

```bash
# Option 1: Deployment script (Linux/Mac)
chmod +x deployment/deploy-unified.sh
./deployment/deploy-unified.sh

# Option 2: PowerShell script (Windows)
./deployment/deploy-unified.ps1

# Option 3: Docker deployment
docker-compose -f docker-compose.integration.yml up -d
```

### 2. Triển khai Server (VM) - Thủ công

```bash
# 1. Copy files lên VM
rsync -avz video-call-integration/ root@34.142.175.163:/opt/video-call-integration/

# 2. Cài đặt dependencies
ssh root@34.142.175.163 "cd /opt/video-call-integration/server && npm install"

# 3. Setup database
ssh root@34.142.175.163 "cd /opt/video-call-integration && node database/setup.js"

# 4. Khởi chạy service
ssh root@34.142.175.163 "systemctl start video-call-integration"
```

### 3. Tích hợp Client Components

```bash
# 1. Copy client components vào React project
cp -r client-components/* /path/to/your/react/project/src/

# 2. Cài đặt dependencies
npm install socket.io-client axios

# 3. Import và sử dụng
import VideoCallIntegration from './components/VideoCallIntegration';
import './styles/video-call-integration.css';
```

### 4. Kiểm tra hệ thống

```bash
# Test deployment
chmod +x deployment/test-system.sh
./deployment/test-system.sh
```

## 📁 Cấu trúc thư mục

```
video-call-integration/
├── server/                          # Server components (deploy lên VM)
│   ├── adapters/
│   │   └── DatabaseAdapter.js       # Database operations
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT authentication
│   ├── controllers/
│   │   └── integrationController.js # API endpoints
│   ├── routes/
│   │   └── integrationRoutes.js    # Express routes
│   ├── websocket/
│   │   └── integrationSocketHandlers.js # WebSocket handlers
│   ├── integrationServer.js        # Main server
│   ├── package.json
│   └── Dockerfile
├── client-components/               # React components (copy vào website)
│   ├── hooks/
│   │   ├── useSocket.js            # Socket.IO hook
│   │   └── useWebRTC.js            # WebRTC hook
│   ├── utils/
│   │   ├── api.js                  # API client
│   │   └── helpers.js              # Utility functions
│   ├── components/
│   │   ├── AuthenticationComponent.jsx
│   │   ├── VideoCallComponent.jsx
│   │   ├── AppointmentManager.jsx
│   │   └── VideoCallIntegration.jsx
│   ├── styles/
│   │   └── video-call-integration.css
│   ├── config/
│   │   └── videoCallConfig.js      # Configuration
│   ├── examples/                   # Usage examples
│   │   ├── ExampleApp.jsx
│   │   ├── SimpleVideoCallExample.jsx
│   │   ├── AppointmentIntegrationExample.jsx
│   │   └── README.md
│   └── package.json
├── database/
│   ├── migration.sql               # Database setup
│   └── setup.js                   # Migration script
├── deployment/
│   ├── deploy-server.sh           # Server deployment (Linux)
│   ├── deploy-server.ps1          # Server deployment (Windows)
│   ├── deploy-unified.sh          # Unified system deployment
│   ├── deploy-unified.ps1         # Unified deployment (Windows)
│   ├── test-system.sh             # System testing
│   ├── test-system.ps1            # System testing (Windows)
│   └── .env.example               # Environment template
├── nginx/
│   └── nginx.conf                 # Nginx configuration
├── docker-compose.integration.yml  # Docker compose for integration
├── README.md                      # Main documentation
└── INTEGRATION-README.md          # This integration guide
```

## 🗄️ Database Integration

Hệ thống được thiết kế để tích hợp với database hiện tại mà không tạo database mới.

### Existing Tables (giữ nguyên)
- `taikhoan`: User accounts table
- `cuochen`: Appointments table

### New Tables (được thêm vào)
```sql
-- User online status
CREATE TABLE user_online_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES taikhoan(Id)
);

-- Video call sessions
CREATE TABLE video_call_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    caller_id INT NOT NULL,
    callee_id INT NOT NULL,
    appointment_id INT,
    status ENUM('pending', 'active', 'ended', 'cancelled') DEFAULT 'pending',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    FOREIGN KEY (caller_id) REFERENCES taikhoan(Id),
    FOREIGN KEY (callee_id) REFERENCES taikhoan(Id),
    FOREIGN KEY (appointment_id) REFERENCES cuochen(Id)
);

-- Call notifications
CREATE TABLE call_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    type ENUM('incoming_call', 'missed_call', 'call_ended') NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES taikhoan(Id)
);

-- Call analytics
CREATE TABLE call_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    duration_seconds INT,
    translation_used BOOLEAN DEFAULT FALSE,
    language_pair VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Video Calls
- `POST /api/calls/initiate` - Start a video call
- `POST /api/calls/:sessionId/join` - Join a video call
- `POST /api/calls/:sessionId/end` - End a video call
- `GET /api/calls/history` - Get call history
- `GET /api/calls/active` - Get active calls

### Appointments
- `GET /api/appointments` - Get user appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id/status` - Update user online status

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## 🔌 WebSocket Events

### Client → Server
- `join_room` - Join a room for real-time updates
- `leave_room` - Leave a room
- `call_user` - Initiate a call to another user
- `answer_call` - Answer an incoming call
- `reject_call` - Reject an incoming call
- `end_call` - End current call
- `ice_candidate` - WebRTC ICE candidate exchange
- `offer` - WebRTC offer exchange
- `answer` - WebRTC answer exchange

### Server → Client
- `user_online` - User came online
- `user_offline` - User went offline
- `incoming_call` - Incoming call notification
- `call_answered` - Call was answered
- `call_rejected` - Call was rejected
- `call_ended` - Call ended
- `ice_candidate` - WebRTC ICE candidate
- `offer` - WebRTC offer
- `answer` - WebRTC answer

## 📱 React Components Usage

### 1. Basic Video Call Integration

```jsx
import React from 'react';
import VideoCallIntegration from './components/VideoCallIntegration';
import './styles/video-call-integration.css';

function App() {
  const currentUser = {
    id: 1,
    ten: "Nguyen Van A",
    email: "user@example.com"
  };

  return (
    <div className="App">
      <VideoCallIntegration 
        currentUser={currentUser}
        apiBaseUrl="https://34.142.175.163:3001"
        socketUrl="https://34.142.175.163:3001"
        translationEnabled={true}
      />
    </div>
  );
}

export default App;
```

### 2. Appointment Integration

```jsx
import React from 'react';
import AppointmentManager from './components/AppointmentManager';

function AppointmentPage() {
  const currentUser = { id: 1, ten: "User Name" };

  return (
    <AppointmentManager 
      currentUser={currentUser}
      apiBaseUrl="https://34.142.175.163:3001"
      onCallStart={(appointmentId) => {
        console.log('Call started for appointment:', appointmentId);
      }}
    />
  );
}
```

### 3. Standalone Video Call Component

```jsx
import React from 'react';
import VideoCallComponent from './components/VideoCallComponent';

function VideoCallPage() {
  const handleCallEnd = (sessionData) => {
    console.log('Call ended:', sessionData);
  };

  return (
    <VideoCallComponent
      sessionId="unique-session-id"
      currentUser={{ id: 1, ten: "User" }}
      isInitiator={true}
      onCallEnd={handleCallEnd}
      translationEnabled={true}
    />
  );
}
```

## 🔒 Security Configuration

### JWT Authentication
```javascript
// In your React app
const token = localStorage.getItem('auth_token');
const api = new VideoCallAPI('https://34.142.175.163:3001', token);
```

### CORS Configuration
Server đã được cấu hình để accept requests từ domain của bạn:
```javascript
// In server/integrationServer.js
const allowedOrigins = [
  'https://your-domain.com',
  'http://localhost:3000',
  'https://34.142.175.163'
];
```

### SSL/HTTPS Setup
```bash
# Ensure SSL certificates are properly configured
sudo certbot --nginx -d your-domain.com
```

## 🌐 Translation System Integration

Hệ thống tích hợp với translation microservices hiện tại:

### API Gateway Integration
- Video call API routes được proxy qua API Gateway (port 5000)
- Translation requests được route tới translation services

### Socket.IO Integration
- Video call Socket.IO server (port 3001) hoạt động song song với translation Socket.IO (port 4000)
- Real-time translation data được chia sẻ giữa các services

### Service Communication
```javascript
// Translation service integration
const translationConfig = {
  apiGateway: 'http://localhost:5000',
  socketUrl: 'http://localhost:4000',
  services: {
    asr: 'phowhisper-asr',
    translation: 'translation-service',
    tts: 'tts-service',
    embeddings: 'embeddings-service'
  }
};
```

## 🐳 Docker Deployment

### Standalone Deployment
```bash
# Build and run video call service only
cd server
docker build -t video-call-integration .
docker run -p 3001:3001 video-call-integration
```

### Unified System Deployment
```bash
# Deploy with existing translation system
docker-compose -f docker-compose.integration.yml up -d
```

### Docker Compose Integration
```yaml
# Extends existing translation system
version: '3.8'
services:
  video-call-integration:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - DATABASE_HOST=localhost
      - DATABASE_USER=root
      - DATABASE_NAME=hommy_database
    depends_on:
      - mysql
    networks:
      - translation-network

networks:
  translation-network:
    external: true  # Uses existing translation network
```

## 🧪 Testing

### Unit Tests
```bash
cd server
npm test
```

### Integration Tests
```bash
# Test database connectivity
node database/setup.js --test

# Test API endpoints
curl -X GET https://34.142.175.163:3001/api/health

# Test WebSocket connection
node test/websocket-test.js
```

### System Health Check
```bash
./deployment/test-system.sh
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check MySQL service
systemctl status mysql

# Check database credentials
mysql -u root -p hommy_database
```

#### 2. Port Already in Use
```bash
# Check what's using port 3001
sudo netstat -tulpn | grep :3001

# Kill process if needed
sudo kill -9 <PID>
```

#### 3. WebRTC Connection Issues
```javascript
// Check STUN/TURN server configuration
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];
```

#### 4. Socket.IO Connection Failed
```javascript
// Check CORS and Socket.IO configuration
// Ensure client and server Socket.IO versions match
```

#### 5. Translation Service Integration
```bash
# Verify translation services are running
docker ps | grep translation
curl http://localhost:5000/health
```

### Debug Mode
```bash
# Run server in debug mode
NODE_ENV=development DEBUG=* node server/integrationServer.js
```

### Logs
```bash
# Check application logs
tail -f /var/log/video-call-integration.log

# Check Docker logs
docker logs video-call-integration
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX idx_user_online_status_user_id ON user_online_status(user_id);
CREATE INDEX idx_video_call_sessions_caller_id ON video_call_sessions(caller_id);
CREATE INDEX idx_video_call_sessions_callee_id ON video_call_sessions(callee_id);
CREATE INDEX idx_call_notifications_user_id ON call_notifications(user_id);
```

### Redis Caching (Optional)
```javascript
// Add Redis for session management
const redis = require('redis');
const client = redis.createClient();

// Cache user sessions
await client.setex(`user:${userId}:session`, 3600, sessionData);
```

### Load Balancing
```nginx
# Nginx load balancing for multiple instances
upstream video_call_backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

## 🚀 Production Deployment Checklist

- [ ] Database migrations applied
- [ ] SSL certificates configured
- [ ] Environment variables set
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring setup (optional)
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated

## 📞 Support

Nếu bạn gặp vấn đề trong quá trình tích hợp:

1. Kiểm tra logs trong `/var/log/video-call-integration.log`
2. Verify database connectivity và table structure
3. Test API endpoints với curl hoặc Postman
4. Check WebSocket connection trong browser console
5. Verify translation service integration

## 🔄 Updates và Maintenance

### Updating the System
```bash
# Pull latest changes
git pull origin main

# Update server
cd server && npm install
systemctl restart video-call-integration

# Update client components
cp -r client-components/* /path/to/your/react/project/src/
```

### Database Maintenance
```sql
-- Clean up old sessions
DELETE FROM video_call_sessions 
WHERE status = 'ended' AND end_time < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Clean up old notifications
DELETE FROM call_notifications 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

---

**Chúc bạn triển khai thành công! 🎉**

Hệ thống video call translation đã sẵn sàng để tích hợp vào website React hiện tại của bạn.
│   │   ├── SimpleVideoCallExample.jsx
│   │   ├── AppointmentIntegrationExample.jsx
│   │   └── README.md               # Usage guide
│   └── package.json
├── database/
│   ├── migration.sql               # Database schema
│   └── setup.js                   # Setup script
├── deployment/                     # Deployment tools
│   ├── deploy-unified.sh          # Unified deployment script
│   ├── deploy-unified.ps1         # PowerShell deployment
│   ├── deploy-server.sh           # Simple server deployment
│   ├── deploy-server.ps1          # PowerShell server deployment
│   ├── test-system.sh             # System test script
│   └── .env.example               # Environment template
├── nginx/
│   └── nginx.conf                 # Nginx configuration
├── docker-compose.integration.yml  # Docker setup for integration
└── INTEGRATION-README.md          # This file
```

## 🔧 Cấu hình

### Server Environment (.env)

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=hommy_database

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Server
PORT=3001
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://your-website.com,http://localhost:3000
```

### Client Configuration

```javascript
// src/config/videoCallConfig.js
export const VIDEO_CALL_CONFIG = {
  serverUrl: 'https://34.142.175.163:3001',
  wsUrl: 'wss://34.142.175.163:3001',
  apiTimeout: 10000,
  retryAttempts: 3
};
```

## 💻 Sử dụng

### 1. Tích hợp vào React App

```jsx
// App.js
import React from 'react';
import VideoCallIntegration from './components/VideoCallIntegration';
import './styles/video-call-integration.css';

function App() {
  return (
    <div className="App">
      {/* Existing components */}
      
      {/* Video Call Integration */}
      <VideoCallIntegration 
        userId={currentUser?.id}
        userName={currentUser?.name}
        userEmail={currentUser?.email}
      />
    </div>
  );
}
```

### 2. Sử dụng từng component riêng lẻ

```jsx
// Chỉ authentication
import AuthenticationComponent from './components/AuthenticationComponent';

// Chỉ video call
import VideoCallComponent from './components/VideoCallComponent';

// Chỉ appointment manager
import AppointmentManager from './components/AppointmentManager';
```

### 3. Custom hooks

```jsx
// Sử dụng WebRTC hook
import { useWebRTC } from './hooks/useWebRTC';

function CustomVideoCall() {
  const {
    localStream,
    remoteStreams,
    isConnected,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo
  } = useWebRTC('room-id');

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted />
      <button onClick={toggleAudio}>Toggle Audio</button>
      <button onClick={toggleVideo}>Toggle Video</button>
    </div>
  );
}
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/verify` - Xác thực token

### Users
- `GET /api/users/profile` - Lấy thông tin user
- `PUT /api/users/profile` - Cập nhật profile
- `GET /api/users/online` - Danh sách user online

### Video Calls
- `POST /api/video-calls/start` - Bắt đầu cuộc gọi
- `POST /api/video-calls/join` - Tham gia cuộc gọi
- `POST /api/video-calls/end` - Kết thúc cuộc gọi
- `GET /api/video-calls/history` - Lịch sử cuộc gọi

### Appointments
- `GET /api/appointments` - Lấy danh sách cuộc hẹn
- `POST /api/appointments` - Tạo cuộc hẹn mới
- `PUT /api/appointments/:id` - Cập nhật cuộc hẹn
- `DELETE /api/appointments/:id` - Xóa cuộc hẹn

## 🔄 WebSocket Events

### Client -> Server
- `join_room` - Tham gia phòng
- `leave_room` - Rời phòng
- `webrtc_offer` - Gửi WebRTC offer
- `webrtc_answer` - Gửi WebRTC answer
- `webrtc_ice_candidate` - Gửi ICE candidate
- `chat_message` - Gửi tin nhắn chat
- `translation_request` - Yêu cầu dịch

### Server -> Client
- `room_joined` - Đã tham gia phòng
- `user_joined` - User khác tham gia
- `user_left` - User khác rời đi
- `webrtc_offer` - Nhận WebRTC offer
- `webrtc_answer` - Nhận WebRTC answer
- `webrtc_ice_candidate` - Nhận ICE candidate
- `chat_message` - Nhận tin nhắn chat
- `translation_result` - Kết quả dịch

## 🗄️ Database Schema

### Bảng hiện có (KHÔNG thay đổi)
- `taikhoan` - Thông tin tài khoản
- `cuochen` - Thông tin cuộc hẹn

### Bảng mới (tự động tạo)
- `user_online_status` - Trạng thái online
- `video_call_sessions` - Phiên video call
- `call_notifications` - Thông báo cuộc gọi
- `call_analytics` - Thống kê cuộc gọi

## 🚀 Deployment

### 1. Deployment tự động (Khuyến nghị)

```bash
# Linux/Mac
chmod +x deployment/deploy-unified.sh
./deployment/deploy-unified.sh

# Windows PowerShell
.\deployment\deploy-unified.ps1
```

### 2. Docker Deployment

```bash
# Tích hợp với hệ thống translation hiện có
docker-compose -f docker-compose.integration.yml up -d

# Standalone deployment
docker-compose -f docker-compose.integration.yml up -d mysql video-call-integration nginx
```

### 3. Deployment thủ công

```bash
# 1. Chuẩn bị server
sudo mkdir -p /opt/video-call-integration
sudo chown $USER:$USER /opt/video-call-integration

# 2. Copy files
rsync -avz --exclude node_modules server/ root@34.142.175.163:/opt/video-call-integration/

# 3. Cài đặt trên server
ssh root@34.142.175.163 "cd /opt/video-call-integration && npm install"

# 4. Setup database
ssh root@34.142.175.163 "cd /opt/video-call-integration && npm run setup-database"

# 5. Khởi chạy service
ssh root@34.142.175.163 "cd /opt/video-call-integration && pm2 start integrationServer.js --name video-call-integration"
```

### 4. Kiểm tra deployment

```bash
# Test system
chmod +x deployment/test-system.sh
./deployment/test-system.sh

# Manual checks
curl -k https://34.142.175.163/video-call-api/health
systemctl status video-call-integration
systemctl status nginx
```

## 🔒 Bảo mật

- JWT authentication với expire time
- CORS configuration
- Rate limiting
- Input validation
- SQL injection protection
- XSS protection

## 🐛 Troubleshooting

### Lỗi kết nối database
```bash
# Kiểm tra MySQL service
sudo systemctl status mysql

# Kiểm tra database connection
mysql -u root -p hommy_database
```

### Lỗi WebSocket connection
```bash
# Kiểm tra firewall
sudo ufw status
sudo ufw allow 3001

# Kiểm tra SSL certificate
openssl s_client -connect 34.142.175.163:3001
```

### Lỗi WebRTC
- Kiểm tra HTTPS/SSL
- Kiểm tra STUN/TURN server
- Kiểm tra browser permissions

## 📞 Hỗ trợ

- Email: hoanhhop.work@gmail.com
- GitHub Issues: [Repository Issues](https://github.com/HoanhHop11/video-call-translation_OFFICIAL/issues)

## 📄 License

MIT License - xem file LICENSE để biết chi tiết.
