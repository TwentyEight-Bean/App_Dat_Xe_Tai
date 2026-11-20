@echo off
chcp 65001 >nul
echo =======================================================
echo     ĐANG ĐÓNG GÓI APK CHO APP: VẬN TẢI SIÊU TỐC
echo =======================================================

cd /d %~dp0

echo 1. Build mã nguồn Web (Vite React)...
call pnpm build

echo 2. Đồng bộ mã nguồn sang Native Android...
call npx cap sync android

echo 3. Thiết lập Java JDK 23...
set "JAVA_HOME=C:\Program Files\Java\jdk-23"
set "Path=C:\Program Files\Java\jdk-23\bin;%Path%"

echo 4. Biên dịch APK bằng Gradle...
cd android
call gradlew.bat assembleDebug

echo 5. Copy file APK ra thư mục gốc...
cd ..
copy /y android\app\build\outputs\apk\debug\app-debug.apk Van_Tai_Sieu_Toc.apk

echo =======================================================
echo  ĐÃ ĐÓNG GÓI XONG FILE: Van_Tai_Sieu_Toc.apk
echo =======================================================
pause
