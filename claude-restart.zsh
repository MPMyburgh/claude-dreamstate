# claude wrapper for the restart mod: /restart-claude and /dreamstate write $CLAUDE_RESTART_FILE
# and exit, and this relaunches claude with the original flags plus what the file asks for.
# /dreamstate sets CLAUDE_DREAMSTATE=1 on each relaunch until /dreamstate off or claude quits;
# the mod then puts dreamstate.md in place of ~/.claude/CLAUDE.md in that process only.
# Source it from ~/.zshrc. Flags that pick a session (-c, -r, --session-id, --fork-session,
# --from-pr, --teleport) and a prompt given on the first command line are not passed again.
# The flag table follows `claude --help` for 2.1.308.

claude() {
  local f="${TMPDIR:-/tmp}/claude-restart.$$"
  local -a keep extra lead lines
  local -A one=(
    --agent 1 --agents 1 --append-system-prompt 1 --autocompact 1 --debug-file 1 --effort 1
    --environment 1 --fallback-model 1 --input-format 1 --json-schema 1 --max-budget-usd 1
    --model 1 -n 1 --name 1 --output-format 1 --permission-mode 1 --permission-prompts 1
    --plugin-dir 1 --plugin-url 1 --remote-control-session-name-prefix 1 --setting-sources 1
    --settings 1 --system-prompt 1 --system-prompt-snapshot 1 --session-id 1
  )
  local -A many=(
    --add-dir 1 --allowedTools 1 --allowed-tools 1 --betas 1 --disallowedTools 1
    --disallowed-tools 1 --file 1 --mcp-config 1 --tools 1
  )
  local -A optional=(
    --cloud 1 -d 1 --debug 1 --from-pr 1 --prompt-suggestions 1 --remote-control 1
    -r 1 --resume 1 --teleport 1 -w 1 --worktree 1
  )
  local -A drop=(-c 1 --continue 1 -r 1 --resume 1 --session-id 1 --fork-session 1 --from-pr 1 --teleport 1)
  local -i i=1
  local a dream=
  local -a group
  while (( i <= $# )); do
    a=${@[i]}
    group=("$a")
    if [[ $a == -*=* ]]; then
      :
    elif (( ${+one[$a]} )); then
      (( i < $# )) && { (( i++ )); group+=("${@[i]}"); }
    elif (( ${+many[$a]} )); then
      while (( i < $# )) && [[ ${@[i+1]} != -* ]]; do (( i++ )); group+=("${@[i]}"); done
    elif (( ${+optional[$a]} )); then
      (( i < $# )) && [[ ${@[i+1]} != -* ]] && { (( i++ )); group+=("${@[i]}"); }
    elif [[ $a != -* ]]; then
      group=()
    fi
    if (( ${#group} )) && ! (( ${+drop[${a%%=*}]} )); then keep+=("${group[@]}"); fi
    (( i++ ))
  done

  rm -f -- "$f"
  CLAUDE_RESTART_FILE="$f" command claude "$@"
  local rc=$?
  while [[ -s $f ]]; do
    lines=("${(@f)$(<"$f")}")
    rm -f -- "$f"
    lead=() extra=()
    case ${lines[1]} in
      resume) extra=(--resume "${lines[2]}" "${(@)lines[3,-1]}") ;;
      dream) dream=1; lead=("${(@)lines[2,-1]}") ;;
      off) dream= ;;
    esac
    print -r -- "restart: ${dream:+CLAUDE_DREAMSTATE=1 }claude ${lead[*]} ${keep[*]} ${extra[*]}"
    CLAUDE_RESTART_FILE="$f" CLAUDE_DREAMSTATE="$dream" command claude "${lead[@]}" "${keep[@]}" "${extra[@]}"
    rc=$?
  done
  return $rc
}
