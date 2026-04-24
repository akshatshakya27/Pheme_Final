#!/bin/bash
set -e

echo "============================================"
echo "Pheme Desktop EXE Build"
echo "============================================"

cd "$(dirname "$0")/electron"

echo "[1/2] Installing Electron dependencies..."
npm install

echo "[2/2] Building frontend and EXE..."
npm run build

echo ""
echo "Build complete. Output:"
echo "electron/dist/Pheme Secure Exam Setup 1.0.0.exe"
echo "electron/dist/Pheme Secure Exam 1.0.0.exe"
