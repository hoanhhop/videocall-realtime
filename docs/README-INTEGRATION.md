# Video Call Integration Package

Gói tích hợp video call với real-time translation cho website React hiện có.

## 🚀 Quick Start

### 1. Cài đặt Dependencies

```bash
npm install socket.io-client simple-peer
# hoặc
yarn add socket.io-client simple-peer
```

### 2. Setup Database

Chạy script SQL trong phpMyAdmin:

```sql
-- Chạy file database/video_call_integration.sql
```

### 3. Environment Variables

Thêm vào `.env` của website hiện có:

```bash
# Video Call Integration
REACT_APP_VIDEO_CALL_SERVER_URL=http://localhost:5001
REACT_APP_VIDEO_CALL_ENABLED=true

# Server-side (cho video call server)
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret_key
```

### 4. Copy Components

Copy các file sau vào project của bạn:

```
src/
├── components/VideoCall/
│   ├── VideoCallContext.jsx
│   ├── VideoCallWidget.jsx
│   ├── VideoCallWidget.css
│   ├── VideoCallModal.jsx
│   └── VideoCallModal.css
└── services/
    └── videoCallAPI.js
```

### 5. Basic Usage

```jsx
import React from 'react';
import { VideoCallProvider } from './components/VideoCall/VideoCallContext';
import VideoCallWidget from './components/VideoCall/VideoCallWidget';

function YourPage() {
  const { user } = useYourAuth(); // Your existing auth

  return (
    <div>
      {/* Your existing content */}
      <h1>Your Website</h1>
      
      {/* Video Call Integration */}
      <VideoCallProvider 
        currentUser={user}
        serverUrl="http://localhost:5001"
      >
        <VideoCallWidget />
      </VideoCallProvider>
    </div>
  );
}
```

## 📋 Features

- ✅ **Tích hợp dễ dàng** - Chỉ cần thêm component vào website hiện có
- ✅ **Sử dụng database hiện có** - Tích hợp với MySQL/phpMyAdmin
- ✅ **Authentication tự động** - Sử dụng user đã đăng nhập
- ✅ **Real-time translation** - Dịch thuật trong cuộc gọi
- ✅ **Responsive design** - Tương thích mobile
- ✅ **Customizable UI** - Có thể tùy chỉnh giao diện
- ✅ **Call history** - Lưu lịch sử cuộc gọi
- ✅ **Online status** - Hiển thị trạng thái online

## 🔧 Configuration

### VideoCallWidget Props

```jsx
<VideoCallWidget
  targetUsers={[]}           // Danh sách users có thể gọi
  onCallStart={(call) => {}} // Callback khi bắt đầu cuộc gọi
  onCallEnd={(call) => {}}   // Callback khi kết thúc cuộc gọi
  position="bottom-right"    // Vị trí widget: bottom-right, bottom-left, top-right, top-left
  theme="default"            // Theme: default, dark, blue
  showUserList={true}        // Hiển thị danh sách users
  autoHide={true}           // Tự động ẩn khi không sử dụng
/>
```

### VideoCallProvider Props

```jsx
<VideoCallProvider 
  currentUser={{             // User hiện tại
    id: 1,
    username: "John Doe",
    email: "john@example.com",
    avatar: "https://..."
  }}
  serverUrl="http://localhost:5001"  // URL của video call server
  authToken="your-jwt-token"         // JWT token (optional)
>
```

## 🎨 UI Customization

### Themes

```jsx
// Default theme (light)
<VideoCallWidget theme="default" />

// Dark theme
<VideoCallWidget theme="dark" />

// Blue theme
<VideoCallWidget theme="blue" />
```

### Custom CSS

```css
/* Override widget styles */
.video-call-widget.theme-custom {
  background: rgba(your-color, 0.95);
  border: 1px solid your-border-color;
}

.video-call-widget.theme-custom .widget-header {
  background: your-header-color;
}
```

## 📱 Responsive Design

Widget tự động điều chỉnh cho mobile:

```css
@media (max-width: 768px) {
  .video-call-widget {
    max-width: 280px;
    bottom: 10px;
    right: 10px;
  }
}
```

## 🔌 API Integration

### Validate User (từ website hiện có)

```javascript
// Server-side: Validate user từ database hiện có
POST /api/auth/validate
{
  "id": 123,
  "username": "john_doe",
  "email": "john@example.com",
  "avatar": "https://..."
}
```

### Get Online Users

```javascript
GET /api/users/online
Authorization: Bearer your-jwt-token

Response:
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "jane_doe",
      "avatar": "https://...",
      "lastSeen": "2023-12-01T10:30:00Z"
    }
  ]
}
```

## 🗄️ Database Schema

```sql
-- Main tables created by integration script
video_call_users         -- External user mapping
user_online_status       -- Online status tracking
video_call_sessions      -- Call history
call_notifications       -- Call notifications
call_analytics          -- Analytics (optional)
```

## 🔄 Integration with Existing Auth

### Option 1: JWT Token

```javascript
// Generate JWT token từ backend hiện có
const generateVideoCallToken = (user) => {
  return jwt.sign({
    userId: user.id,
    username: user.username
  }, process.env.VIDEO_CALL_JWT_SECRET);
};
```

### Option 2: API Proxy

```javascript
// Proxy API calls qua backend hiện có
app.post('/api/video-call/*', authenticateUser, (req, res) => {
  // Forward to video call server with validated user
  proxy('http://localhost:5001')(req, res);
});
```

## 📊 Analytics & Events

```javascript
const handleCallEvents = {
  onCallStart: (call) => {
    // Track call start
    analytics.track('video_call_started', {
      partner: call.partner.username,
      timestamp: new Date()
    });
  },
  
  onCallEnd: (call) => {
    // Save call history
    saveCallHistory({
      partnerId: call.partner.id,
      duration: call.duration,
      quality: call.quality
    });
  }
};
```

## 🚀 Deployment

### Development

```bash
# Start video call server
cd server && npm start

# Start your website
npm start
```

### Production

```bash
# Build and deploy video call server
docker-compose up -d

# Update your website environment
REACT_APP_VIDEO_CALL_SERVER_URL=https://your-video-call-server.com
```

## 🛠️ Troubleshooting

### Common Issues

1. **Socket connection failed**
   - Check server URL in environment variables
   - Ensure video call server is running
   - Check CORS settings

2. **User not found**
   - Verify user validation API
   - Check database connection
   - Ensure user exists in video_call_users table

3. **Video/Audio not working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Verify WebRTC support

### Debug Mode

```javascript
// Enable debug logs
localStorage.setItem('debug', 'video-call:*');
```

## 📞 Support

- Kiểm tra logs trong browser console
- Xem database logs cho errors
- Sử dụng network tab để debug API calls

## 🔒 Security

- Luôn sử dụng HTTPS trong production
- Validate JWT tokens properly
- Sanitize user input
- Rate limit API calls
- Monitor for suspicious activity

## 📝 License

MIT License - see LICENSE file for details.
