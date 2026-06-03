@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::   MDX BILLING SERVER - UNIFIED SERVER MANAGER v2.0
:: ============================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator Privileges...
    > "%temp%\mdx_billing_run.cmd" (
        echo @echo off
        echo cd /d "%~dp0"
        echo call "%~f0"
    )
    powershell -NoProfile -Command "Start-Process wt -ArgumentList ('cmd /c ' + $env:TEMP + '\mdx_billing_run.cmd') -Verb RunAs"
    exit /b
)

title MDX BILLING SERVER - Manager v2.0
color 07

set "PROJECT_DIR=%~dp0"
set "WEB_DIR=%PROJECT_DIR%"
set "CF_TOKEN=eyJhIjoiNjcwNmQ0YjI5MzZhNmUzMjdjOTM1ZTY3MWNmMzA3MzkiLCJ0IjoiNjVmYzdlNjktY2JkOS00Njg5LTg2OWQtMzZkYTEwM2MzYzljIiwicyI6IlltVTFNRGhsTURjdE5qYzNaQzAwTTJNeExUaG1PRE10TURjMU9XSXpaVGt6Tm1abCJ9"

:: ============================================================
::  MAIN MENU
:: ============================================================
:MENU
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|          MDX BILLING APP - UNIFIED MANAGER v2.0          ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   [1]  (DEV)   DEV MODE         localhost:8080           ^|
echo   ^|        - Start development server with live reload       ^|
echo   ^|                                                          ^|
echo   ^|   ----------------------------------------------------   ^|
echo   ^|                                                          ^|
echo   ^|   [2]  (BUILD) BUILD (Obfuscated) Production bundle      ^|
echo   ^|        - React Router Build + Production JS Obfuscation  ^|
echo   ^|                                                          ^|
echo   ^|   [3]  (FAST)  BUILD FAST       No obfuscation           ^|
echo   ^|        - React Router Build only                         ^|
echo   ^|                                                          ^|
echo   ^|   ----------------------------------------------------   ^|
echo   ^|                                                          ^|
echo   ^|   [4]  (DEPL)  PRODUCTION DEPLOY npm start (port 8080)   ^|
echo   ^|        - Serve the production bundle locally             ^|
echo   ^|                                                          ^|
echo   ^|   ----------------------------------------------------   ^|
echo   ^|                                                          ^|
echo   ^|   [5]  (CF)    CLOUDFLARE       Install/Start/Restart    ^|
echo   ^|        - Cloudflare Tunnel management                    ^|
echo   ^|                                                          ^|
echo   ^|   ----------------------------------------------------   ^|
echo   ^|                                                          ^|
echo   ^|   [6]  (STOP)  KILL ALL         Stop every service       ^|
echo   ^|        - Terminates Node.js and Cloudflared              ^|
echo   ^|                                                          ^|
echo   ^|   [0]  (EXIT)  EXIT                                      ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo.
set /p "choice=  -^> Enter option [0-6]: "

if "%choice%"=="1" goto DEV
if "%choice%"=="2" goto BUILD
if "%choice%"=="3" goto BUILD_FAST
if "%choice%"=="4" goto PRODUCTION
if "%choice%"=="5" goto CLOUDFLARE_MENU
if "%choice%"=="6" goto KILL_ALL
if "%choice%"=="0" goto EXIT
echo.
echo   [!] Invalid option. Try again.
timeout /t 2 >nul
goto MENU

:: ============================================================
::  [1] DEV MODE
:: ============================================================
:DEV
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|              (DEV) STARTING DEV MODE                     ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   App URL    : http://localhost:8080                     ^|
echo   ^|   Reload     : Hot reload enabled (react-router dev)     ^|
echo   ^|   Obfuscate  : DISABLED (dev mode)                       ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   [STOP] Press Ctrl+C to stop the dev server             ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo.
cd /d "%WEB_DIR%"
call npm run dev
echo.
echo   [STOP] Dev server stopped.
echo.
timeout /t 2 >nul
goto MENU

