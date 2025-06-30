import React, { useState, useEffect } from 'react';
import { User, LogIn, LogOut, UserCheck, Eye, EyeOff } from 'lucide-react';

const AuthenticationComponent = ({ 
  serverUrl = 'https://34.142.175.163',
  onAuthSuccess,
  onAuthError,
  className = ''
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  const [registerForm, setRegisterForm] = useState({
    maTK: '',
    tenTK: '',
    matKhau: '',
    confirmPassword: '',
    hoTen: '',
    email: '',
    soDienThoai: ''
  });

  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedToken = localStorage.getItem('videoCallToken');
    const savedUser = localStorage.getItem('videoCallUser');
    
    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(userData);
        setIsLoggedIn(true);
        
        if (onAuthSuccess) {
          onAuthSuccess(savedToken, userData);
        }
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('videoCallToken');
        localStorage.removeItem('videoCallUser');
      }
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${serverUrl}/api/integration/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Đăng nhập thất bại');
      }

      // Save authentication data
      setToken(data.token);
      setUser(data.user);
      setIsLoggedIn(true);
      setShowLogin(false);
      
      // Save to localStorage
      localStorage.setItem('videoCallToken', data.token);
      localStorage.setItem('videoCallUser', JSON.stringify(data.user));

      // Clear form
      setLoginForm({ username: '', password: '' });

      if (onAuthSuccess) {
        onAuthSuccess(data.token, data.user);
      }

    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      
      if (onAuthError) {
        onAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (registerForm.matKhau !== registerForm.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/api/integration/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maTK: registerForm.maTK,
          tenTK: registerForm.tenTK,
          matKhau: registerForm.matKhau,
          hoTen: registerForm.hoTen,
          email: registerForm.email,
          soDienThoai: registerForm.soDienThoai
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Đăng ký thất bại');
      }

      // Automatically log in after successful registration
      setToken(data.token);
      setUser(data.user);
      setIsLoggedIn(true);
      setShowRegister(false);
      
      // Save to localStorage
      localStorage.setItem('videoCallToken', data.token);
      localStorage.setItem('videoCallUser', JSON.stringify(data.user));

      // Clear form
      setRegisterForm({
        maTK: '',
        tenTK: '',
        matKhau: '',
        confirmPassword: '',
        hoTen: '',
        email: '',
        soDienThoai: ''
      });

      if (onAuthSuccess) {
        onAuthSuccess(data.token, data.user);
      }

    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
      
      if (onAuthError) {
        onAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    setShowLogin(false);
    setShowRegister(false);
    
    // Clear localStorage
    localStorage.removeItem('videoCallToken');
    localStorage.removeItem('videoCallUser');

    if (onAuthSuccess) {
      onAuthSuccess(null, null);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // If user is logged in, show user info
  if (isLoggedIn && user) {
    return (
      <div className={`authentication-component ${className}`}>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <UserCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">
                  {user.hoTen || user.tenTK}
                </h4>
                <p className="text-sm text-gray-500">
                  {user.email || `Mã TK: ${user.maTK}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, show login/register options
  return (
    <div className={`authentication-component ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {!showLogin && !showRegister ? (
          // Welcome screen
          <div className="p-6 text-center">
            <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Đăng nhập để sử dụng Video Call
            </h3>
            <p className="text-gray-600 mb-6">
              Bạn cần đăng nhập để tham gia video call với tính năng dịch thuật
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowLogin(true)}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Đăng nhập
              </button>
              <button
                onClick={() => setShowRegister(true)}
                className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Đăng ký tài khoản mới
              </button>
            </div>
          </div>
        ) : showLogin ? (
          // Login form
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Đăng nhập</h3>
              <p className="text-gray-600">Nhập thông tin tài khoản của bạn</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  required
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên đăng nhập hoặc email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setShowLogin(false);
                  setShowRegister(true);
                  setError(null);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Chưa có tài khoản? Đăng ký ngay
              </button>
            </div>
          </div>
        ) : (
          // Register form
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Đăng ký tài khoản</h3>
              <p className="text-gray-600">Tạo tài khoản mới để sử dụng dịch vụ</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mã tài khoản *
                  </label>
                  <input
                    type="text"
                    required
                    value={registerForm.maTK}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, maTK: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mã tài khoản duy nhất"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    required
                    value={registerForm.tenTK}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, tenTK: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tên đăng nhập"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ tên
                </label>
                <input
                  type="text"
                  value={registerForm.hoTen}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, hoTen: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Họ và tên đầy đủ"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={registerForm.soDienThoai}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, soDienThoai: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0123456789"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={registerForm.matKhau}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, matKhau: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mật khẩu"
                    minLength="6"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Xác nhận mật khẩu *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegister(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                </button>
              </div>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setShowRegister(false);
                  setShowLogin(true);
                  setError(null);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Đã có tài khoản? Đăng nhập ngay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthenticationComponent;
