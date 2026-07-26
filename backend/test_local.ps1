$json = Get-Content -Raw "..\rilaxy-cd8c5-firebase-adminsdk-fbsvc-7ebf59683b.json"
$env:GOOGLE_APPLICATION_CREDENTIALS_JSON = $json
$env:PUSH_API_KEY = "rilaxy-push-key-2026"

# Start server
$log = Join-Path $PSScriptRoot "server.log"
$proc = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server.js" -RedirectStandardOutput $log -PassThru
Start-Sleep -Seconds 3

Write-Host "`n=== Health check ==="
try {
  $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
  Write-Host "Health: $($health | ConvertTo-Json)"
} catch {
  Write-Host "Health failed: $_"
  $proc.Kill()
  exit 1
}

Write-Host "`n=== Test send-push (sem categoryId) ==="
try {
  $body = @{
    token = "test-fcm-token"
    title = "Teste"
    body = "Notificação de teste"
    channelId = "messages"
    data = @{ type = "test" }
  } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "http://localhost:3000/send-push" -Method Post -Body $body -ContentType "application/json" -Headers @{Authorization = "Bearer rilaxy-push-key-2026"} -TimeoutSec 5
  Write-Host "Result: $($r | ConvertTo-Json)"
} catch {
  Write-Host "Send-push failed (expected if FCM token is fake): $_"
}

Write-Host "`n=== Test send-push (com categoryId) ==="
try {
  $body2 = @{
    token = "test-fcm-token"
    title = "Chamada"
    body = "🔊 Chamada de áudio"
    channelId = "calls"
    categoryId = "incomingCall"
    data = @{ type = "call_audio"; callerId = "abc123"; callerName = "João" }
  } | ConvertTo-Json
  $r2 = Invoke-RestMethod -Uri "http://localhost:3000/send-push" -Method Post -Body $body2 -ContentType "application/json" -Headers @{Authorization = "Bearer rilaxy-push-key-2026"} -TimeoutSec 5
  Write-Host "Result: $($r2 | ConvertTo-Json)"
} catch {
  Write-Host "Send-push with categoryId failed (expected if FCM token is fake): $_"
}

Write-Host "`n=== Test auth (sem API key) ==="
try {
  $r3 = Invoke-RestMethod -Uri "http://localhost:3000/send-push" -Method Post -Body '{"token":"x","title":"x","body":"x"}' -ContentType "application/json" -TimeoutSec 5
  Write-Host "UNEXPECTED: $($r3 | ConvertTo-Json)" -ForegroundColor Red
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  Write-Host "Auth block: HTTP $status (expected 401)"
}

Write-Host "`n=== Test validation ==="
try {
  $r4 = Invoke-RestMethod -Uri "http://localhost:3000/send-push" -Method Post -Body '{"token":"x"}' -ContentType "application/json" -Headers @{Authorization = "Bearer rilaxy-push-key-2026"} -TimeoutSec 5
  Write-Host "UNEXPECTED: $($r4 | ConvertTo-Json)" -ForegroundColor Red
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  Write-Host "Validation block: HTTP $status (expected 400)"
}

$proc.Kill()
Write-Host "`nServer stopped. Test complete!" -ForegroundColor Green
