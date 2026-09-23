# start-preview.ps1 — Start backend + frontend for local preview
$ErrorActionPreference = 'Stop'

$backendDir = 'C:\Users\chigozie\Documents\trae_projects\YID Due Ledger'
$frontendDir = Join-Path $backendDir 'frontend'

# --- Kill stale processes ---
Write-Host '=== Killing stale node processes ===' -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq 0 } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# --- Start Backend ---
Write-Host ''; Write-Host '=== Starting Backend (Express :3000 + OAuth) ===' -ForegroundColor Cyan
$backendLog = Join-Path $backendDir 'server-preview.log'
$psiB = New-Object System.Diagnostics.ProcessStartInfo
$psiB.FileName = 'node'
$psiB.Arguments = 'server.js'
$psiB.WorkingDirectory = $backendDir
$psiB.RedirectStandardOutput = $true
$psiB.RedirectStandardError = $true
$psiB.UseShellExecute = $false
$backendProc = [System.Diagnostics.Process]::Start($psiB)
Start-Sleep -Seconds 4

# Check backend health
try {
    $health = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 5
    Write-Host "Backend health: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "Backend health check failed: $_" -ForegroundColor Red
}

# --- Start Frontend (Vite) ---
Write-Host ''; Write-Host '=== Starting Frontend (Vite :5173) ===' -ForegroundColor Cyan
$frontendLog = Join-Path $frontendDir 'vite-preview.log'
$psiF = New-Object System.Diagnostics.ProcessStartInfo
$psiF.FileName = 'npm'
$psiF.Arguments = 'run', 'dev'
$psiF.WorkingDirectory = $frontendDir
$psiF.RedirectStandardOutput = $true
$psiF.RedirectStandardError = $true
$psiF.UseShellExecute = $false
$frontendProc = [System.Diagnostics.Process]::Start($psiF)

# Wait for Vite to start and capture logs
Start-Sleep -Seconds 10

# Try to read what Vite outputted
Write-Host ''; Write-Host '=== Frontend Log (last 25 lines) ===' -ForegroundColor Cyan
if (Test-Path $frontendLog) {
    Get-Content $frontendLog -Tail 25
} else {
    Write-Host '(no log file yet — checking process stream)' -ForegroundColor Yellow
    $output = $frontendProc.StandardOutput.ReadToEnd()
    if ($output) {
        $output | Select-Object -Last 25
    } else {
        Write-Host '(no output captured yet)' -ForegroundColor Yellow
    }
}

# Check frontend health
Write-Host ''; Write-Host '=== Health Checks ===' -ForegroundColor Cyan
$feOk = $false
try {
    $feResp = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 5
    $feOk = $true
    Write-Host 'Frontend:  OK (HTTP ' + $feResp.StatusCode + ')' -ForegroundColor Green
} catch {
    Write-Host 'Frontend:  NOT RESPONDING on :5173' -ForegroundColor Yellow
}

$beOk = $false
try {
    $beResp = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 5
    $beOk = $true
    Write-Host 'Backend:   OK - ' + $beResp.Content -ForegroundColor Green
} catch {
    Write-Host 'Backend:   NOT RESPONDING' -ForegroundColor Red
}

# Show listening ports
Write-Host ''; Write-Host '=== Listening Ports ===' -ForegroundColor Cyan
netstat -ano | Select-String 'LISTENING' | Select-String '3000|5173'

# Summary
Write-Host ''; Write-Host '=== PREVIEW URLs ===' -ForegroundColor Green
Write-Host '  Frontend:  http://localhost:5173' -ForegroundColor White
Write-Host '  Backend:   http://localhost:3000 (OAuth: /oauth/consent)' -ForegroundColor White
Write-Host '  API Health: http://localhost:3000/api/health' -ForegroundColor White
Write-Host ''
Write-Host 'Press Ctrl+C to stop. Servers are running in background.' -ForegroundColor Yellow
