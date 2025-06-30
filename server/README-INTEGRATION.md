# Video Call Translation Integration Server

Hệ thống tích hợp video call translation để deploy trên VM hiện có (34.142.175.163).

## 🌟 Tính năng

- **Authentication Integration**: Tích hợp với hệ thống authentication hiện có
- **Video Call**: WebRTC video call với quality cao
- **Real-time Translation**: Dịch thuật real-time trong cuộc gọi
- **Chat System**: Chat real-time với translation
- **User Management**: Quản lý users và online status
- **Database Integration**: Tích hợp với database MySQL hiện có
- **WebSocket Support**: Real-time communication

## 📁 Cấu trúc Project

```
server/
├── integrationServer.js          # Main server file
├── package.json                  # Dependencies và scripts
├── .env.example                  # Environment configuration template
├── setupIntegration.js           # Database setup script
├── deployIntegration.js          # Deployment script
├── middleware/
│   └── authMiddleware.js         # JWT authentication middleware
├── controllers/
│   └── integrationController.js  # API controllers
├── adapters/
│   └── DatabaseAdapter.js       # Database integration layer
├── routes/
│   └── integrationRoutes.js     # API routes
├── websocket/
│   └── integrationSocketHandlers.js # WebSocket handlers
└── public/
    └── video-call.html           # Video call UI

integration-client-components/    # React components cho website
├── VideoCallApp.jsx             # Main app component
├── VideoCallIntegration.jsx     # Video call component
├── AppointmentManager.jsx       # Appointment management
├── AuthenticationComponent.jsx  # Auth component
├── styles.css                   # Styling
├── package.json                 # Client dependencies
└── README.md                    # Integration guide
```

## 🚀 Quick Start

### 1. Server Setup (VM Deployment)

```bash
# Clone và navigate
cd e:\video-call-translation_OFFICIAL\server

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env với thông tin database và cấu hình

# Setup database tables
npm run setup:integration

# Start server
npm run start:integration

# Hoặc với PM2 (production)
pm2 start ecosystem.config.js
```

### 2. Client Integration

```bash
# Copy client components
cp -r integration-client-components/ /path/to/your/react/website/src/components/

# Install dependencies trong React project
npm install socket.io-client axios

# Import và sử dụng components
```

## 📊 API Endpoints

### Authentication
```
POST /api/integration/auth
POST /api/integration/verify-token
```

### Video Call
```
GET  /api/integration/users/available
POST /api/integration/video-call/initiate
POST /api/integration/video-call/join
POST /api/integration/video-call/end
```

### Notifications
```
GET  /api/integration/notifications
POST /api/integration/notifications/:id/read
```

### Appointments
```
GET  /api/integration/appointments/upcoming
```

### Health & Docs
```
GET  /health
GET  /api/docs
```

## 🔌 WebSocket Events

### Client → Server
- `authenticate` - Xác thực user
- `send_call_invitation` - Gửi lời mời gọi
- `accept_call` / `reject_call` - Chấp nhận/từ chối cuộc gọi
- `join_video_room` / `leave_video_room` - Tham gia/rời phòng
- `webrtc_offer` / `webrtc_answer` / `webrtc_ice_candidate` - WebRTC signaling
- `video_chat_message` - Gửi tin nhắn chat
- `translation_request` / `translation_result` - Translation

### Server → Client  
- `authenticated` / `authentication_error` - Kết quả xác thực
- `incoming_call` / `call_accepted` / `call_rejected` - Call events
- `user_joined_room` / `user_left_room` - Room events
- `user_online` / `user_offline` - User status
- `notification` - Thông báo real-time

## 🗄️ Database Schema

### Tables được tạo tự động:
- `user_online_status` - Trạng thái online của users
- `video_call_sessions` - Session video call
- `call_notifications` - Thông báo cuộc gọi

### Integration với table hiện có:
- `taikhoan` - User accounts (existing)
- `cuochen` - Appointments (optional integration)

## 🔧 Configuration

### Environment Variables (.env)
```env
# Server
PORT=3001
NODE_ENV=production

# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=hommy_database

# Security
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=https://your-website.com

# URLs
VIDEO_CALL_SERVER_URL=https://34.142.175.163
SOCKET_SERVER_URL=https://34.142.175.163
```

