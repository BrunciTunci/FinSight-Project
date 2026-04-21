@echo off
echo Pokrecem FinSight Aplikaciju...

:: 1. Pokreni Backend (u novom prozoru)
cd "C:\Users\Bruno\OneDrive - CARNET\Desktop\FinSight-Project\FinSight.Api"
start "FinSight Backend" cmd /k "dotnet run --launch-profile https"

:: Pričekaj 5 sekundi da se backend upali
timeout /t 5

:: 2. Pokreni Frontend (u novom prozoru)
cd "C:\Users\Bruno\OneDrive - CARNET\Desktop\FinSight-Project\FinSight.Web"
start "FinSight Frontend" cmd /k "npm run dev"

:: 3. Otvori Chrome (opcionalno, jer Vite to nekad sam radi, ali za svaki slucaj)
timeout /t 2
start http://localhost:5173

echo Sve je pokrenuto! Ne gasi crne prozore.