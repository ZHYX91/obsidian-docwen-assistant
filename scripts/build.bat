@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ==========================================
echo   Obsidian 插件智能构建脚本
echo   DocWen Assistant
echo ==========================================
echo.

REM 切换到插件目录
cd /d "%~dp0.."

REM 从 manifest.json 读取插件 ID
echo [1/7] 读取插件信息...
for /f "usebackq tokens=*" %%i in (`node -e "console.log(require('./manifest.json').id)"`) do set PLUGIN_ID=%%i
for /f "usebackq tokens=*" %%i in (`node -e "console.log(require('./manifest.json').name)"`) do set PLUGIN_NAME=%%i

if "%PLUGIN_ID%"=="" (
    echo   ✗ 无法读取插件 ID
    pause
    exit /b 1
)
echo   ✓ 插件 ID: %PLUGIN_ID%
echo   ✓ 插件名称: %PLUGIN_NAME%
echo.

REM 检查 node_modules 是否存在
echo [2/7] 检查依赖包...
if not exist "node_modules\" (
    echo   ⚠ 未发现 node_modules，开始安装依赖...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   ✗ 依赖安装失败！
        echo   请检查网络连接或手动运行: npm install
        pause
        exit /b 1
    )
    echo   ✓ 依赖安装完成
) else (
    echo   ✓ 依赖包已存在
)
echo.

REM 清理旧的构建文件
echo [3/7] 清理旧的构建文件...
if exist "dist\" rmdir /s /q "dist"
if exist "release\" rmdir /s /q "release"
echo   ✓ 清理完成
echo.

REM 编译 TypeScript
echo [4/7] 编译 TypeScript...
echo   使用完整构建模式（类型检查 + 代码压缩）
call npm run build
if errorlevel 1 (
    echo.
    echo   ✗ 编译失败！
    echo   请检查代码是否有错误
    pause
    exit /b 1
)
echo   ✓ 编译成功
echo.

REM 检查编译结果
if not exist "dist\main.js" (
    echo   ✗ 错误: dist\main.js 未生成
    pause
    exit /b 1
)

REM 创建/清理 release 目录
echo [5/7] 准备发布目录...
set RELEASE_DIR=release\%PLUGIN_ID%
if exist "release\" (
    rmdir /s /q "release"
)
mkdir "%RELEASE_DIR%"
echo   ✓ 目录已创建: %RELEASE_DIR%
echo.

REM 复制必需文件
echo [6/7] 复制插件文件...
copy /y "dist\main.js" "%RELEASE_DIR%\main.js" >nul
if errorlevel 1 (
    echo   ✗ 复制 main.js 失败
    pause
    exit /b 1
)
echo   ✓ 已复制: main.js

copy /y "manifest.json" "%RELEASE_DIR%\manifest.json" >nul
if errorlevel 1 (
    echo   ✗ 复制 manifest.json 失败
    pause
    exit /b 1
)
echo   ✓ 已复制: manifest.json

REM 可选：复制 styles.css（如果存在）
if exist "styles.css" (
    copy /y "styles.css" "%RELEASE_DIR%\styles.css" >nul
    echo   ✓ 已复制: styles.css
)
echo.

REM 复制用户版 README 文件（多语言）
echo [7/7] 复制用户文档...
if exist "docs\plugin-readme\" (
    for %%f in (docs\plugin-readme\README*.md) do (
        copy /y "%%f" "%RELEASE_DIR%\" >nul
        echo   ✓ 已复制: %%~nxf
    )
) else (
    echo   ⚠ 未找到 docs\plugin-readme 目录，跳过 README 复制
)
echo.

REM 显示成功信息
echo ==========================================
echo   ✨ 构建完成！
echo ==========================================
echo.
echo 输出位置: %CD%\%RELEASE_DIR%
echo.
echo 包含文件:
dir /b "%RELEASE_DIR%"
echo.
echo ==========================================
echo.

REM 自动打开输出文件夹
start "" "%CD%\release"

echo Next: Copy release\%PLUGIN_ID% to your Obsidian vault's .obsidian\plugins\ folder
echo.
pause
