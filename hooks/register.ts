import type { EngineInterface, PromptContextInput, PromptContextResult, Register } from 'claude-code'

const DESCRIPTION = 'Exit Claude Code and relaunch this session in this terminal'
const HINT = '[fresh | <claude args>]'
const RECENT_MS = 3 * 60_000
const EXIT_DELAY_MS = 300
const DREAM_DESCRIPTION = 'Relaunch as a new conversation under the dreamstate rules in place of your global CLAUDE.md'
const DREAM_HINT = '[off | <topic>]'

function noWrapper($: EngineInterface) {
  return `this session was not started through the claude wrapper, so nothing would relaunch it. Add \`source ${$.plugin.root}/claude-restart.zsh\` to ~/.zshrc and start claude from a new shell. Nothing exited.`
}

async function runExit($: EngineInterface) {
  try {
    await $.command.run({ command: 'exit' })
  } catch {
    $.ui.toast('restart: could not run /exit; type it yourself, the relaunch is armed', { timeoutMs: 10_000 })
  }
}

async function restart($: EngineInterface, args: string): Promise<{ text: string }> {
  const a = args.trim()
  if (a === 'help') {
    return { text: 'restart: /restart-claude exits and resumes this session with the same flags. /restart-claude fresh starts a new conversation. /restart-claude <args> adds <args> to the relaunch.' }
  }
  const file = await $.env.get('CLAUDE_RESTART_FILE')
  if (!file) {
    return { text: `restart: ${noWrapper($)}` }
  }
  const lines = a === 'fresh' ? ['fresh'] : ['resume', await $.session.id(), ...a.split(/\s+/).filter(Boolean)]
  await relaunch($, file, lines)
  return { text: a === 'fresh' ? 'restart: exiting, then a new conversation.' : 'restart: exiting, then resuming this session.' }
}

async function relaunch($: EngineInterface, file: string, lines: string[]) {
  await $.fs.write(file, `${lines.join('\n')}\n`)
  await $.store.set('last', { at: await $.clock.now(), mode: lines[0] })
  $.ui.toast('restart: exiting; this terminal relaunches Claude Code', { timeoutMs: 8000 })
  $.clock.after(EXIT_DELAY_MS, () => void runExit($))
}

async function dreamstate($: EngineInterface, args: string): Promise<{ text: string }> {
  const a = args.trim().replace(/\s+/g, ' ')
  const file = await $.env.get('CLAUDE_RESTART_FILE')
  if (!file) return { text: `dreamstate: ${noWrapper($)}` }
  if (a === 'off') {
    await relaunch($, file, ['off'])
    return { text: 'dreamstate: exiting, then a new conversation under your global CLAUDE.md.' }
  }
  await relaunch($, file, a ? ['dream', a] : ['dream'])
  return { text: 'dreamstate: exiting, then a new conversation under the dreamstate rules.' }
}

async function dreamContext($: EngineInterface, e: PromptContextInput, next: (e: PromptContextInput) => Promise<PromptContextResult>) {
  const r = await next(e)
  if ((await $.env.get('CLAUDE_DREAMSTATE')) !== '1') return r
  const files = r.instructionFiles ?? e.instructionFiles ?? []
  const user = files.find(f => f.kind === 'user' && f.path.endsWith('/.claude/CLAUDE.md'))
  const path = `${$.plugin.root}/dreamstate.md`
  const dream = { path, kind: 'user' as const, content: await $.fs.read(path) }
  return { ...r, instructionFiles: user ? files.map(f => (f === user ? dream : f)) : [dream, ...files] }
}

export const register: Register = on => {
  let ownsRestart = false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'restart-claude', description: DESCRIPTION, argumentHint: HINT })
    await $.command.register({ name: 'dreamstate', description: DREAM_DESCRIPTION, argumentHint: DREAM_HINT })
    try {
      await $.command.register({ name: 'restart', description: DESCRIPTION, argumentHint: HINT })
      ownsRestart = true
    } catch {}
    const last = (await $.store.get('last')) as { at?: number } | undefined
    if (last && typeof last.at === 'number') {
      if ((await $.clock.now()) - last.at < RECENT_MS) $.ui.toast('restart: back')
      await $.store.delete('last')
    }
    return r
  })

  on('command.run', { command: 'restart' }, ($, e, next) => (ownsRestart ? restart($, e.args) : next(e)))
  on('command.run', { command: 'restart-claude' }, ($, e) => restart($, e.args))
  on('command.run', { command: 'dreamstate' }, ($, e) => dreamstate($, e.args))
  on('prompt.context', dreamContext)
}
