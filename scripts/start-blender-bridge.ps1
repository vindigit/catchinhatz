$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
if (-not (Test-Path -LiteralPath $blender)) {
    throw "Blender was not found at $blender"
}

# Keep this terminal open while Codex needs the Blender MCP connection.
& $blender --background --online-mode --command blender_mcp
