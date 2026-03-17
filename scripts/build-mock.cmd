@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%" || call :fail "Failed to cd to %ROOT%."

set "VITE_USE_PLATFORM_MOCK=1"

for %%P in (generic yandex vkplay rustore) do (
  echo === Building %%P [mock] ===
  call npm run build:%%P
  if errorlevel 1 call :fail "Build %%P [mock] failed."
  powershell -NoProfile -Command "Compress-Archive -Path '%ROOT%\dist\%%P\*' -DestinationPath '%ROOT%\dist\lumelines-%%P-mock.zip' -Force"
  if errorlevel 1 call :fail "Archive %%P [mock] failed."
)

endlocal
echo All mock builds completed successfully.
pause
exit /b 0

:fail
echo ERROR: %~1
pause
exit /b 1
