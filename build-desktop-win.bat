@echo off
title Connect App Admin — Build & Package
echo ============================================================
echo   Connect App Admin — Production Build + Electron Package
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Building frontend (Vite)...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Frontend build failed.
  pause
  exit /b 1
)
cd ..

echo [2/3] Installing Electron dependencies...
cd electron
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Electron npm install failed.
  pause
  exit /b 1
)

echo [3/3] Packaging Windows installer...
call npx electron-builder --win
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] electron-builder packaging failed.
  pause
  exit /b 1
)
cd ..

echo.
echo ============================================================
echo   Build complete! Installer saved to: dist-electron\
echo ============================================================
pause
