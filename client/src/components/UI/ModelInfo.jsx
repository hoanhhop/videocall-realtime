import React from 'react';
import './ModelInfo.css';

const ModelInfo = () => {
  return (
    <div className="model-info">
      <h3>Thông tin Model</h3>
      <div className="info-content">
        <p>Model: Whisper</p>
        <p>Ngôn ngữ hỗ trợ: Tiếng Việt, Tiếng Anh</p>
        <p>Độ chính xác: Cao</p>
      </div>
    </div>
  );
};

export default ModelInfo;
