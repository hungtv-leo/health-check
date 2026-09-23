<#
.SYNOPSIS
    Runner cho bo auto-check TNMath V6 - dung cho chay theo lich (Windows Task Scheduler).

.DESCRIPTION
    Chay lan luot hai suite trong cung mot lan goi:
    - npm test          → Auto Check Web Học Thi
    - npm run test:cms  → Auto Check Web Quản Trị
    Moi suite gui 1 summary Discord. Script nay chi lo: ve dung thu muc repo,
    chay ca hai suite, ghi log co timestamp, va tra exit code (loi neu mot suite do).

    Ghi chu 1: KHONG dat $ErrorActionPreference='Stop' - npm/playwright ghi tien trinh
    ra stderr, neu Stop se coi la loi terminating va thoat som (false-fail).

    Ghi chu 2: Tren Windows, node.exe doi khi crash luc teardown (libuv assertion
    UV_HANDLE_CLOSING, exit 0xC0000409) SAU khi test da chay xong. De tranh false-fail,
    exit code cua script duoc suy ra tu dong summary cua Playwright ("N passed" /
    "N failed") thay vi tu exit code cua node (co the bi hong boi crash teardown).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\run-checks.ps1
#>

$ErrorActionPreference = 'Continue'

# Repo root = thu muc cha cua scripts\
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# Log ghi UTF-8 de khong bi vo tieng Viet tu playwright
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Thu muc log (gitignored qua *.log)
$LogDir = Join-Path $RepoRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$Stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile = Join-Path $LogDir "run-$Stamp.log"

"[{0}] START auto-check tai {1}" -f (Get-Date -Format o), $RepoRoot |
    Tee-Object -FilePath $LogFile

# Suy ra ket qua tu summary Playwright (doc lap voi crash teardown cua node).
function Get-PlaywrightExit([string]$Joined, [int]$NpmExit) {
    if ($Joined -match '(?m)^\s*\d+\s+(failed|interrupted|timedOut)') { return 1 }
    if ($Joined -match '(?m)^\s*\d+\s+passed') { return 0 }
    if ($NpmExit -ne 0) { return 1 }
    return 1
}

function Invoke-CheckSuite([string]$Label, [string]$NpmScript) {
    "[{0}] START {1} ({2})" -f (Get-Date -Format o), $Label, $NpmScript |
        Tee-Object -FilePath $LogFile -Append | Out-Null
    $output = & npm run $NpmScript 2>&1 | Tee-Object -FilePath $LogFile -Append
    $npmExit = $LASTEXITCODE
    $code = Get-PlaywrightExit ($output | Out-String) $npmExit
    "[{0}] END {1}. playwright-derived exit = {2} (npm raw exit = {3})" -f (Get-Date -Format o), $Label, $code, $npmExit |
        Tee-Object -FilePath $LogFile -Append | Out-Null
    return $code
}

# Hoc Thi truoc, Quan Tri sau. Suite truoc do van chay suite sau de ca hai deu co bao cao.
$codeHocThi  = Invoke-CheckSuite "Web Học Thi" "test"
$codeQuanTri = Invoke-CheckSuite "Web Quản Trị" "test:cms"
$ExitCode = 0
if ($codeHocThi -ne 0 -or $codeQuanTri -ne 0) { $ExitCode = 1 }

"[{0}] END. combined exit = {1} (hoc-thi = {2}, quan-tri = {3})" -f (Get-Date -Format o), $ExitCode, $codeHocThi, $codeQuanTri |
    Tee-Object -FilePath $LogFile -Append

# Don log cu hon 30 ngay
Get-ChildItem $LogDir -Filter 'run-*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

exit $ExitCode
