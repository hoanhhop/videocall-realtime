import os
import requests

def check_tts_service():
    """Kiểm tra xem dịch vụ TTS có đang chạy không"""
    try:
        response = requests.get("http://localhost:5002/health", timeout=5)
        if response.status_code == 200:
            print("✅ Dịch vụ TTS đang chạy")
            print(f"Thông tin: {response.json()}")
            return True
        else:
            print(f"❌ Dịch vụ TTS trả về mã lỗi: {response.status_code}")
            print(f"Nội dung: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Không thể kết nối đến dịch vụ TTS. Dịch vụ có thể chưa được khởi động.")
        return False
    except Exception as e:
        print(f"❌ Lỗi khi kiểm tra dịch vụ TTS: {e}")
        return False

def check_tts_files():
    """Kiểm tra xem các file cần thiết cho XTTS-v2 có tồn tại không"""
    model_path = "server/models/tts/XTTS-v2"
    required_files = ["model.pth", "config.json", "vocab.json"]
    
    print(f"\nKiểm tra các file cần thiết cho XTTS-v2 trong thư mục {model_path}")
    
    if not os.path.exists(model_path):
        print(f"❌ Thư mục {model_path} không tồn tại")
        return False
    
    all_files_exist = True
    for file in required_files:
        file_path = os.path.join(model_path, file)
        if os.path.exists(file_path):
            file_size = os.path.getsize(file_path) / (1024 * 1024)  # Convert to MB
            print(f"✅ Tìm thấy {file} ({file_size:.2f} MB)")
        else:
            print(f"❌ Không tìm thấy {file}")
            all_files_exist = False
    
    return all_files_exist

if __name__ == "__main__":
    print("Kiểm tra XTTS-v2...")
    
    file_check = check_tts_files()
    service_check = check_tts_service()
    
    if file_check:
        print("\n✅ Các file XTTS-v2 đã sẵn sàng")
    else:
        print("\n❌ Thiếu một số file XTTS-v2 cần thiết")
    
    if service_check:
        print("✅ Dịch vụ TTS đang hoạt động")
    else:
        print("❌ Dịch vụ TTS chưa được khởi động")
        print("\nĐể khởi động dịch vụ TTS, hãy chạy lệnh sau:")
        print("cd server/services/tts_service && python run_tts.py")
    
    if file_check and not service_check:
        print("\n⚠️ Mô hình XTTS-v2 đã sẵn sàng nhưng dịch vụ chưa được khởi động")
    elif not file_check and not service_check:
        print("\n⚠️ Cần tải mô hình XTTS-v2 và khởi động dịch vụ")
    elif file_check and service_check:
        print("\n✅ XTTS-v2 đã sẵn sàng và dịch vụ đang chạy") 