$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$RuntimeRoot = Join-Path $AppRoot ".runtime"
$PythonHome = Join-Path $RuntimeRoot "python313"
$NodeHome = Join-Path $RuntimeRoot "node"
$VenvPython = Join-Path $AppRoot ".venv\Scripts\python.exe"
$LogPath = Join-Path $AppRoot "install.log"
$NodeVersion = "22.23.5"
$PythonVersion = "3.13.17"
$TempRoot = Join-Path $env:TEMP "GafiSpeak-Setup"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory = $AppRoot
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        $exitCode = $LASTEXITCODE
        if ($null -ne $exitCode -and $exitCode -ne 0) {
            throw "O processo '$FilePath' terminou com o código $exitCode."
        }
    }
    finally {
        Pop-Location
    }
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

try {
    New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    Start-Transcript -Path $LogPath -Append | Out-Null

    Write-Host "GafiSpeak - instalador completo" -ForegroundColor Magenta
    Write-Host "Pasta: $AppRoot"
    Write-Host "Este processo instala os componentes apenas para esta instalação."
    Write-Host "Não altera o PATH global nem requer permissões de administrador."

    if (-not [Environment]::Is64BitOperatingSystem) {
        throw "O GafiSpeak requer Windows de 64 bits."
    }

    $nodeExe = Join-Path $NodeHome "node.exe"
    $nodeArchiveName = "node-v$NodeVersion-win-x64.zip"
    $nodeBaseUrl = "https://nodejs.org/dist/v$NodeVersion"
    $nodeZip = Join-Path $TempRoot $nodeArchiveName
    $nodeSums = Join-Path $TempRoot "node-SHASUMS256.txt"

    if (-not (Test-Path -LiteralPath $nodeExe)) {
        Write-Step "A transferir Node.js $NodeVersion"
        Invoke-WebRequest -Uri "$nodeBaseUrl/$nodeArchiveName" -OutFile $nodeZip -UseBasicParsing
        Invoke-WebRequest -Uri "$nodeBaseUrl/SHASUMS256.txt" -OutFile $nodeSums -UseBasicParsing

        $sumLine = Get-Content -LiteralPath $nodeSums |
            Where-Object { $_ -match (" " + [regex]::Escape($nodeArchiveName) + "$") } |
            Select-Object -First 1
        if (-not $sumLine) {
            throw "Não foi possível obter o checksum oficial do Node.js."
        }

        $expectedNodeHash = ($sumLine -split "\s+")[0].ToLowerInvariant()
        $actualNodeHash = Get-Sha256 -Path $nodeZip
        if ($actualNodeHash -ne $expectedNodeHash) {
            throw "O checksum do arquivo Node.js não corresponde ao checksum oficial."
        }

        Write-Step "A preparar o Node.js"
        $nodeExtract = Join-Path $TempRoot "node-extract"
        if (Test-Path $nodeExtract) {
            Remove-Item -LiteralPath $nodeExtract -Recurse -Force
        }
        Expand-Archive -LiteralPath $nodeZip -DestinationPath $nodeExtract -Force

        $extractedNode = Join-Path $nodeExtract "node-v$NodeVersion-win-x64"
        if (-not (Test-Path (Join-Path $extractedNode "node.exe"))) {
            throw "O pacote Node.js não contém node.exe."
        }
        if (Test-Path $NodeHome) {
            Remove-Item -LiteralPath $NodeHome -Recurse -Force
        }
        Move-Item -LiteralPath $extractedNode -Destination $NodeHome
    }

    $nodeExe = Join-Path $NodeHome "node.exe"
    $nodeVersionOutput = (& $nodeExe --version).Trim()
    if ($nodeVersionOutput -ne "v$NodeVersion") {
        throw "A versão instalada do Node.js não é a esperada: $nodeVersionOutput"
    }

    $pythonExe = Join-Path $PythonHome "python.exe"
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        Write-Step "A transferir Python $PythonVersion"
        $pythonInstaller = Join-Path $TempRoot "python-$PythonVersion-amd64.exe"
        $pythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-amd64.exe"
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller -UseBasicParsing

        $expectedPythonHash = "5da012101ba2e17113a9a1cd901e9ce1441086f2b7ecb5de06ec94163899a190"
        $actualPythonHash = Get-Sha256 -Path $pythonInstaller
        if ($actualPythonHash -ne $expectedPythonHash) {
            throw "O checksum do instalador Python não corresponde ao checksum publicado pelo Python.org."
        }

        Write-Step "A instalar Python $PythonVersion na pasta do GafiSpeak"
        New-Item -ItemType Directory -Force -Path $PythonHome | Out-Null
        $pythonArguments = '/quiet InstallAllUsers=0 PrependPath=0 Include_pip=1 Include_test=0 Include_doc=0 Include_tcltk=0 Include_launcher=0 Shortcuts=0 TargetDir="' + $PythonHome + '"'
        $pythonProcess = Start-Process -FilePath $pythonInstaller -ArgumentList $pythonArguments -Wait -PassThru
        if ($pythonProcess.ExitCode -ne 0) {
            throw "O instalador Python terminou com o código $($pythonProcess.ExitCode)."
        }
    }

    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw "Não encontrei python.exe depois da instalação do Python."
    }

    Write-Step "A criar o ambiente Python do GafiSpeak"
    if (-not (Test-Path -LiteralPath $VenvPython)) {
        Invoke-Checked -FilePath $pythonExe -Arguments @("-m", "venv", (Join-Path $AppRoot ".venv"))
    }

    if (-not (Test-Path -LiteralPath $VenvPython)) {
        throw "Não foi possível criar o ambiente virtual Python."
    }

    Write-Step "A atualizar o instalador de pacotes Python"
    Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip")

    $gpuNames = @()
    try {
        $gpuNames = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop |
            ForEach-Object { $_.Name } |
            Where-Object { $_ -match "NVIDIA" })
    }
    catch {
        Write-Host "Não foi possível consultar a placa gráfica; será usada a versão CPU." -ForegroundColor Yellow
    }

    $torchInstalled = $false
    if ($gpuNames.Count -gt 0) {
        Write-Step "Foi detetada uma placa NVIDIA. A instalar PyTorch com CUDA 12.8"
        Write-Host ($gpuNames -join "; ")
        try {
            Invoke-Checked -FilePath $VenvPython -Arguments @(
                "-m", "pip", "install", "torch",
                "--index-url", "https://download.pytorch.org/whl/cu128"
            )
            $torchInstalled = $true
        }
        catch {
            Write-Host "A instalação CUDA falhou. Vou preparar a versão CPU para manter o GafiSpeak funcional." -ForegroundColor Yellow
            Write-Host $_.Exception.Message -ForegroundColor Yellow
            & $VenvPython -m pip uninstall -y torch
            if ($LASTEXITCODE -ne 0) {
                throw "Não foi possível limpar uma instalação PyTorch incompleta."
            }
        }
    }

    if (-not $torchInstalled) {
        Write-Step "A instalar PyTorch para CPU"
        Invoke-Checked -FilePath $VenvPython -Arguments @(
            "-m", "pip", "install", "torch",
            "--index-url", "https://download.pytorch.org/whl/cpu"
        )
    }

    Write-Step "A instalar Kokoro e as dependências de voz"
    Invoke-Checked -FilePath $VenvPython -Arguments @(
        "-m", "pip", "install", "-r", (Join-Path $AppRoot "requirements-tts.txt")
    )

    Write-Step "A instalar as dependências do bot Discord"
    $env:PATH = "$NodeHome;$env:PATH"
    $npmCmd = Join-Path $NodeHome "npm.cmd"
    Invoke-Checked -FilePath $npmCmd -Arguments @("install", "--no-audit", "--no-fund")

    Write-Step "A verificar a instalação PyTorch"
    Invoke-Checked -FilePath $VenvPython -Arguments @(
        "-c",
        "import torch; print('PyTorch:', torch.__version__); print('CUDA disponível:', torch.cuda.is_available()); print('Dispositivo:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
    )

    $envFile = Join-Path $AppRoot ".env"
    if (-not (Test-Path -LiteralPath $envFile)) {
        Copy-Item -LiteralPath (Join-Path $AppRoot ".env.example") -Destination $envFile
        Write-Host "Foi criado .env a partir de .env.example."
    }
    else {
        Write-Host "O .env existente foi preservado."
    }

    Write-Step "Instalação concluída"
    Write-Host "O GafiSpeak Manager está instalado." -ForegroundColor Green
    Write-Host "Antes de iniciar o bot, abre o atalho 'GafiSpeak - Configurar' e preenche DISCORD_TOKEN, CLIENT_ID e OWNER_ID."
    Write-Host "O primeiro pedido de voz descarrega automaticamente os ficheiros do modelo Kokoro."
    Write-Host "Registo da instalação: $LogPath"
    Stop-Transcript | Out-Null

    Start-Process -FilePath "notepad.exe" -ArgumentList ('"' + $envFile + '"')
    exit 0
}
catch {
    Write-Host ""
    Write-Host "A INSTALAÇÃO NÃO FOI CONCLUÍDA" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Consulta o registo: $LogPath" -ForegroundColor Yellow
    try { Stop-Transcript | Out-Null } catch {}
    if (Test-Path -LiteralPath $LogPath) {
        Start-Process -FilePath "notepad.exe" -ArgumentList ('"' + $LogPath + '"')
    }
    exit 1
}
