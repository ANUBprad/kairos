# Read-only migration diagnostics.
# Run from server/:  .\scripts\repair-migration-history.ps1
#
# This script intentionally makes NO database changes. If `prisma migrate status`
# reports drift or P3009, review the output with a database owner and choose a
# deliberate recovery path. Do not use `prisma db push` to hide drift, and do
# not resolve migrations as applied unless the schema has been verified.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not $env:DATABASE_URL) {
    throw "DATABASE_URL is not set. Load server/.env before running diagnostics."
}

Write-Host "Migration files present in this checkout:"
Get-ChildItem -Path "prisma/migrations" -Directory |
    Where-Object { $_.Name -ne "migrations" } |
    Sort-Object Name |
    ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host ""
Write-Host "Prisma migration status (read-only):"
npx prisma migrate status

Write-Host ""
Write-Host "Manual review checklist:"
Write-Host "  1. Compare reported drift against prisma/schema.prisma."
Write-Host "  2. Check for the legacy orphan 'Test' table before considering cleanup."
Write-Host "  3. Never DELETE _prisma_migrations rows or mark migrations applied without a verified backup and owner approval."
Write-Host "  4. After a deliberate repair, run: npx prisma migrate deploy"
Write-Host ""
Write-Host "No database changes were made by this script."
