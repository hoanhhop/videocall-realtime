// Hiển thị thông tin về độ tin cậy và model
const renderConfidenceInfo = () => {
  if (!confidenceScore) return null;
  
  let modelType = "Không rõ";
  let confidenceColor = "text-yellow-500";
  let modelBadge = null;
  
  // Xác định loại model và màu sắc cho độ tin cậy
  if (typeof confidenceScore === 'object' && confidenceScore.modelType) {
    if (confidenceScore.modelType === 'ONNX') {
      modelType = "ONNX";
      modelBadge = (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ONNX
        </span>
      );
    } else if (confidenceScore.modelType === 'Simulated') {
      modelType = "Giả lập";
      modelBadge = (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Giả lập
        </span>
      );
    } else {
      modelType = "Chuẩn";
      modelBadge = (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Chuẩn
        </span>
      );
    }
    
    // Xác định màu sắc dựa trên độ tin cậy
    const confidence = confidenceScore.value;
    if (confidence > 0.9) confidenceColor = "text-green-500";
    else if (confidence > 0.7) confidenceColor = "text-yellow-500";
    else confidenceColor = "text-red-500";
    
    return (
      <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
        <span>Độ tin cậy: <span className={confidenceColor}>
          {(confidence * 100).toFixed(1)}%
        </span></span>
        {modelBadge}
      </div>
    );
  }
  
  // Chế độ tương thích cũ (chỉ hiển thị độ tin cậy)
  const confidence = typeof confidenceScore === 'number' ? confidenceScore : 0;
  if (confidence > 0.9) confidenceColor = "text-green-500";
  else if (confidence > 0.7) confidenceColor = "text-yellow-500";
  else confidenceColor = "text-red-500";
  
  return (
    <div className="text-xs text-gray-500 mb-1">
      Độ tin cậy: <span className={confidenceColor}>
        {(confidence * 100).toFixed(1)}%
      </span>
    </div>
  );
}; 