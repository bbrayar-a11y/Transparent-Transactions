@echo off
echo Stopping any existing Node.js processes...
taskkill /f /im node.exe 2>nul

echo Starting TrustLedger Server...
echo Your Android URL: http://192.168.1.3:3000
echo.
node src/server.js

pause