import React, { useState, useEffect } from 'react';
import { videoCallAPI } from '../utils/api';
import { validateEmail, handleError } from '../utils/helpers';

/**
 * Component xử lý authentication cho video call integration
 * @param {Object} props - Component props
 * @param {Function} props.onLogin - Callback khi login thành công
 * @param {Function} props.onError - Callback khi có lỗi
 * @param {string} props.className - CSS class name
 */
const AuthenticationComponent = ({ 
  onLogin, 
  onError, 
  className = 'video-call-auth' 
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Kiểm tra token hiện tại khi component mount
  useEffect(() => {
    checkCurrentAuth();
  }, []);

  /**
   * Kiểm tra authentication hiện tại
   */
  const checkCurrentAuth = async () => {
    const token = localStorage.getItem('videoCallToken');
    if (token) {
      try {
        const profile = await videoCallAPI.getProfile();
        if (profile.success) {
          setIsLoggedIn(true);
          setUserProfile(profile.user);
          if (onLogin) {
            onLogin(profile.user, token);
          }
        }
      } catch (error) {
        // Token không hợp lệ, xóa nó
        videoCallAPI.clearToken();
      }
    }
  };

  /**
   * Xử lý thay đổi input
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Xóa error khi user bắt đầu nhập
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email không được để trống';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Mật khẩu không được để trống';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Xử lý đăng nhập
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await videoCallAPI.login(formData.email, formData.password);
      
      if (response.success) {
        setIsLoggedIn(true);
        setUserProfile(response.user);
        setFormData({ email: '', password: '' });
        
        if (onLogin) {
          onLogin(response.user, response.token);
        }
      } else {
        const errorMsg = response.message || 'Đăng nhập thất bại';
        setErrors({ general: errorMsg });
        if (onError) {
          onError(new Error(errorMsg));
        }
      }
    } catch (error) {
      const errorMsg = handleError(error);
      setErrors({ general: errorMsg });
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Xử lý đăng xuất
   */
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await videoCallAPI.logout();
      setIsLoggedIn(false);
      setUserProfile(null);
      setFormData({ email: '', password: '' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Nếu đã đăng nhập, hiển thị thông tin user
  if (isLoggedIn && userProfile) {
    return (
      <div className={`${className} ${className}--logged-in`}>
        <div className={`${className}__profile`}>
          <div className={`${className}__profile-info`}>
            <h3 className={`${className}__welcome`}>
              Xin chào, {userProfile.tenTK || userProfile.email}!
            </h3>
            <p className={`${className}__email`}>
              {userProfile.email}
            </p>
          </div>
          <button
            type=\"button\"
            onClick={handleLogout}
            disabled={isLoading}
            className={`${className}__logout-btn`}
          >
            {isLoading ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </div>
    );
  }

  // Form đăng nhập
  return (
    <div className={`${className} ${className}--login`}>
      <div className={`${className}__container`}>
        <h2 className={`${className}__title`}>
          Đăng nhập Video Call
        </h2>
        
        {errors.general && (
          <div className={`${className}__error ${className}__error--general`}>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleLogin} className={`${className}__form`}>
          <div className={`${className}__field`}>
            <label htmlFor=\"email\" className={`${className}__label`}>
              Email
            </label>
            <input
              type=\"email\"
              id=\"email\"
              name=\"email\"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
              className={`${className}__input ${errors.email ? `${className}__input--error` : ''}`}
              placeholder=\"Nhập email của bạn\"
              autoComplete=\"email\"
            />
            {errors.email && (
              <span className={`${className}__error ${className}__error--field`}>
                {errors.email}
              </span>
            )}
          </div>

          <div className={`${className}__field`}>
            <label htmlFor=\"password\" className={`${className}__label`}>
              Mật khẩu
            </label>
            <input
              type=\"password\"
              id=\"password\"
              name=\"password\"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isLoading}
              className={`${className}__input ${errors.password ? `${className}__input--error` : ''}`}
              placeholder=\"Nhập mật khẩu\"
              autoComplete=\"current-password\"
            />
            {errors.password && (
              <span className={`${className}__error ${className}__error--field`}>
                {errors.password}
              </span>
            )}
          </div>

          <button
            type=\"submit\"
            disabled={isLoading}
            className={`${className}__submit-btn`}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className={`${className}__footer`}>
          <p className={`${className}__note`}>
            Sử dụng tài khoản có sẵn trong hệ thống để đăng nhập.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationComponent;
