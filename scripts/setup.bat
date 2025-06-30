@echo off
echo === Video Call Translation - Setup ===

:: Tạo thư mục cần thiết
if not exist "models\phowhisper" mkdir models\phowhisper
if not exist "models\opus_mt" mkdir models\opus_mt
if not exist "models\tts" mkdir models\tts
if not exist "server\logs" mkdir server\logs

:: Kiểm tra và tạo file .env
if not exist ".env" (
    echo Tạo file .env...
    echo # Cấu hình server> .env
    echo API_PORT=5000>> .env
    echo SOCKET_PORT=5001>> .env
    echo.>> .env
    echo # URL dịch vụ>> .env
    echo PHOWHISPER_ASR_URL=http://localhost:50051>> .env
    echo TRANSLATION_SERVICE_URL=http://localhost:50052>> .env
    echo TTS_SERVICE_URL=http://localhost:5002>> .env
    echo EMBEDDING_SERVICE_URL=http://localhost:5003>> .env
    echo.>> .env
    echo # Cài đặt chung>> .env
    echo NODE_ENV=development>> .env
    echo LOG_LEVEL=info>> .env
    echo.>> .env
    echo # Cấu hình CPU>> .env
    echo USE_CUDA=false>> .env
    echo BATCH_SIZE=4>> .env
    echo File .env đã được tạo.
)

:: Tạo môi trường Python
python -m venv venv
call venv\Scripts\activate.bat
pip install -r requirements.txt

:: Cài đặt dependencies Node.js
call npm install
cd client && call npm install
cd ..

echo.
echo Cài đặt hoàn tất. Sử dụng các lệnh sau để khởi động:
echo - npm run dev           : Khởi động API ^& Socket Server
echo - npm run start:services: Khởi động các dịch vụ Python
echo - npm run client        : Khởi động client UI
echo - docker-compose up     : Khởi động tất cả bằng Docker 