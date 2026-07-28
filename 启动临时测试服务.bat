@echo off
setlocal

cd /d "%~dp0"
echo Starting Backrooms test server at http://127.0.0.1:5173/app.html
echo Press Ctrl+C in this window to stop the server.
call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort

endlocal
