#!/usr/bin/env pwsh
# ATLASX3 - Complete Startup Script

Write-Host "🚀 ATLASX3 - Starting Application..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the atlasx3 directory" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created - please configure it with your API keys" -ForegroundColor Green
}

# Check if data directory exists
if (-not (Test-Path "data")) {
    Write-Host "📁 Creating data directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "✅ Data directory created" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Application Configuration:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Read PORT from .env
$port = "4000"
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | Where-Object { $_ -match "^PORT=" }
    if ($envContent) {
        $port = ($envContent -split "=")[1]
    }
}

Write-Host "📍 Port: $port" -ForegroundColor White
Write-Host "🌐 Local URL: http://localhost:$port" -ForegroundColor White
Write-Host "🔗 Production URL: https://atlasx.online" -ForegroundColor White
Write-Host ""

Write-Host "🎯 Available Features:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Multi-chain wallet (ETH, BSC, SOL, TRON)" -ForegroundColor Green
Write-Host "✅ Real-time price tracking" -ForegroundColor Green
Write-Host "✅ Trading & Exchange" -ForegroundColor Green
Write-Host "✅ Margin & P2P Trading" -ForegroundColor Green
Write-Host "✅ AI Trading Bot" -ForegroundColor Green
Write-Host "✅ Payment Terminal" -ForegroundColor Green
Write-Host "✅ ERC-1155 NFT Support" -ForegroundColor Green
Write-Host "✅ MetaTrader Integration" -ForegroundColor Green
Write-Host "✅ WebSocket Real-time Updates" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Starting server..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Start the application
npm start

# If we get here, the server stopped
Write-Host ""
Write-Host "⚠️  Server stopped" -ForegroundColor Yellow
