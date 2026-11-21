@echo off
cd /d "%~dp0"
set "NODE=%~dp0.tools\node-v24.22.0-win-x64\node.exe"
if not exist "%NODE%" (
  echo Node was not found next to this file.
  echo The shop cannot start until that program is present.
  pause
  exit /b 1
)
echo Petite Botanicals is at http://localhost:3000
echo The desk is at http://localhost:3000/admin
echo Leave this window open. Closing it stops the shop.
"%NODE%" server.js
echo The shop stopped.
pause