### Nginx Configuration
```nginx
# API proxy
location /api/integration {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# WebSocket proxy
location /socket.io/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## 📱 Client Integration Examples

### 1. Basic Integration
```jsx
import { VideoCallApp } from './components/VideoCallApp';

function App() {
  return (
    <div>
      <VideoCallApp 
        serverUrl="https://34.142.175.163"
        userToken={userToken}
      />
    </div>
  );
}
```

### 2. Authentication Integration
```jsx
import { AuthenticationComponent } from './components/AuthenticationComponent';

function Login() {
  const handleAuthSuccess = (userData) => {
    // Handle successful authentication
    setUser(userData.user);
    setToken(userData.token);
  };

  return (
    <AuthenticationComponent
      serverUrl="https://34.142.175.163"
      onAuthSuccess={handleAuthSuccess}
    />
  );
}
```

### 3. Video Call Integration
```jsx
import { VideoCallIntegration } from './components/VideoCallIntegration';

function VideoCall() {
  return (
    <VideoCallIntegration
      serverUrl="https://34.142.175.163"
      token={userToken}
      userId={currentUser.id}
      onCallEnd={() => navigate('/dashboard')}
    />
  );
}
```

## 🔍 Monitoring & Logging

### Health Check
```bash
curl https://34.142.175.163/health
```

### PM2 Commands
```bash
pm2 status                    # Check status
pm2 logs video-call-integration  # View logs
pm2 restart video-call-integration  # Restart
pm2 stop video-call-integration     # Stop
```

### Log Files
- `/var/www/video-call-integration/logs/`
- PM2 logs: `~/.pm2/logs/`

## 🛠️ Development

### Local Development
```bash
# Development mode với auto-reload
npm run dev:integration

# Test API
npm run health:integration
```

### Testing
```bash
# Run tests
npm test

# API testing với curl
curl -X POST http://localhost:3001/api/integration/auth \
  -H "Content-Type: application/json" \
  -d '{"credential":"user@example.com","password":"password"}'
```

## 🚀 Deployment

### Automatic Deployment
```bash
# Tạo deployment package
npm run deploy:integration

# Sẽ tạo folder 'deploy' với tất cả files cần thiết
# Copy folder này lên VM và chạy deploy.sh
```

### Manual Deployment
```bash
# 1. Copy files to VM
scp -r deploy/ user@34.142.175.163:/tmp/

# 2. SSH to VM
ssh user@34.142.175.163

# 3. Run deployment
cd /tmp/deploy
chmod +x deploy.sh
sudo ./deploy.sh

# 4. Configure environment
sudo nano /var/www/video-call-integration/.env

# 5. Restart service
sudo -u www-data pm2 restart video-call-integration
```

## 🔒 Security Considerations

- **JWT Token Security**: Sử dụng strong secret keys
- **CORS Configuration**: Chỉ allow origins cần thiết
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Validate tất cả inputs
- **HTTPS**: Luôn sử dụng HTTPS trong production
- **Database Security**: Proper user permissions
- **Environment Variables**: Không commit sensitive data

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check MySQL service
   sudo systemctl status mysql
   
   # Check credentials in .env
   # Check firewall rules
   ```

2. **WebSocket Connection Failed**
   ```bash
   # Check Nginx configuration
   # Check CORS settings
   # Verify port 3001 is accessible
   ```

3. **Video Call Not Working**
   ```bash
   # Check STUN/TURN servers
   # Verify HTTPS (required for WebRTC)
   # Check firewall for WebRTC ports
   ```

4. **Authentication Issues**
   ```bash
   # Verify JWT_SECRET
   # Check token expiration
   # Validate user credentials
   ```

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development npm run start:integration

# Check logs
tail -f logs/combined.log
```

## 📞 Support

- **Documentation**: `/api/docs`
- **Health Check**: `/health`
- **Issues**: Create issue trong repository
- **Email**: your-support-email@domain.com

## 📝 License

MIT License - see LICENSE file for details.
