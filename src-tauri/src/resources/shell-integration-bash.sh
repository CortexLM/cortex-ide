# Cortex Desktop shell integration for bash
# Emits OSC 633 sequences for terminal-shell communication

# Prevent double-sourcing
[[ -n "$__CORTEX_SHELL_INTEGRATION" ]] && return
__CORTEX_SHELL_INTEGRATION=1

# Mark prompt start (OSC 633 ; A)
__cortex_prompt_start() {
    printf '\033]633;A\007'
}

# Mark prompt end (OSC 633 ; B)
__cortex_prompt_end() {
    printf '\033]633;B\007'
}

# Mark command start (OSC 633 ; C) and report the command (OSC 633 ; E)
__cortex_preexec() {
    printf '\033]633;C\007'
    printf '\033]633;E;%s\007' "${BASH_COMMAND//\\/\\\\}"
}

# Mark command end with exit code (OSC 633 ; D ; <code>) and set cwd (OSC 633 ; P ; Cwd=...)
__cortex_precmd() {
    local EXIT_CODE=$?
    printf '\033]633;D;%s\007' "$EXIT_CODE"
    __cortex_prompt_start
    printf '\033]633;P;Cwd=%s\007' "$PWD"
}

# Install the preexec trap - fires before each command
trap '__cortex_preexec' DEBUG

# Add our precmd to PROMPT_COMMAND
if [[ -z "$PROMPT_COMMAND" ]]; then
    PROMPT_COMMAND="__cortex_precmd"
elif [[ "$PROMPT_COMMAND" != *"__cortex_precmd"* ]]; then
    PROMPT_COMMAND="__cortex_precmd;$PROMPT_COMMAND"
fi

# Initial cwd report
printf '\033]633;P;Cwd=%s\007' "$PWD"
