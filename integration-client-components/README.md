# Hướng dẫn sử dụng Video Call Translation Components

Đây là các React components để tích hợp video call với tính năng dịch thuật vào website React của bạn.

## Cài đặt

### 1. Copy files vào project React

Copy toàn bộ folder `integration-client-components` vào project React của bạn:

```
src/
  components/
    VideoCall/
      VideoCallApp.jsx
      VideoCallIntegration.jsx
      AppointmentManager.jsx
      AuthenticationComponent.jsx
      styles.css
```

### 2. Cài đặt dependencies

```bash
npm install lucide-react
```

### 3. Import styles

Trong file `src/App.css` hoặc `src/index.css`, thêm:

```css
@import './components/VideoCall/styles.css';
```

## Sử dụng

### Cách 1: Sử dụng complete app

```jsx
import React from 'react';
import VideoCallApp from './components/VideoCall/VideoCallApp';

function MyComponent() {
  return (
    <div>
      <h1>Website của tôi</h1>
      
      {/* Video Call App */}
      <VideoCallApp 
        serverUrl="https://34.142.175.163"
        className="my-video-call"
        onClose={() => console.log('Đã đóng video call')}
      />
    </div>
  );
}

export default MyComponent;
```

### Cách 2: Sử dụng từng component riêng biệt

```jsx
import React, { useState } from 'react';
import AuthenticationComponent from './components/VideoCall/AuthenticationComponent';
import AppointmentManager from './components/VideoCall/AppointmentManager';
import VideoCallIntegration from './components/VideoCall/VideoCallIntegration';

function MyVideoCallPage() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [activeAppointment, setActiveAppointment] = useState(null);

  const handleAuthSuccess = (userToken, userData) => {
    setToken(userToken);
    setUser(userData);
  };

  const handleStartVideoCall = (appointment) => {
    setActiveAppointment(appointment);
  };

  return (
    <div className="video-call-page">
      {!user ? (
        <AuthenticationComponent
          serverUrl="https://34.142.175.163"
          onAuthSuccess={handleAuthSuccess}
        />
      ) : !activeAppointment ? (
        <AppointmentManager
          userToken={token}
          userId={user.Id}
          serverUrl="https://34.142.175.163"
          onStartVideoCall={handleStartVideoCall}
        />
      ) : (
        <VideoCallIntegration
          appointmentId={activeAppointment.Id}
          userToken={token}
          serverUrl="https://34.142.175.163"
          onCallEnd={() => setActiveAppointment(null)}
        />
      )}
    </div>
  );
}

export default MyVideoCallPage;
```

### Cách 3: Tích hợp với existing authentication

Nếu website của bạn đã có hệ thống authentication, bạn có thể bỏ qua `AuthenticationComponent` và sử dụng trực tiếp:

```jsx
import React, { useState, useEffect } from 'react';
import AppointmentManager from './components/VideoCall/AppointmentManager';

function MyPage() {
  const [videoCallToken, setVideoCallToken] = useState(null);
  
  // Lấy token từ hệ thống auth hiện tại
  useEffect(() => {
    const getVideoCallToken = async () => {
      try {
        const response = await fetch('https://34.142.175.163/api/integration/auth/token', {
          headers: {
            'Authorization': `Bearer ${myCurrentAuthToken}` // Token hiện tại của bạn
          }
        });
        const data = await response.json();
        setVideoCallToken(data.token);
      } catch (error) {
        console.error('Error getting video call token:', error);
      }
    };

    getVideoCallToken();
  }, []);

  return (
    <div>
      {videoCallToken && (
        <AppointmentManager
          userToken={videoCallToken}
          userId={currentUser.id}
          serverUrl="https://34.142.175.163"
          onStartVideoCall={(appointment) => {
            // Handle video call start
          }}
        />
      )}
    </div>
  );
}
```

## Props của các components

### VideoCallApp
- `serverUrl`: URL của server (mặc định: "https://34.142.175.163")
- `className`: CSS class tùy chỉnh
- `onClose`: Callback khi đóng app

### AuthenticationComponent
- `serverUrl`: URL của server
- `onAuthSuccess`: Callback khi đăng nhập thành công `(token, user) => {}`
- `onAuthError`: Callback khi có lỗi `(error) => {}`
- `className`: CSS class tùy chỉnh

### AppointmentManager
- `userToken`: JWT token của user
- `userId`: ID của user trong database
- `serverUrl`: URL của server
- `onStartVideoCall`: Callback khi bắt đầu video call `(appointment) => {}`
- `className`: CSS class tùy chỉnh

### VideoCallIntegration
- `appointmentId`: ID của cuộc hẹn
- `userToken`: JWT token của user
- `serverUrl`: URL của server
- `onCallEnd`: Callback khi kết thúc cuộc gọi `() => {}`
- `className`: CSS class tùy chỉnh

## Tùy chỉnh giao diện

Bạn có thể tùy chỉnh giao diện bằng cách:

### 1. Override CSS classes

```css
/* Trong file CSS của bạn */
.my-video-call .video-call-integration {
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.my-video-call .bg-blue-600 {
  background-color: #your-brand-color !important;
}
```

### 2. Custom styling với props

```jsx
<VideoCallApp 
  className="custom-video-call"
  style={{
    '--primary-color': '#your-brand-color',
    '--secondary-color': '#your-secondary-color'
  }}
/>
```

## API Integration

Components này sẽ gọi các API endpoints sau trên server của bạn:

- `POST /api/integration/auth/login` - Đăng nhập
- `POST /api/integration/auth/register` - Đăng ký
- `GET /api/integration/appointments` - Lấy danh sách cuộc hẹn
- `POST /api/integration/appointments` - Tạo cuộc hẹn mới
- `PUT /api/integration/appointments/:id/status` - Cập nhật trạng thái cuộc hẹn
- WebSocket `/ws/video-call/:appointmentId` - Kết nối video call

## Troubleshooting

### 1. CORS Issues
Đảm bảo server đã cấu hình CORS cho domain của bạn:

```javascript
// Trên server
app.use(cors({
  origin: ['https://your-website.com', 'http://localhost:3000'],
  credentials: true
}));
```

### 2. WebSocket Connection Issues
Kiểm tra firewall và proxy settings cho WebSocket connections.

### 3. Camera/Microphone Permissions
Components sẽ tự động yêu cầu quyền truy cập camera/microphone khi bắt đầu video call.

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Security Notes

- Luôn sử dụng HTTPS cho production
- JWT tokens được lưu trong localStorage (có thể thay đổi thành httpOnly cookies nếu cần)
- WebRTC connection được mã hóa end-to-end
- Validate tất cả user input trên server side
