#!/bin/bash
# check_service_structure.sh
# Script để kiểm tra cấu trúc dịch vụ và độc tài liệu

echo "====== KIỂM TRA CẤU TRÚC DỊCH VỤ ======"
echo

echo ">> Kiểm tra tài liệu:"
for doc in server/services/README.md server/services/tts_service/README.md server/services/translation_service/README.md docs/service-structure-guidelines.md; do
  if [ -f "$doc" ]; then
    echo "✅ $doc: OK"
  else
    echo "❌ $doc: Thiếu"
  fi
done
echo

echo ">> Kiểm tra cảnh báo trùng lặp:"
for deprecated in server/services/tts/DEPRECATED.md server/services/translation/DEPRECATED.md; do
  if [ -f "$deprecated" ]; then
    echo "✅ $deprecated: OK"
  else
    echo "❌ $deprecated: Thiếu"
  fi
done
echo

echo ">> Kiểm tra imports trong socket:"
grep "require.*ttsService" server/socket/*.js
grep "require.*translationService" server/socket/*.js
echo

echo ">> Kiểm tra logger tùy chỉnh:"
grep -n "createLogger.*tts" server/services/ttsService.js
grep -n "createLogger.*tts" server/services/tts/ttsService.js
grep -n "createLogger.*translation" server/services/translationService.js
grep -n "createLogger.*translation" server/services/translation/translationService.js
echo

echo ">> Dịch vụ trong docker-compose.yml:"
grep -A5 "tts:" docker-compose.yml
grep -A5 "translation:" docker-compose.yml
echo

echo "====== HOÀN THÀNH ======"
