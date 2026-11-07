import { expect, mock, test } from 'claude-code/testing'

async function setup($: any, on: any, env: Record<string, string>) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, env)
  mock.store(on)
  const writes: [string, string][] = []
  const ran: string[] = []
  on('fs.write', (_: any, e: any) => { writes.push([e.path, e.text]); return { value: undefined } })
  on('session.id', () => ({ value: 'SID-1' }))
  on('ui.toast', () => ({ value: undefined }))
  on('command.register', (_: any, e: any) => {
    if (e.name === 'restart') throw new Error('a built-in name is refused')
    return { value: { command: e.name } }
  })
  on('command.run', (_: any, e: any) => { ran.push(e.command); return { text: '' } })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  return { clock, writes, ran }
}

test('/restart-claude writes the resume note for the wrapper, then exits', async ($, on) => {
  const { clock, writes, ran } = await setup($, on, { CLAUDE_RESTART_FILE: '/tmp/claude-restart.42' })
  const r: any = await $.command.run({ command: 'restart-claude', args: '' })
  expect(r.text).toContain('resuming this session')
  expect(writes).toEqual([['/tmp/claude-restart.42', 'resume\nSID-1\n']])
  expect(ran).toEqual([])
  await clock.advance(400)
  expect(ran).toEqual(['exit'])
})

test('/restart-claude fresh asks for a new conversation', async ($, on) => {
  const { writes } = await setup($, on, { CLAUDE_RESTART_FILE: '/tmp/f' })
  await $.command.run({ command: 'restart-claude', args: 'fresh' })
  expect(writes).toEqual([['/tmp/f', 'fresh\n']])
})

test('without the wrapper nothing is written and nothing exits', async ($, on) => {
  const { clock, writes, ran } = await setup($, on, {})
  const r: any = await $.command.run({ command: 'restart-claude', args: '' })
  expect(r.text).toContain('Nothing exited')
  await clock.advance(1000)
  expect(writes).toEqual([])
  expect(ran).toEqual([])
})

test('the built-in /restart is left alone', async ($, on) => {
  const { writes, ran } = await setup($, on, { CLAUDE_RESTART_FILE: '/tmp/f' })
  await $.command.run({ command: 'restart', args: '' })
  expect(writes).toEqual([])
  expect(ran).toEqual(['restart'])
})

test('/restart-claude is registered whether or not /restart is free', async ($, on) => {
  const names: string[] = []
  mock.env(on, {})
  mock.store(on)
  on('command.register', (_: any, e: any) => { names.push(e.name); return { value: { command: e.name } } })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(names).toEqual(['restart-claude', 'dreamstate', 'restart'])
})

test('/dreamstate <topic> asks for a dream relaunch with the topic on one line, then exits', async ($, on) => {
  const { clock, writes, ran } = await setup($, on, { CLAUDE_RESTART_FILE: '/tmp/f' })
  const r: any = await $.command.run({ command: 'dreamstate', args: ' where next\n for  routing ' })
  expect(r.text).toContain('dreamstate rules')
  expect(writes).toEqual([['/tmp/f', 'dream\nwhere next for routing\n']])
  await clock.advance(400)
  expect(ran).toEqual(['exit'])
})

test('/dreamstate with no topic and /dreamstate off', async ($, on) => {
  const { writes } = await setup($, on, { CLAUDE_RESTART_FILE: '/tmp/f' })
  await $.command.run({ command: 'dreamstate', args: '' })
  await $.command.run({ command: 'dreamstate', args: 'off' })
  expect(writes).toEqual([['/tmp/f', 'dream\n'], ['/tmp/f', 'off\n']])
})

const FILES = [
  { path: '/Users/u/.claude/CLAUDE.md', kind: 'user', content: 'global rules' },
  { path: '/repo/CLAUDE.md', kind: 'project', content: 'project rules' },
]

async function context($: any, on: any, env: Record<string, string>, files: any[] = FILES) {
  on('fs.read', (_: any, e: any) => ({ value: e.path.endsWith('/dreamstate.md') ? 'dream rules' : '' }))
  on('prompt.context', (_: any, e: any) => ({ blocks: e.blocks, instructionFiles: e.instructionFiles }))
  await setup($, on, env)
  return $.prompt.context({ blocks: [{ name: 'claudeMd', text: 'x' }], instructionFiles: files })
}

test('under CLAUDE_DREAMSTATE=1 the dream rules replace only the global CLAUDE.md', async ($, on) => {
  const r: any = await context($, on, { CLAUDE_DREAMSTATE: '1' })
  expect(r.instructionFiles.map((f: any) => [f.kind, f.content])).toEqual([['user', 'dream rules'], ['project', 'project rules']])
  expect(r.instructionFiles[0].path).toEqual(expect.stringContaining('/dreamstate.md'))
})

test('without CLAUDE_DREAMSTATE the instruction files are untouched', async ($, on) => {
  const r: any = await context($, on, { CLAUDE_DREAMSTATE: '' })
  expect(r.instructionFiles).toEqual(FILES)
})

test('with no global CLAUDE.md the dream rules are added ahead of the project files', async ($, on) => {
  const r: any = await context($, on, { CLAUDE_DREAMSTATE: '1' }, FILES.slice(1))
  expect(r.instructionFiles.map((f: any) => [f.kind, f.content])).toEqual([['user', 'dream rules'], ['project', 'project rules']])
})
