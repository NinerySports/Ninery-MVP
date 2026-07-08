$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $repoRoot "ninery"
$nodeInstallPath = "C:\Program Files\nodejs"
$corepackHome = Join-Path $PSScriptRoot "corepack"
$corepackBin = Join-Path $PSScriptRoot "bin"

if ((Test-Path $nodeInstallPath) -and ($env:Path -notlike "*$nodeInstallPath*")) {
  $env:Path = "$nodeInstallPath;$env:Path"
}

if ($env:Path -notlike "*$corepackBin*") {
  $env:Path = "$corepackBin;$env:Path"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw @"
Node.js is required before pnpm can be prepared with Corepack.

Install Node.js LTS in the Codex environment, then restart the shell so node and corepack are on PATH.

Recommended Windows setup command:
  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements

After Node is installed, rerun this setup script.
"@
}

if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw "Corepack is not available on PATH. Install a Node.js LTS build that includes Corepack, or add Corepack to PATH."
}

Set-Location $appRoot

$env:COREPACK_HOME = $corepackHome
New-Item -ItemType Directory -Force -Path $env:COREPACK_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $corepackBin | Out-Null

try {
  corepack enable --install-directory $corepackBin
}
catch {
  Write-Warning "Corepack could not create local pnpm shims. Continuing with 'corepack pnpm' instead."
}

corepack prepare pnpm@latest --activate
pnpm install
pnpm --version
pnpm prisma generate
