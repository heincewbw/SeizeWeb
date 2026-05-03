# Deploy SeizeBridge.ex4 ke semua VPS
# Requires: WinSCP .NET assembly — https://winscp.net/eng/download.php
# Jalankan: .\deploy-ea.ps1

$exaFile = "D:\Source\SeizeWeb\mt4-ea\SeizeBridge.ex4"  # path .ex4 hasil compile lokal
$remoteDir = "/c/Users/Administrator/AppData/Roaming/MetaQuotes/Terminal/[TERMINAL_ID]/MQL4/Experts/"

# Daftar semua VPS
$vpsList = @(
    @{ Host = "VPS1_IP";  User = "Administrator"; Password = "VPS1_PASS"; Port = 22 },
    @{ Host = "VPS2_IP";  User = "Administrator"; Password = "VPS2_PASS"; Port = 22 },
    @{ Host = "VPS3_IP";  User = "Administrator"; Password = "VPS3_PASS"; Port = 22 },
    # ... tambah sampai VPS15
)

# Load WinSCP assembly
Add-Type -Path "C:\Program Files (x86)\WinSCP\WinSCPnet.dll"

foreach ($vps in $vpsList) {
    Write-Host "Deploying to $($vps.Host)..." -ForegroundColor Cyan
    try {
        $sessionOptions = New-Object WinSCP.SessionOptions -Property @{
            Protocol              = [WinSCP.Protocol]::Sftp
            HostName              = $vps.Host
            UserName              = $vps.User
            Password              = $vps.Password
            PortNumber            = $vps.Port
            GiveUpSecurityAndAcceptAnySshHostKey = $true
        }
        $session = New-Object WinSCP.Session
        $session.Open($sessionOptions)
        $session.PutFiles($exaFile, $remoteDir).Check()
        $session.Dispose()
        Write-Host "  OK: $($vps.Host)" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED: $($vps.Host) — $_" -ForegroundColor Red
    }
}

Write-Host "`nDone. Restart MT4 di masing-masing VPS atau tunggu EA auto-detect." -ForegroundColor Yellow
