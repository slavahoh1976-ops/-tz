@echo off
cd /d "%~dp0"
where py >/dev/null 2>/dev/null && (py -3 winch_control.py) || (python winch_control.py)
if errorlevel 1 (echo. & echo Python 3 is required: https://www.python.org/downloads/ & pause)
