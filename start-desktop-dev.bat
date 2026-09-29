@echo off
title Connect App Admin — Desktop (Dev Mode)
echo ============================================================
echo   Connect App Admin — Electron Dev Launcher
echo ============================================================
echo.

:: Check Node
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

:: Set working directory to project root
cd /d "%~dp0"

echo [1/3] Starting backend server...
start "Backend Server" cmd /k "cd backend && node server.js"

echo [2/3] Starting Vite frontend dev server...
start "Vite Dev Server" cmd /k "cd frontend && npx vite --port 5173"

echo [3/3] Waiting 5 seconds for servers to initialize...
timeout /t 5 /nobreak >nul

echo [4/3] Launching Electron app in dev mode...
cd electron
set NODE_ENV=development
npx electron .

echo.
echo [Done] Electron window closed.
pause
