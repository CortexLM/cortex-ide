# Cortex Desktop shell integration for PowerShell - Silent injection
# Emits OSC 633 sequences for terminal-shell communication
# Uses $([char]27) for ESC to support both Windows PowerShell 5.x and PowerShell Core 6+
if ($env:__CORTEX_SHELL_INTEGRATION -ne "1") {
$env:__CORTEX_SHELL_INTEGRATION = "1"
$__cortexEsc = [char]27
$__cortexBel = [char]7
$__cortexOriginalPrompt = $function:prompt
function global:prompt {
$exitCode = $LASTEXITCODE; if ($null -eq $exitCode) { $exitCode = 0 }
[Console]::Write("$__cortexEsc]633;D;$exitCode$__cortexBel")
[Console]::Write("$__cortexEsc]633;A$__cortexBel")
[Console]::Write("$__cortexEsc]633;P;Cwd=$PWD$__cortexBel")
if ($__cortexOriginalPrompt) { & $__cortexOriginalPrompt } else { "PS $PWD> " }
[Console]::Write("$__cortexEsc]633;B$__cortexBel")
}
if (Get-Module -ListAvailable -Name PSReadLine) {
$__cortexOriginalPreCommandHandler = (Get-PSReadLineOption).AddToHistoryHandler
Set-PSReadLineOption -AddToHistoryHandler {
param($command)
[Console]::Write("$__cortexEsc]633;C$__cortexBel")
$escapedCommand = $command -replace '\\', '\\\\'
[Console]::Write("$__cortexEsc]633;E;$escapedCommand$__cortexBel")
if ($__cortexOriginalPreCommandHandler) { return & $__cortexOriginalPreCommandHandler $command }
return $true
}
}
[Console]::Write("$__cortexEsc]633;P;Cwd=$PWD$__cortexBel")
}
