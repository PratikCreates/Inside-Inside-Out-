@echo off
title Inside Inside Out - HQ Console

echo ===================================================
echo     INSIDE INSIDE OUT - INITIALIZING HQ...
echo ===================================================

echo.
echo [1/2] Starting Backend Brain (FastAPI)...
start "Backend Server" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

echo.
echo [2/2] Starting Frontend Console (Vite)...
start "Frontend Console" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo     SYSTEM ONLINE. OPENING PORTAL...
echo ===================================================
echo.
echo Access the console at: http://localhost:5173
echo.
pause
