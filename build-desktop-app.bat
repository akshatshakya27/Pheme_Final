@echo off
setlocal

echo ============================================
echo Pheme Desktop EXE Build
echo ============================================

cd /d "%~dp0electron"
if errorlevel 1 (
  echo Failed to enter electron folder.
  exit /b 1
)

echo [1/2] Installing Electron dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  exit /b 1
)

echo [2/2] Building frontend and EXE...
call npm run build
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo.
echo Build complete. Output:
echo electron\dist\Pheme Secure Exam Setup 1.0.0.exe
echo electron\dist\Pheme Secure Exam 1.0.0.exe
echo.
endlocal