:: ===========================================================
::  [2] BUILD (Obfuscated)
:: ===========================================================
:BUILD
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|          (BUILD) BUILDING PRODUCTION BUNDLE              ^|
echo   ^|               (with obfuscation)                         ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   Step 1 :  React Router Build                           ^|
echo   ^|   Step 2 :  Obfuscate client JS chunks                   ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo.
cd /d "%WEB_DIR%"

echo   ... Running React Router build with Obfuscation...
call npm run build
if errorlevel 1 (
    echo.
    echo   +----------------------------------------------------------+
    echo   ^|   [ERR] Build failed! Fix errors and try again.          ^|
    echo   +----------------------------------------------------------+
    echo.
    pause
    goto MENU
)
echo   [OK] Build + obfuscation complete.
echo.

echo   +----------------------------------------------------------+
echo   ^|          [OK] BUILD COMPLETE!                            ^|
echo   ^|   Output : build\                                        ^|
echo   ^|   JS     : Obfuscated (client assets)                    ^|
echo   ^|   -^> Run option [4] to deploy to production.             ^|
echo   +----------------------------------------------------------+
echo.
pause
goto MENU

:: ===========================================================
::  [3] BUILD FAST (No Obfuscation)
:: ===========================================================
:BUILD_FAST
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|            (FAST) BUILDING FAST (no obfuscation)         ^|
echo   +----------------------------------------------------------+
echo.
cd /d "%WEB_DIR%"

echo   ... Running React Router build (fast)...
call npm run build:fast
if errorlevel 1 (
    echo.
    echo   +----------------------------------------------------------+
    echo   ^|   [ERR] Build failed! Fix errors and try again.          ^|
    echo   +----------------------------------------------------------+
    echo.
    pause
    goto MENU
)
echo.
echo   +----------------------------------------------------------+
echo   ^|          [OK] FAST BUILD COMPLETE! (not obfuscated)      ^|
echo   ^|   Output : build\                                        ^|
echo   ^|   -^> Run option [4] to deploy to production.             ^|
echo   +----------------------------------------------------------+
echo.
pause
goto MENU

:: ===========================================================
::  [4] PRODUCTION DEPLOY
:: ===========================================================
:PRODUCTION
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|          (DEPL) DEPLOYING TO PRODUCTION                  ^|
echo   +----------------------------------------------------------+
echo.
cd /d "%WEB_DIR%"

if not exist "build\server\index.js" (
    echo   [ERR] No build found! Run option [2] or [3] first.
    echo.
    pause
    goto MENU
)

echo   [OK] Build verified (build\server\index.js exists)
echo.
echo   ... Starting production server (npm start)...
echo.
echo   +----------------------------------------------------------+
echo   ^|          [OK] PRODUCTION SERVER RUNNING!                 ^|
echo   ^|   URL        : http://localhost:8080                     ^|
echo   ^|   [STOP] Press Ctrl+C to stop                            ^|
echo   +----------------------------------------------------------+
echo.
npm start
echo.
echo   [STOP] Production server stopped.
echo.
timeout /t 2 >nul
goto MENU

:: ===========================================================
::  [5] CLOUDFLARE MENU
:: ===========================================================
:CLOUDFLARE_MENU
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|        (CF) CLOUDFLARE TUNNEL - Control Panel            ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   Binary : cloudflared.exe (must be in PATH)             ^|
echo   ^|   Port   : 8080 (React Router Server)                    ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   [1]  Install Tunnel    - Fresh install                 ^|
echo   ^|   [2]  Start Service     - net start cloudflared         ^|
echo   ^|   [3]  Restart Tunnel    - Uninstall + Reinstall         ^|
echo   ^|   [4]  Stop Service      - net stop cloudflared          ^|
echo   ^|   [5]  Uninstall Tunnel                                  ^|
echo   ^|   [6]  Service Status    - Check if running              ^|
echo   ^|                                                          ^|
echo   ^|   [0]  Back to Main Menu                                 ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo.
set /p "cf_choice=  -^> Select action [0-6]: "

