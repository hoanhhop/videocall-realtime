// client/src/contexts/UserContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children, socket }) => {
  const [user, setUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setIsAuthenticated(true);
      
      // Emit user online status to server
      if (socket) {
        socket.emit('user-online', userData);
      }
    }
    setIsLoading(false);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    // Listen for online users updates
    socket.on('online-users-updated', (users) => {
      setOnlineUsers(users);
    });

    // Listen for user status changes
    socket.on('user-status-changed', (userData) => {
      setOnlineUsers(prev => 
        prev.map(u => u.id === userData.id ? userData : u)
      );
    });

    return () => {
      socket.off('online-users-updated');
      socket.off('user-status-changed');
    };
  }, [socket]);

  const login = async (credentials) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        
        // Emit user online status
        if (socket) {
          socket.emit('user-online', data.user);
        }
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        return { success: true, message: 'Registration successful' };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Emit user offline status
    if (socket && user) {
      socket.emit('user-offline', user.id);
    }
    
    setUser(null);
    setIsAuthenticated(false);
    setOnlineUsers([]);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const updateUserStatus = (status) => {
    if (socket && user) {
      const updatedUser = { ...user, status };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      socket.emit('user-status-update', updatedUser);
    }
  };

  const value = {
    user,
    onlineUsers,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateUserStatus
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
