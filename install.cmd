@echo off
setlocal
echo Running Oh My Pi Windows configuration installer...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
endlocal