if "%cf_choice%"=="1" (
    cls
    echo.
    echo   ... Installing Cloudflare Tunnel...
    cloudflared service uninstall >nul 2>&1
    timeout /t 1 >nul
    cloudflared.exe service install %CF_TOKEN%
    echo.
    echo   [OK] Cloudflare Tunnel installed as Windows service.
    echo.
    pause
    goto CLOUDFLARE_MENU
)
if "%cf_choice%"=="2" (
    cls
    echo.
    echo   ... Starting Cloudflare Service...
    net start cloudflared
    echo.
    pause
    goto CLOUDFLARE_MENU
)
if "%cf_choice%"=="3" (
    cls
    echo.
    echo   ... Restarting Cloudflare Tunnel...
    echo   ... Stopping existing service...
    net stop cloudflared >nul 2>&1
    cloudflared service uninstall >nul 2>&1
    timeout /t 2 >nul
    echo   ... Reinstalling tunnel...
    cloudflared.exe service install %CF_TOKEN%
    timeout /t 2 >nul
    echo   [OK] Cloudflare Tunnel restarted!
    echo.
    pause
    goto CLOUDFLARE_MENU
)
if "%cf_choice%"=="4" (
    cls
    echo.
    echo   ... Stopping Cloudflare Service...
    net stop cloudflared
    echo.
    pause
    goto CLOUDFLARE_MENU
)
if "%cf_choice%"=="5" (
    cls
    echo.
    echo   ... Uninstalling Cloudflare Tunnel...
    net stop cloudflared >nul 2>&1
    cloudflared service uninstall
    echo   [OK] Cloudflare Tunnel uninstalled.
    echo.
    pause
    goto CLOUDFLARE_MENU
)
if "%cf_choice%"=="6" (
    cls
    echo.
    echo   [CF] Cloudflare Service Status:
    echo   -------------------------------------------------
    sc query cloudflared 2>nul
    if %errorlevel% neq 0 (
        echo   [!] cloudflared service is NOT installed.
    )
    echo.
    echo   [CF] cloudflared Process Check:
    tasklist /FI "IMAGENAME eq cloudflared.exe" /FO TABLE 2>nul
    echo.
    pause
    goto CLOUDFLARE_MENU
)
if "%cf_choice%"=="0" goto MENU
echo   [!] Invalid option.
timeout /t 2 >nul
goto CLOUDFLARE_MENU

:: ===========================================================
::  [6] KILL ALL
:: ===========================================================
:KILL_ALL
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|          (STOP) KILLING ALL SERVICES                     ^|
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|   - Billing App server (Node.js)                         ^|
echo   ^|   - Cloudflare Tunnel service                            ^|
echo   ^|   - Dev mode cleanup                                     ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo.

echo   ... Killing all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Node.js processes killed.
) else (
    echo   [!] No Node.js processes running.
)
echo.

echo   ... Stopping Cloudflare service...
net stop cloudflared >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Cloudflare stopped.
) else (
    echo   [!] Cloudflare service not active or not installed.
)
echo.

echo   +----------------------------------------------------------+
echo   ^|          [OK] ALL SERVICES STOPPED!                      ^|
echo   +----------------------------------------------------------+
echo.
pause
goto MENU

:: ===========================================================
::  [0] EXIT
:: ===========================================================
:EXIT
cls
echo.
echo   +----------------------------------------------------------+
echo   ^|                                                          ^|
echo   ^|         👋 Goodbye! - MDX BILLING SERVER v2.0            ^|
echo   ^|                                                          ^|
echo   +----------------------------------------------------------+
echo.
timeout /t 2 >nul
exit
