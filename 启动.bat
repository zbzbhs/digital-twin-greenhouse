@echo off
chcp 65001 >nul
title 智慧农业数字孪生平台

echo ==========================================
echo   智慧农业数字孪生平台 v1.0
echo   番茄全流程自动授粉
echo ==========================================
echo.

:: 杀掉旧端口
netstat -ano | findstr ":8080" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>nul
)
netstat -ano | findstr ":8081" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>nul
)

:: 检测 Python
where python >nul 2>nul || (
    echo ❌ 未检测到 Python，请安装后运行
    pause & exit /b
)

:: 启动代理（后台隐藏窗口）
start /min "" python nle_proxy.py

:: 启动主服务器
echo ✅ 服务启动中...
start /min "" python -m http.server 8080

:: 等 2 秒后打开浏览器
timeout /t 2 /nobreak >nul
start http://localhost:8080/

echo.
echo   📍 http://localhost:8080/
echo   🛡 NLE 代理: http://localhost:8081/
echo.
echo   关闭此窗口停止所有服务
pause
