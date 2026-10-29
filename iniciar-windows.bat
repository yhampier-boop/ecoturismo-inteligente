@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo =====================================================
echo       ECOTURISMO INTELIGENTE - INICIO LOCAL
 echo =====================================================
where node >nul 2>nul || (echo No tienes Node.js instalado. Instala Node.js 22 o posterior. & pause & exit /b 1)
if not exist "node_modules" (
 echo Instalando dependencias de React y Express...
 call npm install || (echo No se pudieron instalar las dependencias. & pause & exit /b 1)
)
echo.
echo IMPORTANTE: inicia MySQL (y Apache) desde el panel de XAMPP antes de continuar.
echo Abre http://localhost:5173 en tu navegador.
echo El servidor funciona en http://localhost:4000
echo La base de datos se administra en http://localhost/phpmyadmin (ecoturismo_db).
echo Las API externas se activan si backend\.env tiene las claves configuradas.
echo.
call npm run dev
pause
