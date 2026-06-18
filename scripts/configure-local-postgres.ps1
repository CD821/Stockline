$ErrorActionPreference = "Stop"

$appDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $appDir ".env"
$statusPath = Join-Path $env:TEMP "stockline-postgres-setup-status.json"
$nodePath = "C:\Users\clopez\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

function Write-SetupStatus {
  param(
    [string]$Status,
    [string]$Message
  )

  $payload = @{
    status = $Status
    message = $Message
    timestamp = (Get-Date).ToString("o")
  } | ConvertTo-Json

  [System.IO.File]::WriteAllText(
    $statusPath,
    $payload,
    [System.Text.UTF8Encoding]::new($false)
  )
}

Remove-Item -LiteralPath $statusPath -ErrorAction SilentlyContinue
Set-Location -LiteralPath $appDir

Write-Host ""
Write-Host "Stockline PostgreSQL setup" -ForegroundColor Cyan
Write-Host "Enter the password for the PostgreSQL role: stockline"
Write-Host "The password stays on this computer in the ignored .env file."
Write-Host ""

$securePassword = Read-Host "Database password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
  $securePassword
)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    $passwordPointer
  )
  if ([string]::IsNullOrWhiteSpace($plainPassword)) {
    throw "A database password is required."
  }

  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $configuration = @(
    "DATABASE_URL=postgresql://stockline:$encodedPassword@127.0.0.1:5432/stockline"
    "DATABASE_SSL=disable"
    "PORT=4387"
    "SESSION_HOURS=12"
    "COOKIE_SECURE=false"
  ) -join [Environment]::NewLine

  [System.IO.File]::WriteAllText(
    $envPath,
    "$configuration$([Environment]::NewLine)",
    [System.Text.UTF8Encoding]::new($false)
  )

  $env:PGPASSWORD = $plainPassword
  Write-Host ""
  Write-Host "Testing database login..." -ForegroundColor Yellow
  & $psqlPath `
    -h 127.0.0.1 `
    -p 5432 `
    -U stockline `
    -d stockline `
    -v ON_ERROR_STOP=1 `
    -c "select current_database(), current_user;"
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL rejected the connection. Check the password and role ownership."
  }

  Write-Host "Creating database tables..." -ForegroundColor Yellow
  & $nodePath --env-file=.env scripts/migrate.mjs
  if ($LASTEXITCODE -ne 0) {
    throw "The database migration did not complete."
  }

  Write-Host "Importing users and inventory..." -ForegroundColor Yellow
  & $nodePath --env-file=.env scripts/seed.mjs
  if ($LASTEXITCODE -ne 0) {
    throw "The database seed did not complete."
  }

  $counts = & $psqlPath `
    -h 127.0.0.1 `
    -p 5432 `
    -U stockline `
    -d stockline `
    -At `
    -c "select (select count(*) from inventory_items) || ' inventory items, ' || (select count(*) from users) || ' users';"
  if ($LASTEXITCODE -ne 0) {
    throw "The database was initialized, but verification failed."
  }

  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

  try {
    $health = Invoke-RestMethod `
      -Uri "http://127.0.0.1:4387/api/health" `
      -TimeoutSec 2
  } catch {
    Start-Process `
      -FilePath $nodePath `
      -ArgumentList @("--env-file=.env", "serve.mjs") `
      -WorkingDirectory $appDir `
      -WindowStyle Hidden
    Start-Sleep -Seconds 2
  }

  $health = Invoke-RestMethod `
    -Uri "http://127.0.0.1:4387/api/health" `
    -TimeoutSec 5
  if (-not $health.connected) {
    throw "The website started, but its database health check failed."
  }

  $message = "Setup complete: $counts"
  Write-SetupStatus -Status "success" -Message $message
  Write-Host ""
  Write-Host $message -ForegroundColor Green
  Write-Host "Stockline is running at http://127.0.0.1:4387/" -ForegroundColor Green
} catch {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Write-SetupStatus -Status "failed" -Message $_.Exception.Message
  Write-Host ""
  Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $plainPassword = $null
}

Write-Host ""
Read-Host "Press Enter to close this window"
