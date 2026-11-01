param([Parameter(Mandatory = $true)][string]$OutputParent)

$ErrorActionPreference = "Stop"
if ($env:GITHUB_ACTIONS -ne "true" -or $env:RUNNER_OS -ne "Windows") {
  throw "Recorded MSVC provisioning is restricted to a disposable Windows CI runner."
}
$repository = Split-Path $PSScriptRoot -Parent
$configuration = Get-Content -LiteralPath (Join-Path $repository "native/WINDOWS-CI-TOOLCHAIN.json") -Raw | ConvertFrom-Json
$record = Get-Content -LiteralPath (Join-Path $repository "native/WINDOWS-BUILD.json") -Raw | ConvertFrom-Json
if ($record.librarian -ne "Microsoft (R) Library Manager Version $($configuration.servicingVersion).0") {
  throw "The CI provisioning policy does not match the recorded MSVC toolset."
}
$diagnostics = Join-Path $OutputParent "recorded-msvc-provisioning"
$setup = Join-Path $OutputParent "vs-buildtools-recorded.exe"
$installation = Join-Path $OutputParent "recorded-msvc-18.11.2"
if ((Test-Path -LiteralPath $diagnostics) -or (Test-Path -LiteralPath $setup) -or (Test-Path -LiteralPath $installation)) {
  throw "Recorded MSVC provisioning requires fresh runner-owned paths."
}
New-Item -ItemType Directory -Path $diagnostics | Out-Null
$started = [DateTime]::UtcNow
$result = [ordered]@{ schemaVersion = 1; status = "started"; configuration = $configuration }
$exitStatus = 0
try {
  Invoke-WebRequest -Uri $configuration.bootstrapper.url -OutFile $setup
  $size = (Get-Item -LiteralPath $setup).Length
  $sha256 = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($size -ne $configuration.bootstrapper.bytes -or $sha256 -ne $configuration.bootstrapper.sha256) {
    throw "The fixed official Visual Studio bootstrapper size or SHA-256 differs."
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $setup
  if ($signature.Status -ne "Valid" -or $signature.SignerCertificate.Subject -notmatch "(^|,\s*)O=Microsoft Corporation(,|$)") {
    throw "The fixed bootstrapper must have a valid Microsoft Authenticode signature."
  }
  $result.bootstrapperSignature = [ordered]@{
    status = [string]$signature.Status
    subject = $signature.SignerCertificate.Subject
    thumbprint = $signature.SignerCertificate.Thumbprint
    sha256 = $sha256
    bytes = $size
  }
  # Preserve the official setup engine's content/signature/package validation.
  # A manually observed catalog discrepancy is not an integrity override.
  $arguments = @(
    "--quiet", "--wait", "--norestart", "--nocache",
    "--installPath", "`"$installation`"",
    "--installChannelUri", $configuration.channelUri,
    "--channelUri", $configuration.channelUri,
    "--installCatalogUri", $configuration.catalogUri,
    "--add", $configuration.component
  )
  $result.arguments = $arguments
  $installer = Start-Process -FilePath $setup -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
  $result.installerExitCode = $installer.ExitCode
  if ($installer.ExitCode -ne 0) {
    throw "Official Visual Studio setup failed or requires a reboot: $($installer.ExitCode)."
  }
  $result.status = "installed-pending-exact-rebuild"
} catch {
  $exitStatus = 1
  $result.status = "failed"
  $result.failure = $_.ToString()
  Write-Error -ErrorRecord $_ -ErrorAction Continue
} finally {
  try {
    foreach ($pattern in @("dd_bootstrapper_*.log", "dd_setup_*.log", "dd_installer_*.log")) {
      Get-ChildItem -LiteralPath $env:TEMP -Filter $pattern -File |
        Where-Object { $_.LastWriteTimeUtc -ge $started } |
        ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $diagnostics $_.Name) }
    }
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $diagnostics "provisioning.json") -Encoding utf8
  } catch {
    Write-Warning "MSVC diagnostic collection failed: $_"
    $exitStatus = 1
  }
}
exit $exitStatus
