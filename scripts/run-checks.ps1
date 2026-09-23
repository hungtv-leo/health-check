<#
.SYNOPSIS
    Runner cho bo auto-check TNMath V6 - dung cho chay theo lich (Windows Task Scheduler).

.DESCRIPTION
    Chay `npm test` (full Playwright suite). Ket qua tong ket duoc gui len Discord
    boi reporter trong repo. Script nay chi lo: ve dung thu muc repo, chay suite,
    ghi log co timestamp, va tra exit code phan anh dung ket qua test.

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

# Chay full suite; gop stdout+stderr vao log VA giu lai output de suy ra ket qua.
$output  = & npm test 2>&1 | Tee-Object -FilePath $LogFile -Append
$npmExit = $LASTEXITCODE
$joined  = ($output | Out-String)

# Suy ra ket qua tu summary cua Playwright (doc lap voi crash teardown cua node).
if ($joined -match '(?m)^\s*\d+\s+(failed|interrupted|timedOut)') {
    $ExitCode = 1                       # co case fail/interrupt
} elseif ($joined -match '(?m)^\s*\d+\s+passed') {
    $ExitCode = 0                       # tat ca pass (bo qua crash luc node thoat)
} else {
    $ExitCode = 1                       # khong thay summary -> run khong hoan tat
}

"[{0}] END. playwright-derived exit = {1} (npm raw exit = {2})" -f (Get-Date -Format o), $ExitCode, $npmExit |
    Tee-Object -FilePath $LogFile -Append

# Don log cu hon 30 ngay
Get-ChildItem $LogDir -Filter 'run-*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

exit $ExitCode
