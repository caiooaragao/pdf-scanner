# Cria o repositorio no GitHub e faz push (precisa estar logado: gh auth login)
param(
  [string]$RepoName = "pdf-scanner",
  [string]$Description = "PDF scanner — efeito de digitalizacao (navegador + Node)"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  $ghDir = "C:\Program Files\GitHub CLI"
  if (Test-Path "$ghDir\gh.exe") {
    $env:Path = "$ghDir;$env:Path"
  }
}

gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Voce ainda nao esta logado no GitHub CLI."
  Write-Host "No terminal, rode:  gh auth login"
  Write-Host "Depois execute de novo:  .\push-github.ps1"
  Write-Host ""
  exit 1
}

Write-Host "Criando repositorio $RepoName e fazendo push..."
gh repo create $RepoName --public --description $Description --source . --remote origin --push

Write-Host ""
Write-Host "Pronto. Ative GitHub Pages em: Settings > Pages > Branch main, pasta / (root)"
