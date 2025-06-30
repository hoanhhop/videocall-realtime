import React, { useEffect, useState } from 'react';
import './SubtitleDisplay.css';

const SubtitleDisplay = ({ text, isLocal = false }) => {
  const [visible, setVisible] = useState(false);
  
  // Show subtitle when text changes and hide after timeout
  useEffect(() => {
    if (text) {
      setVisible(true);
      console.log(`Hiển thị phụ đề ${isLocal ? 'nguồn' : 'dịch'}: ${text}`);
      
      // Hiển thị phụ đề lâu hơn (10 giây)
      const timeout = setTimeout(() => {
        setVisible(false);
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [text]);
  
  // Trường hợp không có text, vẫn hiển thị một phụ đề trống để người dùng biết vị trí
  if (!text) {
    return (
      <div className={`subtitle-container ${isLocal ? 'local' : 'remote'}`}>
        <div className="subtitle-placeholder">
          {isLocal ? 'Văn bản nhận diện sẽ hiển thị ở đây...' : 'Bản dịch sẽ hiển thị ở đây...'}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`subtitle-container ${isLocal ? 'local' : 'remote'} ${visible ? 'visible' : ''}`}>
      <div className="subtitle-text">
        {text}
      </div>
    </div>
  );
};

export default SubtitleDisplay;