from faster_whisper import WhisperModel
import time

print("Kiểm tra khả năng tải mô hình PhoWhisper-medium-ct2...")
start_time = time.time()

model_path = "server/models/phowhisper/PhoWhisper-medium-ct2"
print(f"Tải mô hình từ: {model_path}")

model = WhisperModel(
    model_path,
    device="cpu",
    compute_type="int8",
    cpu_threads=4,
    num_workers=4
)

end_time = time.time()
print(f"Tải mô hình thành công trong {end_time - start_time:.2f} giây!")
print("Mô hình PhoWhisper-medium-ct2 đã sẵn sàng sử dụng.") 