# Cortex Desktop shell integration for zsh
# Emits OSC 633 sequences for terminal-shell communication

# Prevent double-sourcing
[[ -n "$__CORTEX_SHELL_INTEGRATION" ]] && return
__CORTEX_SHELL_INTEGRATION=1

# Load required modules
autoload -Uz add-zsh-hook

# Mark prompt start (OSC 633 ; A)
__cortex_prompt_start() {
    printf '\033]633;A\007'
}

# Mark prompt end (OSC 633 ; B)
__cortex_prompt_end() {
    printf '\033]633;B\007'
}

# Mark command start (OSC 633 ; C) and report the command (OSC 633 ; E)
# Called before each command execution
__cortex_preexec() {
    printf '\033]633;C\007'
    printf '\033]633;E;%s\007' "${1//\\/\\\\}"
}

# Mark command end with exit code (OSC 633 ; D ; <code>) and set cwd (OSC 633 ; P ; Cwd=...)
# Called before each prompt
__cortex_precmd() {
    local EXIT_CODE=$?
    printf '\033]633;D;%s\007' "$EXIT_CODE"
    __cortex_prompt_start
    printf '\033]633;P;Cwd=%s\007' "$PWD"
}

# Install hooks
add-zsh-hook preexec __cortex_preexec
add-zsh-hook precmd __cortex_precmd

# Initial cwd report
printf '\033]633;P;Cwd=%s\007' "$PWD"
