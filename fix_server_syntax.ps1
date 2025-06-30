# Fix syntax error in server.js on remote server
$fixCommand = @"
cd /home/hopboy553/video-call-translation_OFFICIAL/server/api/
cp server.js server.js.syntax_error_backup
sed -i "s/req\.path\.includes('\/stt') {/req.path.includes('\/stt')) {/" server.js
echo "Syntax error fixed"
"@

ssh hopboy553@34.142.175.163 $fixCommand
