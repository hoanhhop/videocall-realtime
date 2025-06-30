import os
import time
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts

print("Kiểm tra khả năng tải mô hình XTTS-v2...")
start_time = time.time()

model_path = "server/models/tts/XTTS-v2"
config_path = os.path.join(model_path, "config.json")
model_file = os.path.join(model_path, "model.pth")

print(f"Tải config từ: {config_path}")
config = XttsConfig()
config.load_json(config_path)

print("Khởi tạo mô hình từ config...")
model = Xtts.init_from_config(config)

print(f"Tải checkpoint từ: {model_file}")
model.load_checkpoint(config, checkpoint_path=model_file, eval=True)

end_time = time.time()
print(f"Tải mô hình thành công trong {end_time - start_time:.2f} giây!")
print("Mô hình XTTS-v2 đã sẵn sàng sử dụng.") 