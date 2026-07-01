$new = (Get-ChildItem dist/assets/*.js | Select-Object -First 1).FullName
$content = Get-Content $new -Raw
$bundle = $content

# Find bare identifier references (i.e., not member access, not in string, not preceded by dot)
function Find-BareRefs([string]$name) {
    $pattern = [regex]::Escape($name)
    $matches = [regex]::Matches($bundle, "(?<![A-Za-z0-9_.$])" + $pattern + "(?![A-Za-z0-9_$])")
    $bare = @()
    foreach ($m in $matches) {
        $idx = $m.Index
        # Check not inside string or template literal (rough heuristic: count backticks/quotes before)
        $snippet = $bundle.Substring([Math]::Max(0, $idx-100), [Math]::Min(100, $idx))
        $backticks = ($snippet.ToCharArray() | Where-Object { $_ -eq [char]96 } | Measure-Object).Count
        $dblQuotes = ($snippet.ToCharArray() | Where-Object { $_ -eq [char]34 } | Measure-Object).Count
        $sglQuotes = ($snippet.ToCharArray() | Where-Object { $_ -eq [char]39 } | Measure-Object).Count
        # Skip if inside an unclosed string/template
        if ($backticks % 2 -eq 1) { continue }
        if ($dblQuotes % 2 -eq 1) { continue }
        if ($sglQuotes % 2 -eq 1) { continue }
        # Check if preceded by `.` (member access like `obj.NAME`)
        $prev = if ($idx -gt 0) { $bundle[$idx-1] } else { '' }
        if ($prev -eq '.') { continue }
        $bare += $idx
    }
    return $bare
}

# Comprehensive list of upper-case identifiers that should not be bare
$candidates = @(
    "CELL_SIZE", "WALL_HEIGHT", "WALL_THICKNESS", "CEILING_Y",
    "MAX_POINT_LIGHTS", "MIN_FIXTURE_DISTANCE", "SHOW_FIRST_PERSON_VIEW_MODEL",
    "ALMOND_WATER_PICKUP_RADIUS", "ALMOND_WATER_STAMINA_BONUS",
    "ALMOND_WATER_RESPAWN_MIN", "ALMOND_WATER_RESPAWN_VARIANCE",
    "ALMOND_WATER_INSPECT_DISTANCE", "ALMOND_WATER_MODEL_SCALE",
    "SUPER_ALMOND_WATER_RESPAWN_MIN", "SUPER_ALMOND_WATER_RESPAWN_VARIANCE",
    "SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE", "SUPER_ALMOND_WATER_RESPAWN_CHANCE",
    "SUPER_ALMOND_WATER_MODEL_SCALE",
    "FLASHLIGHT_PICKUP_RADIUS", "FLASHLIGHT_INSPECT_DISTANCE",
    "FLASHLIGHT_RESPAWN_MIN", "FLASHLIGHT_RESPAWN_VARIANCE",
    "DETECTOR_PICKUP_RADIUS", "DETECTOR_INSPECT_DISTANCE",
    "DETECTOR_RESPAWN_MIN", "DETECTOR_RESPAWN_VARIANCE",
    "BACTERIA_CONTACT_RADIUS", "BACTERIA_SPAWN_MIN_FROM_PLAYER", "BACTERIA_SPAWN_MAX_FROM_EXIT",
    "HOUND_CONTACT_RADIUS", "ENTITY_INSPECT_DISTANCE",
    "INTERACTION_RADIUS", "INTERACTION_INSPECT_DISTANCE",
    "LAYOUT_COLS", "LAYOUT_ROWS",
    "COLS", "ROWS", "MAP",
    "START_CELL", "EXIT_CELL", "EXIT_TRIGGER_RADIUS",
    "ORIGIN_X", "ORIGIN_Z",
    "LEVEL_ONE_COLS", "LEVEL_ONE_ROWS", "LEVEL_ONE_EXIT_TRIGGER_RADIUS",
    "LEVEL_ONE_START_CELL", "LEVEL_ONE_TARGET_CELL",
    "LEVEL_ONE_MAX_POINT_LIGHTS", "LEVEL_ONE_MIN_FIXTURE_DISTANCE",
    "LEVEL_ONE_DARK_ZONES", "LEVEL_ONE_SUPPLY_ZONES",
    "LEVEL_ONE_MAP", "LEVEL_ONE_ORIGIN_X", "LEVEL_ONE_ORIGIN_Z",
    "LEVEL_TWO_COLS", "LEVEL_TWO_ROWS", "LEVEL_TWO_EXIT_TRIGGER_RADIUS",
    "LEVEL_TWO_START_CELL", "LEVEL_TWO_TARGET_CELL",
    "LEVEL_TWO_MAX_POINT_LIGHTS", "LEVEL_TWO_MIN_FIXTURE_DISTANCE",
    "LEVEL_TWO_DARK_ZONES",
    "LEVEL_TWO_MAP", "LEVEL_TWO_ORIGIN_X", "LEVEL_TWO_ORIGIN_Z"
)

$totalBare = 0
foreach ($name in $candidates) {
    $bare = Find-BareRefs $name
    if ($bare.Count -gt 0) {
        Write-Host ("BARE " + $name + ": " + $bare.Count + " occurrence(s)")
        $totalBare += $bare.Count
        foreach ($i in ($bare | Select-Object -First 2)) {
            $ctx = $bundle.Substring([Math]::Max(0,$i-40), 90) -replace "`n",' '
            Write-Host ("  @" + $i + ": " + $ctx)
        }
    }
}
Write-Host ""
Write-Host ("TOTAL BARE REFS: " + $totalBare)