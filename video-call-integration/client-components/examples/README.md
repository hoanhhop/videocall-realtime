# Video Call Integration - Example Usage

Folder này chứa các ví dụ về cách tích hợp video call system vào website React hiện có.

## 📁 Files

### `ExampleApp.jsx`
- Ví dụ hoàn chỉnh về cách tích hợp `VideoCallIntegration` component
- Hiển thị cách truyền user data và handle events
- Phù hợp cho most use cases

### `SimpleVideoCallExample.jsx`
- Ví dụ đơn giản chỉ sử dụng `VideoCallComponent`
- Hiển thị cách sử dụng hooks `useSocket` và `useWebRTC`
- Phù hợp khi chỉ cần basic video call functionality

### `AppointmentIntegrationExample.jsx`
- Ví dụ tích hợp với appointment system
- Hiển thị cách connect video calls với existing appointments
- Sử dụng `AppointmentManager` component và API calls

## 🚀 Cách sử dụng

### 1. Copy files cần thiết
```bash
# Copy tất cả components
cp -r client-components/* /path/to/your/react/project/src/

# Hoặc chỉ copy specific components
cp client-components/components/VideoCallComponent.jsx /path/to/your/react/project/src/components/
```

### 2. Install dependencies
```bash
cd /path/to/your/react/project
npm install socket.io-client axios
```

### 3. Import và sử dụng
```jsx
// Option 1: Full integration
import VideoCallIntegration from './components/VideoCallIntegration';
import './styles/video-call-integration.css';

// Option 2: Individual components
import VideoCallComponent from './components/VideoCallComponent';
import AppointmentManager from './components/AppointmentManager';

// Option 3: Custom hooks only
import { useSocket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';
```

### 4. Configure
```jsx
// Update config file
import { VIDEO_CALL_CONFIG } from './config/videoCallConfig';

// Modify URLs to match your deployment
VIDEO_CALL_CONFIG.serverUrl = 'https://your-domain.com:3001';
VIDEO_CALL_CONFIG.apiUrl = 'https://your-domain.com/video-call-api';
VIDEO_CALL_CONFIG.wsUrl = 'wss://your-domain.com/video-call-socket.io';
```

## 🔧 Customization

### Styling
- Modify `styles/video-call-integration.css`
- Override CSS custom properties:
```css
:root {
  --video-call-primary: #your-color;
  --video-call-secondary: #your-color;
  /* ... */
}
```

### Features
- Enable/disable features in config:
```js
VIDEO_CALL_CONFIG.features = {
  translation: true,
  chat: true,
  screenShare: false,
  recording: false
};
```

### API Integration
- Modify `utils/api.js` to match your API endpoints
- Update authentication logic in `components/AuthenticationComponent.jsx`

## 🎯 Integration Tips

### 1. User Authentication
```jsx
// Integrate with your existing auth system
const MyApp = () => {
  const { user, isAuthenticated } = useAuth(); // Your auth hook
  
  return (
    <div>
      {isAuthenticated && (
        <VideoCallIntegration 
          userId={user.id}
          userName={user.name}
          userEmail={user.email}
        />
      )}
    </div>
  );
};
```

### 2. Navigation Integration
```jsx
// Add to your router
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/video-call/:roomId" element={<VideoCallPage />} />
      {/* Your existing routes */}
    </Routes>
  </BrowserRouter>
);
```

### 3. State Management
```jsx
// Redux integration example
import { useDispatch, useSelector } from 'react-redux';

const VideoCallPage = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  
  const handleCallStart = (callId) => {
    dispatch(setActiveCall(callId));
  };
  
  return (
    <VideoCallIntegration 
      userId={user.id}
      onCallStart={handleCallStart}
    />
  );
};
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure server CORS is configured for your domain
   - Check `ALLOWED_ORIGINS` in server `.env`

2. **WebSocket Connection Failed**
   - Verify WebSocket URL is correct
   - Check firewall/proxy settings
   - Ensure HTTPS for production

3. **WebRTC Connection Issues**
   - Add TURN servers for production
   - Check browser permissions for camera/microphone
   - Verify STUN server configuration

4. **Authentication Errors**
   - Ensure JWT token is valid
   - Check token expiration
   - Verify API endpoints are correct

### Debug Mode
```jsx
// Enable debug logging
VIDEO_CALL_CONFIG.debug = true;

// Or use environment variable
if (process.env.NODE_ENV === 'development') {
  VIDEO_CALL_CONFIG.debug = true;
}
```
