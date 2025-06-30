# Video Call Integration Guide

## Kiến trúc hệ thống

```
┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   React Client  │
│   (User A)      │    │   (User B)      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
        ┌─────────────────────────┐
        │   Socket.IO Server      │
        │   (Signaling Server)    │
        └─────────────────────────┘
                     │
        ┌─────────────────────────┐
        │   Notification System   │
        │   + User Management     │
        └─────────────────────────┘
```

## Tính năng chính cần implement:

1. **User Management**: Đăng ký, đăng nhập, trạng thái online
2. **Call Initiation**: Gọi đến user khác
3. **Incoming Call Notification**: Thông báo cuộc gọi đến
4. **Call Accept/Reject**: Chấp nhận hoặc từ chối cuộc gọi
5. **WebRTC Video Call**: Video call P2P với translation
6. **Call History**: Lịch sử cuộc gọi

## Components cần tạo:

### 1. User Management
- `UserProvider` - Context quản lý user state
- `LoginForm` - Form đăng nhập
- `UserList` - Danh sách users online
- `UserStatus` - Hiển thị trạng thái user

### 2. Call System
- `CallProvider` - Context quản lý call state (đã có)
- `CallInitiator` - Component để bắt đầu cuộc gọi
- `IncomingCallModal` - Modal thông báo cuộc gọi đến
- `CallInterface` - Interface chính cho video call (đã có phần nào)

### 3. Notification System
- `NotificationProvider` - Context quản lý notifications
- `NotificationToast` - Toast hiển thị thông báo
- Browser Notification API integration

## Database Schema (MongoDB/PostgreSQL):

```javascript
// Users Collection
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed),
  isOnline: Boolean,
  lastSeen: Date,
  avatar: String,
  preferences: {
    language: String,
    notifications: Boolean
  }
}

// Calls Collection
{
  _id: ObjectId,
  callerId: ObjectId,
  calleeId: ObjectId,
  status: String, // 'pending', 'accepted', 'rejected', 'ended', 'missed'
  startTime: Date,
  endTime: Date,
  duration: Number,
  roomId: String
}

// Notifications Collection
{
  _id: ObjectId,
  userId: ObjectId,
  type: String, // 'incoming_call', 'missed_call', 'call_ended'
  data: Object,
  read: Boolean,
  createdAt: Date
}
```
