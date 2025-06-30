# PowerShell script to validate optimizations for video-call-translation system
# This checks if all optimizations have been correctly applied for the c2d-standard-8 VM

$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Video Call Translation - Optimization Validation" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Define project root directory
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ValidationResults = @()
$OptimizationSuccess = $true

# Function to check if a file exists
function Test-FileExists {
    param ($filePath, $description)
    
    if (Test-Path $filePath) {
        $ValidationResults += [PSCustomObject]@{
            Component = $description
            Status = "Present"
            Result = "OK"
        }
        return $true
    } else {
        $ValidationResults += [PSCustomObject]@{
            Component = $description
            Status = "Missing"
            Result = "FAILED"
        }
        $script:OptimizationSuccess = $false
        return $false
    }
}

# Function to check Docker configuration
function Test-DockerConfigExists {
    param ($filePath, $description)
    
    if (Test-Path $filePath) {
        $content = Get-Content -Path $filePath -Raw
        if ($content -match "resources" -and $content -match "limits") {
            $ValidationResults += [PSCustomObject]@{
                Component = $description
                Status = "Present with resource limits"
                Result = "OK"
            }
            return $true
        } else {
            $ValidationResults += [PSCustomObject]@{
                Component = $description
                Status = "Present but missing resource limits"
                Result = "WARNING"
            }
            return $false
        }
    } else {
        $ValidationResults += [PSCustomObject]@{
            Component = $description
            Status = "Missing"
            Result = "FAILED"
        }
        $script:OptimizationSuccess = $false
        return $false
    }
}

# Function to check model conversion status
function Test-ModelConverted {
    param ($sourcePath, $convertedPath, $modelType)
    
    $source = Test-Path $sourcePath
    $converted = Test-Path $convertedPath
    
    if ($source -and $converted) {
        $ValidationResults += [PSCustomObject]@{
            Component = "$modelType Model Conversion"
            Status = "Source and converted models present"
            Result = "OK"
        }
        return $true
    } elseif ($source -and (-not $converted)) {
        $ValidationResults += [PSCustomObject]@{
            Component = "$modelType Model Conversion"
            Status = "Source present but not converted"
            Result = "WARNING"
        }
        return $false
    } elseif ((-not $source) -and (-not $converted)) {
        $ValidationResults += [PSCustomObject]@{
            Component = "$modelType Model Conversion"
            Status = "Neither source nor converted models present"
            Result = "FAILED"
        }
        $script:OptimizationSuccess = $false
        return $false
    } else {
        $ValidationResults += [PSCustomObject]@{
            Component = "$modelType Model Conversion"
            Status = "Converted model present but source missing"
            Result = "OK (Pre-converted)"
        }
        return $true
    }
}

# Check for optimization script
Write-Host "Checking optimization scripts..." -ForegroundColor Yellow
Test-FileExists -filePath "$ProjectRoot\optimize_system.bat" -description "System Optimization Script (Windows)"
Test-FileExists -filePath "$ProjectRoot\scripts\optimize_for_c2d_vm.sh" -description "c2d-standard-8 VM Optimization Script"

# Check Docker configurations
Write-Host "Checking Docker configuration files..." -ForegroundColor Yellow
Test-DockerConfigExists -filePath "$ProjectRoot\docker-compose.optimized.yml" -description "Docker Compose Optimization File"

# Check model conversion scripts
Write-Host "Checking model conversion scripts..." -ForegroundColor Yellow
Test-FileExists -filePath "$ProjectRoot\convert_opus_to_ct2.py" -description "OPUS-MT to CT2 Conversion Script"
Test-FileExists -filePath "$ProjectRoot\convert_xtts_to_onnx.py" -description "XTTS to ONNX Conversion Script"

# Check model directories
Write-Host "Checking model directories..." -ForegroundColor Yellow
$modelsDir = "$ProjectRoot\server\models"
Test-FileExists -filePath "$modelsDir\opus_mt" -description "OPUS-MT Models Directory"
Test-FileExists -filePath "$modelsDir\phowhisper" -description "PhoWhisper Models Directory"
Test-FileExists -filePath "$modelsDir\tts" -description "TTS Models Directory"

# Check converted models
Write-Host "Checking model conversion status..." -ForegroundColor Yellow
Test-ModelConverted -sourcePath "$modelsDir\opus_mt\opus-mt-en-vi" -convertedPath "$modelsDir\opus_mt\opus-mt-en-vi-ct2" -modelType "OPUS-MT English-Vietnamese"
Test-ModelConverted -sourcePath "$modelsDir\opus_mt\opus-mt-vi-en" -convertedPath "$modelsDir\opus_mt\opus-mt-vi-en-ct2" -modelType "OPUS-MT Vietnamese-English"
Test-ModelConverted -sourcePath "$modelsDir\tts\XTTS-v2" -convertedPath "$modelsDir\tts\XTTS-v2\onnx" -modelType "XTTS-v2 ONNX"

# Check environment configuration
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path "$ProjectRoot\server\.env.optimized") {
    $envContent = Get-Content -Path "$ProjectRoot\server\.env.optimized" -Raw
    $checks = @(
        @{ Pattern = "USE_CUDA=true"; Description = "CUDA Enabled" },
        @{ Pattern = "COMPUTE_TYPE=float16"; Description = "ASR FP16 Optimization" },
        @{ Pattern = "BATCH_SIZE=16"; Description = "Translation Batch Size Optimized" },
        @{ Pattern = "USE_ONNX=true"; Description = "ONNX Runtime for TTS" },
        @{ Pattern = "LOW_MEMORY=true"; Description = "Low Memory Optimization" }
    )
    
    foreach ($check in $checks) {
        if ($envContent -match $check.Pattern) {
            $ValidationResults += [PSCustomObject]@{
                Component = "Environment Config: $($check.Description)"
                Status = "Configured"
                Result = "OK"
            }
        } else {
            $ValidationResults += [PSCustomObject]@{
                Component = "Environment Config: $($check.Description)"
                Status = "Not configured"
                Result = "WARNING"
            }
        }
    }
} else {
    $ValidationResults += [PSCustomObject]@{
        Component = "Optimized Environment Configuration"
        Status = "Missing"
        Result = "FAILED"
    }
    $OptimizationSuccess = $false
}

# Check start script
Write-Host "Checking start scripts..." -ForegroundColor Yellow
Test-FileExists -filePath "$ProjectRoot\start_optimized.bat" -description "Optimized Start Script"

# Display validation results
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Optimization Validation Results" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$ValidationResults | Format-Table -AutoSize

# Summary
Write-Host ""
if ($OptimizationSuccess) {
    Write-Host "All critical optimizations are in place!" -ForegroundColor Green
    Write-Host "The system is optimized for c2d-standard-8 VM (8 vCPUs, 32 GB Memory)." -ForegroundColor Green
} else {
    Write-Host "Some optimizations are missing or incomplete." -ForegroundColor Yellow
    Write-Host "Please run the optimization scripts to fully optimize the system." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Recommended actions:" -ForegroundColor Yellow
    Write-Host "1. Run optimize_system.bat to apply all optimizations" -ForegroundColor Yellow
    Write-Host "2. Check if models are properly converted" -ForegroundColor Yellow
    Write-Host "3. Ensure Docker is configured with resource limits" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "To start the optimized system:" -ForegroundColor Cyan
Write-Host "  .\start_optimized.bat" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
