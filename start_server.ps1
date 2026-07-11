# Simple HTTP Server in PowerShell
$port = 8000
$root = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Server running at http://localhost:$port/"
Write-Host "Press Ctrl+C to stop."

Start-Process "http://localhost:$port/"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        $fullPath = Join-Path $root $path

        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html" }
                ".css"  { "text/css" }
                ".js"   { "application/javascript" }
                ".json" { "application/json" }
                default { "application/octet-stream" }
            }
            
            $content = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentType = "$mime; charset=utf-8"
            $response.ContentLength64 = $content.Length
            try {
                $response.OutputStream.Write($content, 0, $content.Length)
            } catch {
                # Ignore connection closed by client
            }
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} catch {
    # Ignore listener stop errors
} finally {
    $listener.Stop()
}
