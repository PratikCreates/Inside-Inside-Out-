@echo off
echo ============================================
echo    Inside Inside Out - GCP Deployment
echo ============================================
echo.

REM Set your GCP project ID here
set PROJECT_ID=YOUR_GCP_PROJECT_ID
set REGION=us-central1
set BACKEND_SERVICE=insideout-backend

echo [1/4] Building and deploying backend to Cloud Run...
cd backend
gcloud run deploy %BACKEND_SERVICE% --source . --region %REGION% --allow-unauthenticated --set-env-vars "GEMINI_API_KEY=%GEMINI_API_KEY%,ELEVENLABS_API_KEY=%ELEVENLABS_API_KEY%"
cd ..

echo.
echo [2/4] Getting backend URL...
for /f "tokens=*" %%a in ('gcloud run services describe %BACKEND_SERVICE% --region %REGION% --format "value(status.url)"') do set BACKEND_URL=%%a
echo Backend deployed at: %BACKEND_URL%

echo.
echo [3/4] Building frontend with backend URL...
cd frontend
echo VITE_API_URL=%BACKEND_URL%/api > .env.production
call npm install
call npm run build
cd ..

echo.
echo [4/4] Deploying frontend to Firebase...
cd frontend
call firebase deploy --only hosting
cd ..

echo.
echo ============================================
echo    Deployment Complete!
echo ============================================
echo Backend:  %BACKEND_URL%
echo Frontend: Check Firebase console for URL
echo ============================================
