# Tích hợp Video Call vào Website React Hiện Có

## Tổng quan

Hướng dẫn này sẽ giúp bạn tích hợp hệ thống video call translation vào website React hiện có với database MySQL (phpMyAdmin). Hệ thống đã được triển khai thành công trên: **https://34.142.175.163/**

## Cấu trúc tích hợp

```
Website React Hiện Có
├── components/
│   ├── VideoCall/           # Thêm video call widget
│   │   ├── VideoCallWidget.jsx
│   │   ├── VideoCallButton.jsx
│   │   └── VideoCallManager.jsx
│   └── ...existing components
├── services/
│   ├── videoCallAPI.js      # API cho video call
│   └── ...existing services
└── contexts/
    ├── VideoCallContext.jsx # Context cho video call
    └── ...existing contexts
```

## Bước 1: Setup Database (MySQL)

### Tạo bảng cần thiết trong database hiện có:

**Lưu ý**: Cập nhật để tương thích với bảng `taikhoan` hiện có

```sql
-- Bảng video_call_sessions (kết nối với bảng taikhoan hiện có)
CREATE TABLE video_call_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caller_id INT NOT NULL,
    callee_id INT NOT NULL,
    room_id VARCHAR(50) UNIQUE NOT NULL,
    status ENUM('pending', 'active', 'ended', 'rejected') DEFAULT 'pending',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    duration INT DEFAULT 0,
    FOREIGN KEY (caller_id) REFERENCES taikhoan(Id),
    FOREIGN KEY (callee_id) REFERENCES taikhoan(Id)
);

-- Bảng user_online_status (để track user online, kết nối với taikhoan)
CREATE TABLE user_online_status (
    user_id INT PRIMARY KEY,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES taikhoan(Id)
);

-- Bảng call_notifications (kết nối với bảng taikhoan)
CREATE TABLE call_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('incoming_call', 'missed_call', 'call_ended') NOT NULL,
    data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES taikhoan(Id)
);
```

## Bước 2: Server Integration

### Cập nhật API endpoints để sử dụng MySQL với bảng taikhoan hiện có:

```javascript
// server/controllers/authController.js - Cập nhật để sử dụng MySQL với bảng taikhoan
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Thay thế in-memory storage bằng MySQL queries với bảng taikhoan
const getUserById = async (userId) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(
    'SELECT Id, TenDangNhap as username, Email, Avatar FROM taikhoan WHERE Id = ?',
    [userId]
  );
  await connection.end();
  return rows[0] || null;
};

const authenticateUser = async (username, password) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(
    'SELECT Id, TenDangNhap, Email, MatKhau FROM taikhoan WHERE TenDangNhap = ?',
    [username]
  );
  await connection.end();
  
  if (rows.length > 0) {
    const user = rows[0];
    // Kiểm tra mật khẩu (có thể cần hash/salt tùy theo cách bạn lưu password)
    if (user.MatKhau === password) {
      return {
        id: user.Id,
        username: user.TenDangNhap,
        email: user.Email
      };
    }
  }
  return null;
};

const setUserOnline = async (userId, socketId) => {
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute(
    'INSERT INTO user_online_status (user_id, is_online, socket_id) VALUES (?, TRUE, ?) ON DUPLICATE KEY UPDATE is_online = TRUE, socket_id = ?, last_seen = CURRENT_TIMESTAMP',
    [userId, socketId, socketId]
  );
  await connection.end();
};

const getOnlineUsers = async () => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(`
    SELECT u.id, u.username, u.avatar, uos.last_seen 
    FROM users u 
    JOIN user_online_status uos ON u.id = uos.user_id 
    WHERE uos.is_online = TRUE
  `);
  await connection.end();
  return rows;
};
```

## Bước 3: Client Integration

### Video Call Widget cho website hiện có:

