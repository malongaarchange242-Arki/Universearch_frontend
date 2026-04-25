# Script de test pour la page d'orientation PROA & PORA
# Ce script démarre les services et teste la fonctionnalité complète

param(
    [switch]$SkipServices,
    [switch]$SkipBrowser,
    [string]$ProaPort = "8000",
    [string]$PoraPort = "8080"
)

Write-Host "=== Test de la page d'orientation PROA & PORA ===" -ForegroundColor Cyan
Write-Host ""

# Fonction pour vérifier si un port est ouvert
function Test-Port {
    param([string]$hostname, [int]$port)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($hostname, $port)
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

# Fonction pour attendre qu'un service soit disponible
function Wait-ForService {
    param([string]$serviceName, [string]$url, [int]$maxAttempts = 30)

    Write-Host "Attente du service $serviceName..." -NoNewline

    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host " ✓" -ForegroundColor Green
                return $true
            }
        } catch {
            # Service pas encore prêt
        }

        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
    }

    Write-Host " ✗" -ForegroundColor Red
    return $false
}

# 1. Vérifier les prérequis
Write-Host "1. Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier Node.js
try {
    $nodeVersion = & node --version 2>$null
    Write-Host "   Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   Node.js: NON TROUVÉ" -ForegroundColor Red
    Write-Host "   Veuillez installer Node.js depuis https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Vérifier Python (pour PORA)
try {
    $pythonVersion = & python --version 2>$null
    if (-not $pythonVersion) {
        $pythonVersion = & python3 --version 2>$null
    }
    Write-Host "   Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   Python: NON TROUVÉ" -ForegroundColor Red
    Write-Host "   Veuillez installer Python depuis https://python.org" -ForegroundColor Red
    exit 1
}

# 2. Démarrer les services
if (-not $SkipServices) {
    Write-Host ""
    Write-Host "2. Démarrage des services..." -ForegroundColor Yellow

    # PROA Service (Node.js)
    Write-Host "   Démarrage du service PROA..." -NoNewline
    $proaPath = Join-Path $PSScriptRoot "..\services\proa-service"
    if (Test-Path $proaPath) {
        Set-Location $proaPath
        $proaJob = Start-Job -ScriptBlock {
            param($port)
            try {
                & npm start 2>$null
            } catch {
                Write-Host "Erreur lors du démarrage de PROA: $_" -ForegroundColor Red
            }
        } -ArgumentList $ProaPort

        # Attendre que PROA soit prêt
        if (Wait-ForService "PROA" "http://localhost:$ProaPort/health") {
            Write-Host "   Service PROA démarré sur le port $ProaPort" -ForegroundColor Green
        } else {
            Write-Host "   Échec du démarrage du service PROA" -ForegroundColor Red
        }
    } else {
        Write-Host "   Chemin PROA non trouvé: $proaPath" -ForegroundColor Red
    }

    # PORA Service (Python)
    Write-Host "   Démarrage du service PORA..." -NoNewline
    $poraPath = Join-Path $PSScriptRoot "..\services\pora-service"
    if (Test-Path $poraPath) {
        Set-Location $poraPath
        $poraJob = Start-Job -ScriptBlock {
            param($port)
            try {
                & python main.py 2>$null
            } catch {
                try {
                    & python3 main.py 2>$null
                } catch {
                    Write-Host "Erreur lors du démarrage de PORA: $_" -ForegroundColor Red
                }
            }
        } -ArgumentList $PoraPort

        # Attendre que PORA soit prêt
        if (Wait-ForService "PORA" "http://localhost:$PoraPort/health") {
            Write-Host "   Service PORA démarré sur le port $PoraPort" -ForegroundColor Green
        } else {
            Write-Host "   Échec du démarrage du service PORA" -ForegroundColor Red
        }
    } else {
        Write-Host "   Chemin PORA non trouvé: $poraPath" -ForegroundColor Red
    }

    Set-Location $PSScriptRoot
}

# 3. Vérifier la connectivité des services
Write-Host ""
Write-Host "3. Vérification de la connectivité..." -ForegroundColor Yellow

$proaOk = Test-Port "localhost" $ProaPort
$poraOk = Test-Port "localhost" $PoraPort

if ($proaOk) {
    Write-Host "   PROA (port $ProaPort): CONNECTÉ" -ForegroundColor Green
} else {
    Write-Host "   PROA (port $ProaPort): DÉCONNECTÉ" -ForegroundColor Red
}

if ($poraOk) {
    Write-Host "   PORA (port $PoraPort): CONNECTÉ" -ForegroundColor Green
} else {
    Write-Host "   PORA (port $PoraPort): DÉCONNECTÉ" -ForegroundColor Red
}

# 4. Ouvrir la page dans le navigateur
if (-not $SkipBrowser) {
    Write-Host ""
    Write-Host "4. Ouverture de la page d'orientation..." -ForegroundColor Yellow

    $orientationPath = Join-Path $PSScriptRoot "orientation.html"
    if (Test-Path $orientationPath) {
        try {
            Start-Process $orientationPath
            Write-Host "   Page ouverte dans le navigateur par défaut" -ForegroundColor Green
        } catch {
            Write-Host "   Erreur lors de l'ouverture de la page: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "   Fichier orientation.html non trouvé: $orientationPath" -ForegroundColor Red
    }
}

# 5. Tests API
Write-Host ""
Write-Host "5. Tests des API..." -ForegroundColor Yellow

# Test PROA
Write-Host "   Test PROA API..." -NoNewline
try {
    $testData = @{
        responses = @(5,4,3,5,4,3,5,4,3,5,4,3)
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:$ProaPort/orientation" -Method POST -Body $testData -ContentType "application/json" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host " ✓" -ForegroundColor Green
        $proaResult = $response.Content | ConvertFrom-Json
        Write-Host "     Profil calculé: Logique=$($proaResult.profile.logic), Technique=$($proaResult.profile.technical), Créativité=$($proaResult.profile.creativity), Social=$($proaResult.profile.social)" -ForegroundColor Gray
    } else {
        Write-Host " ✗ (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ (Erreur: $($_.Exception.Message))" -ForegroundColor Red
}

# Test PORA
Write-Host "   Test PORA API..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$PoraPort/ranking?logic=8.5&technical=7.2&creativity=6.8&social=9.1" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host " ✓" -ForegroundColor Green
        $poraResult = $response.Content | ConvertFrom-Json
        Write-Host "     Recommandations reçues: $($poraResult.Count) universités" -ForegroundColor Gray
    } else {
        Write-Host " ✗ (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ (Erreur: $($_.Exception.Message))" -ForegroundColor Red
}

# 6. Résumé
Write-Host ""
Write-Host "6. Résumé du test" -ForegroundColor Yellow
Write-Host "   =" * 40 -ForegroundColor Cyan

$allGood = $proaOk -and $poraOk

if ($allGood) {
    Write-Host "   ✓ Tous les services sont opérationnels" -ForegroundColor Green
    Write-Host "   ✓ La page d'orientation peut être utilisée" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Instructions d'utilisation :" -ForegroundColor Cyan
    Write-Host "   1. Ouvrez orientation.html dans votre navigateur" -ForegroundColor White
    Write-Host "   2. Cliquez sur 'Commencer l'orientation'" -ForegroundColor White
    Write-Host "   3. Répondez aux 12 questions du quiz" -ForegroundColor White
    Write-Host "   4. Analysez votre profil avec PROA" -ForegroundColor White
    Write-Host "   5. Obtenez vos recommandations personnalisées avec PORA" -ForegroundColor White
} else {
    Write-Host "   ⚠ Certains services ne sont pas disponibles" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Vérifiez :" -ForegroundColor Yellow
    if (-not $proaOk) { Write-Host "   - Service PROA (port $ProaPort)" -ForegroundColor Red }
    if (-not $poraOk) { Write-Host "   - Service PORA (port $PoraPort)" -ForegroundColor Red }
}

Write-Host ""
Write-Host "   Pour arrêter les services, utilisez Ctrl+C" -ForegroundColor Gray

# Garder les jobs en cours d'exécution
if (-not $SkipServices) {
    try {
        Write-Host ""
        Write-Host "Appuyez sur Ctrl+C pour arrêter les services..." -ForegroundColor Gray
        Wait-Event -Timeout ([TimeSpan]::FromSeconds(1))
    } catch {
        # Interruption par l'utilisateur
    } finally {
        # Nettoyer les jobs
        if ($proaJob) { Stop-Job $proaJob -ErrorAction SilentlyContinue; Remove-Job $proaJob -ErrorAction SilentlyContinue }
        if ($poraJob) { Stop-Job $poraJob -ErrorAction SilentlyContinue; Remove-Job $poraJob -ErrorAction SilentlyContinue }
        Write-Host "Services arrêtés." -ForegroundColor Yellow
    }
}