// AudioWorklet processor for handling audio data
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    // Lấy dữ liệu âm thanh từ kênh đầu tiên của input đầu tiên
    const input = inputs[0];
    if (!input || !input.length) return true;
    
    const channelData = input[0];
    if (!channelData) return true;

    // Nếu không đủ dữ liệu, thêm vào buffer
    if (this.bufferIndex + channelData.length < this.bufferSize) {
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
      }
    } else {
      // Nếu đủ dữ liệu, gửi buffer hiện tại và thiết lập lại
      const remainingSpace = this.bufferSize - this.bufferIndex;
      for (let i = 0; i < remainingSpace; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
      }
      
      // Gửi dữ liệu đi
      const audioData = Array.from(this.buffer);
      this.port.postMessage({ audioData });
      
      // Reset buffer và thêm dữ liệu còn lại
      this.bufferIndex = 0;
      for (let i = remainingSpace; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
      }
    }
    
    // Trả về true để giữ processor tiếp tục chạy
    return true;
  }
}

// Đăng ký processor
registerProcessor('audio-processor', AudioProcessor); 