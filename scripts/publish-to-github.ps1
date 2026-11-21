$ErrorActionPreference = 'Stop'

$RepositoryUrl = 'https://github.com/AriaKianzad/ariakianzad.github.io.git'
$ExpectedBranch = 'main'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Push-Location $ProjectRoot
try {
    Invoke-Git rev-parse --show-toplevel | Out-Null
    $Branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the current Git branch.' }
    if ($Branch -ne $ExpectedBranch) {
        throw "Expected branch '$ExpectedBranch' but found '$Branch'. No push was attempted."
    }

    $Origin = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -eq 0 -and $Origin.Trim() -ne $RepositoryUrl) {
        throw "The existing origin points to '$($Origin.Trim())', not the personal website repository. It was not changed."
    }
    if ($LASTEXITCODE -ne 0) {
        Invoke-Git remote add origin $RepositoryUrl
    }

    Write-Host 'Scanning the working tree for accidental credentials...'
    & npm run check:security
    if ($LASTEXITCODE -ne 0) {
        throw 'Credential scan failed. No files were staged or pushed.'
    }

    Write-Host 'Staging changes in the personal website repository only...'
    Invoke-Git add -A

    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        Invoke-Git commit -m 'Prepare personal website for GitHub Pages'
    } elseif ($LASTEXITCODE -ne 0) {
        throw "Could not inspect the Git index (exit code $LASTEXITCODE)."
    } else {
        Write-Host 'No new local changes to commit.'
    }

    Write-Host 'Pushing main to the new GitHub Pages repository...'
    Invoke-Git push --set-upstream origin main
    Write-Host ''
    Write-Host 'Push completed. GitHub Actions should now build and deploy the site.'
    Write-Host 'Expected URL: https://ariakianzad.github.io/'
} finally {
    Pop-Location
}
