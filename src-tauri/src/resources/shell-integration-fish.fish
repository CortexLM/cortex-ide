# Cortex Desktop shell integration for fish
# Emits OSC 633 sequences for terminal-shell communication

# Prevent double-sourcing
if set -q __CORTEX_SHELL_INTEGRATION
    exit 0
end
set -g __CORTEX_SHELL_INTEGRATION 1

# Mark command start (OSC 633 ; C) and report the command (OSC 633 ; E)
function __cortex_preexec --on-event fish_preexec
    printf '\033]633;C\007'
    printf '\033]633;E;%s\007' "$argv"
end

# Mark command end with exit code (OSC 633 ; D ; <code>) and set cwd (OSC 633 ; P ; Cwd=...)
function __cortex_postexec --on-event fish_postexec
    set -l exit_code $status
    printf '\033]633;D;%s\007' "$exit_code"
    printf '\033]633;A\007'
    printf '\033]633;P;Cwd=%s\007' "$PWD"
end

# Initial cwd report
printf '\033]633;P;Cwd=%s\007' "$PWD"
