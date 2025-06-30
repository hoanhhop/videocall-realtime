import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook để quản lý kết nối Socket.IO cho video call integration
 * @param {string} serverUrl - URL của server (mặc định: https://34.142.175.163:3001)
 * @param {string} token - JWT token để authentication
 * @returns {Object} Socket instance và connection status
 */
export const useSocket = (serverUrl = 'https://34.142.175.163:3001', token = null) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setError('Token không được cung cấp');
      return;
    }

    // Tạo kết nối socket với authentication
    const newSocket = io(serverUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = newSocket;

    // Event listeners
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError(`Lỗi kết nối: ${err.message}`);
      setIsConnected(false);
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      setError(`Lỗi socket: ${err.message || err}`);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [serverUrl, token]);

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  const reconnect = () => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  };

  return {
    socket,
    isConnected,
    error,
    disconnect,
    reconnect
  };
};
