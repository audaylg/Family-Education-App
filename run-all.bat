@echo off
rem One-shot: install, build, start the app, run e2e tests. Logs go to F:\Family-Education-App\logs
cd /d F:\Family-Education-App || exit /b 1
if not exist logs mkdir logs
echo [1/4] npm install...
call npm install > logs\npm-install.log 2>&1 || (echo FAILED: see logs\npm-install.log & exit /b 1)
echo [2/4] npm run build...
call npm run build > logs\build.log 2>&1 || (echo FAILED: see logs\build.log & exit /b 1)
echo [3/4] starting app on http://localhost:3000 ...
start "family-edu-server" /min cmd /c "npm start > logs\server.log 2>&1"
timeout /t 12 /nobreak >nul
echo [4/4] e2e tests...
call npm run test:e2e > logs\e2e.log 2>&1
type logs\e2e.log
echo.
echo Report: logs\test-report.md   App: http://localhost:3000
