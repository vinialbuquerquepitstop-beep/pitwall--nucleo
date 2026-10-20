#Requires -Version 5.1
<#
External Calc Gate 1 - execucao SOMENTE local, sem Supabase Cloud.
Uso:
  .\ferramentas\external-calc-list-intake\v0\executar_gate1_local_sem_custo.ps1
  .\ferramentas\external-calc-list-intake\v0\executar_gate1_local_sem_custo.ps1 -CorpusDirectory "C:\MinhasListas"
#>
[CmdletBinding()]
param(
  [string]$CorpusDirectory,
  [string]$ReportPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$relative = 'ferramentas/external-calc-list-intake/v0'
$containerName = 'external-calc-gate1-local-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) $containerName
$started = $false
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

function Assert-NativeSuccess([string]$step) {
  if ($LASTEXITCODE -ne 0) { throw "$step falhou (exit code $LASTEXITCODE)" }
}
function Run-PostgresFile([string]$name) {
  & docker exec $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d gate1_local -f "/workspace/$relative/$name"
  Assert-NativeSuccess $name
}
try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker nao encontrado. Inicie o Docker Desktop neste computador.'
  }
  & docker info --format '{{.ServerVersion}}' | Out-Null
  Assert-NativeSuccess 'Docker Desktop'
  Write-Host 'Gate 1 local: SEM branch Supabase, SEM deploy, SEM portas expostas.' -ForegroundColor Cyan
  Write-Host 'Primeiro uso pode baixar imagens oficiais postgres:17 e node:22-alpine.'
  & docker run --detach --rm --network none --name $containerName -e POSTGRES_DB=gate1_local -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=senha_somente_para_teste_local -v ($repoRoot + ':/workspace:ro') -v ($tempDir + ':/scratch:ro') postgres:17 | Out-Null
  Assert-NativeSuccess 'PostgreSQL descartavel'
  $started = $true

  $ready=$false
  for($i=0; $i -lt 60; $i++){
    & docker exec $containerName pg_isready -U postgres -d gate1_local *> $null
    if($LASTEXITCODE -eq 0){$ready=$true;break}
    Start-Sleep -Seconds 1
  }
  if(-not $ready){throw 'PostgreSQL local nao ficou pronto'}

  Write-Host '1/4 Compilando SQL e criando tabelas sinteticas...'
  Run-PostgresFile 'prova_gate1_db_guard_pg_setup_v0.sql'
  Run-PostgresFile 'GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql'
  Write-Host '2/4 Bloqueios de seguranca e idempotencia...'
  Run-PostgresFile 'prova_gate1_db_guard_pg_assert_v0.sql'

  Write-Host '3/4 Conversores reais TXT/ZIP e Advisor contra PostgreSQL...'
  & docker run --rm --network none -v ($repoRoot + ':/workspace:ro') -v ($tempDir + ':/scratch') -w /workspace node:22-alpine sh -c "node $relative/prova_gate1_db_real_bridge_fixture_v0.js > /scratch/bridge.sql"
  Assert-NativeSuccess 'fixture de conversores reais'
  & docker exec $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d gate1_local -f /scratch/bridge.sql
  Assert-NativeSuccess 'persistencia C01 no banco local'

  Write-Host '4/4 Validando integridade estrutural do SQL...'
  & docker run --rm --network none -v ($repoRoot + ':/workspace:ro') -w /workspace node:22-alpine node "$relative/prova_gate1_db_auto_promotion_draft_v0.js"
  Assert-NativeSuccess 'prova estrutural'

  if($CorpusDirectory){
    $corpus=(Resolve-Path $CorpusDirectory -ErrorAction Stop).Path
    if(-not (Get-Item $corpus).PSIsContainer){throw 'CorpusDirectory deve ser pasta'}
    Write-Host 'Auditando listas locais: SEM publicacao e SEM promocao.'
    & docker run --rm --network none -v ($repoRoot + ':/workspace:ro') -v ($tempDir + ':/scratch') -v ($corpus + ':/corpus:ro') -w /workspace node:22-alpine node "$relative/auditar_corpus_local_v0.js" /corpus /scratch/corpus-report.json
    Assert-NativeSuccess 'auditoria offline do corpus'

    if(-not $ReportPath){
      $documents=[Environment]::GetFolderPath('MyDocuments')
      if(-not $documents){$documents=$HOME}
      $ReportPath=Join-Path (Join-Path $documents 'ExternalCalcGate1') 'corpus-local.json'
    }
    $target=[System.IO.Path]::GetFullPath($ReportPath)
    $parent=Split-Path $target -Parent
    if(-not (Test-Path $parent)){New-Item -ItemType Directory -Path $parent -Force | Out-Null}
    Copy-Item (Join-Path $tempDir 'corpus-report.json') $target -Force
    Write-Host "Relatorio privado, salvo apenas aqui: $target" -ForegroundColor Green
    Write-Host 'Este relatorio NAO substitui o gabarito golden conferido.'
  } else {
    Write-Host 'Corpus privado nao verificado (informe -CorpusDirectory depois).'
  }
  Write-Host 'EXTERNAL_CALC_GATE1_LOCAL_DB=PASS (somente ambiente local)' -ForegroundColor Green
} finally {
  if($started){& docker rm -f $containerName *> $null}
  if(Test-Path $tempDir){Remove-Item $tempDir -Recurse -Force}
}
