@echo off
setlocal
cd /d "%~dp0"
set "TASK_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "TASK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist node_modules\vite\package.json (
  echo Please install Node.js 24, then run: npm install
  pause
  exit /b 1
)
echo.
echo Zhengyuan preview: http://localhost:4173
echo Open this address in Chrome or Edge. Keep this window open.
echo Press Ctrl+C to stop the server.
echo.
"%TASK_NODE%" server/index.mjs
if errorlevel 1 pause