```jsx
// components/VideoCall/VideoCallWidget.jsx
import React, { useState, useEffect } from 'react';
import { VideoCallProvider } from './VideoCallContext';
import VideoCallButton from './VideoCallButton';
import VideoCallModal from './VideoCallModal';
import IncomingCallNotification from './IncomingCallNotification';

const VideoCallWidget = ({ 
  currentUser,        // User object từ website hiện có
  targetUsers = [],   // Danh sách users có thể gọi
  onCallStart,        // Callback khi bắt đầu cuộc gọi
  onCallEnd,          // Callback khi kết thúc cuộc gọi
  serverUrl = 'http://localhost:5001' // Video call server URL
}) => {
  return (
    <VideoCallProvider 
      currentUser={currentUser}
      serverUrl={serverUrl}
    >
      <div className="video-call-widget">
        {/* Button để mở danh sách users */}
        <VideoCallButton targetUsers={targetUsers} />
        
        {/* Modal video call */}
        <VideoCallModal 
          onCallStart={onCallStart}
          onCallEnd={onCallEnd}
        />
        
        {/* Notification cuộc gọi đến */}
        <IncomingCallNotification />
      </div>
    </VideoCallProvider>
  );
};

export default VideoCallWidget;
```

### Usage trong website hiện có:

```jsx
// Trong component của website hiện có
import VideoCallWidget from './components/VideoCall/VideoCallWidget';

function UserProfile({ user }) {
  const [availableUsers, setAvailableUsers] = useState([]);

  // Lấy danh sách users có thể gọi
  useEffect(() => {
    fetchAvailableUsers().then(setAvailableUsers);
  }, []);

  const handleCallStart = (callData) => {
    console.log('Call started:', callData);
    // Có thể update UI, log analytics, etc.
  };

  const handleCallEnd = (callData) => {
    console.log('Call ended:', callData);
    // Có thể save call history, update UI, etc.
  };

  return (
    <div className="user-profile">
      <h1>Welcome {user.username}</h1>
      
      {/* Existing website content */}
      <div className="existing-content">
        {/* ... */}
      </div>

      {/* Video Call Widget */}
      <VideoCallWidget
        currentUser={user}
        targetUsers={availableUsers}
        onCallStart={handleCallStart}
        onCallEnd={handleCallEnd}
        serverUrl={process.env.REACT_APP_VIDEO_CALL_SERVER_URL}
      />
    </div>
  );
}
```

## Bước 4: Authentication Integration

### API Service để tích hợp với auth hiện có:

```javascript
// services/videoCallAPI.js
class VideoCallAPI {
  constructor(baseURL, authToken) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  // Validate user với server video call
  async validateUser(userData) {
    const response = await fetch(`${this.baseURL}/api/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(userData)
    });
    return response.json();
  }

  // Lấy danh sách users online
  async getOnlineUsers() {
    const response = await fetch(`${this.baseURL}/api/users/online`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });
    return response.json();
  }

  // Initiate call
  async initiateCall(targetUserId, roomId) {
    const response = await fetch(`${this.baseURL}/api/calls/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ targetUserId, roomId })
    });
    return response.json();
  }
}

export default VideoCallAPI;
```

## Bước 5: Environment Setup

### Thêm vào .env của website hiện có:

```bash
# Video Call Integration
REACT_APP_VIDEO_CALL_SERVER_URL=http://localhost:5001
REACT_APP_VIDEO_CALL_ENABLED=true

# Database cho video call server
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
```

## Bước 6: Package Installation

```bash
# Thêm dependencies cần thiết
npm install socket.io-client simple-peer

# Hoặc yarn
yarn add socket.io-client simple-peer
```

## Implementation Steps

1. **Setup database tables** trong phpMyAdmin
2. **Deploy video call server** với MySQL integration
3. **Install dependencies** trong website React hiện có
4. **Add VideoCallWidget** vào components cần thiết
5. **Configure environment variables**
6. **Test integration**

## Advanced Features

### 1. Call History Integration
```jsx
// Hiển thị lịch sử cuộc gọi trong profile
<CallHistory userId={user.id} />
```

### 2. Notification Integration
```jsx
// Tích hợp với notification system hiện có
const { showNotification } = useNotification(); // From existing website

// Trong VideoCallWidget
onIncomingCall={(caller) => {
  showNotification(`Incoming call from ${caller.username}`);
}}
```

### 3. Mobile Responsive
```css
/* Mobile-friendly video call widget */
@media (max-width: 768px) {
  .video-call-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
  }
}
```

Điều này cho phép bạn tích hợp video call vào website hiện có mà không cần thay đổi architecture của website chính.
