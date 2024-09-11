@echo off
:loop
echo Starting the bot...
node --trace-warnings client/client.js
echo Bot crashed with exit code %ERRORLEVEL%.
echo Restarting bot...
timeout /t 5
goto loop

