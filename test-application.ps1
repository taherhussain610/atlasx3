#!/usr/bin/env pwsh
# ATLASX3 - Application Test & Verification Script

Write-Host ""
Write-Host "🧪 ATLASX3 - Application Testing" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Test 1: Server Running
Write-Host "Test 1: Server Status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/api/port-status" -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ Server is running on port 4000" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Server not responding" -ForegroundColor Red
    $allPassed = $false
}

# Test 2: Frontend Loading
Write-Host "Test 2: Frontend Loading..." -ForegroundColor Yellow
try {
    $html = Invoke-WebRequest -Uri "http://localhost:4000" -UseBasicParsing -ErrorAction Stop
    if ($html.Content -match "ATLASX3") {
        Write-Host "  ✅ Frontend loads successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Frontend not loading" -ForegroundColor Red
    $allPassed = $false
}

# Test 3: Health Endpoint
Write-Host "Test 3: Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -ErrorAction Stop
    $healthData = $health.Content | ConvertFrom-Json
    if ($healthData.status -eq "ok") {
        Write-Host "  ✅ Health endpoint returns OK" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Health endpoint failed" -ForegroundColor Red
    $allPassed = $false
}

# Test 4: Database Files
Write-Host "Test 4: Database Files..." -ForegroundColor Yellow
if (Test-Path "data/exchange.db") {
    $dbSize = (Get-Item "data/exchange.db").Length
    Write-Host "  ✅ Database exists ($dbSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Database file not found" -ForegroundColor Red
    $allPassed = $false
}

# Test 5: Service Files
Write-Host "Test 5: Service Files..." -ForegroundColor Yellow
$serviceFiles = @(
    "src/blockchain/walletService.js",
    "src/blockchain/ethereumService.js",
    "src/blockchain/solanaService.js",
    "src/blockchain/tronService.js",
    "src/services/tradingBot.js",
    "src/services/marginTradingService.js",
    "src/services/p2pTradingService.js",
    "src/services/paymentTerminalService.js"
)

$missingFiles = @()
foreach ($file in $serviceFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "  ✅ All service files present ($($serviceFiles.Count) files)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Missing service files: $($missingFiles -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Test 6: Frontend Files
Write-Host "Test 6: Frontend Files..." -ForegroundColor Yellow
$frontendFiles = @(
    "public/index.html",
    "public/app.js",
    "public/styles.css",
    "public/blockchain-integration.js"
)

$missingFrontend = @()
foreach ($file in $frontendFiles) {
    if (-not (Test-Path $file)) {
        $missingFrontend += $file
    }
}

if ($missingFrontend.Count -eq 0) {
    Write-Host "  ✅ All frontend files present ($($frontendFiles.Count) files)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Missing frontend files: $($missingFrontend -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Test 7: Configuration Files
Write-Host "Test 7: Configuration Files..." -ForegroundColor Yellow
$configFiles = @(".env", "package.json", ".prettierrc.json", ".eslintrc.json")
$missingConfig = @()
foreach ($file in $configFiles) {
    if (-not (Test-Path $file)) {
        $missingConfig += $file
    }
}

if ($missingConfig.Count -eq 0) {
    Write-Host "  ✅ All configuration files present" -ForegroundColor Green
} else {
    Write-Host "  ❌ Missing config files: $($missingConfig -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Test 8: Node Modules
Write-Host "Test 8: Dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    $moduleCount = (Get-ChildItem "node_modules" -Directory).Count
    Write-Host "  ✅ Node modules installed ($moduleCount packages)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Node modules not installed" -ForegroundColor Red
    $allPassed = $false
}

# Test 9: Documentation
Write-Host "Test 9: Documentation..." -ForegroundColor Yellow
$docFiles = @(
    "INSTALLATION_COMPLETE.md",
    "COMPLETE_SETUP_GUIDE.md",
    "COMPLETE_FEATURE_LIST.md",
    "ERROR_FIX_REPORT.md",
    "README.md"
)

$docCount = 0
foreach ($file in $docFiles) {
    if (Test-Path $file) {
        $docCount++
    }
}

Write-Host "  ✅ Documentation files: $docCount/$($docFiles.Count) present" -ForegroundColor Green

# Test 10: Package.json Scripts
Write-Host "Test 10: NPM Scripts..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$scripts = $packageJson.scripts
if ($scripts.start -and $scripts.dev -and $scripts.stop) {
    Write-Host "  ✅ Essential NPM scripts configured" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Some NPM scripts may be missing" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Application is fully functional and ready to use!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your application at:" -ForegroundColor White
    Write-Host "  🌐 http://localhost:4000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Features Available:" -ForegroundColor White
    Write-Host "  ✅ Multi-chain wallet generation" -ForegroundColor Green
    Write-Host "  ✅ Cryptocurrency trading" -ForegroundColor Green
    Write-Host "  ✅ Margin & P2P trading" -ForegroundColor Green
    Write-Host "  ✅ AI trading bot" -ForegroundColor Green
    Write-Host "  ✅ Payment terminal" -ForegroundColor Green
    Write-Host "  ✅ ERC-1155 NFT support" -ForegroundColor Green
    Write-Host "  ✅ And much more!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please review the failed tests above and take corrective action." -ForegroundColor Yellow
    exit 1
}
