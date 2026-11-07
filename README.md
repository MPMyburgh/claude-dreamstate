# claude-dreamstate

![/dreamstate: swap your Claude Code rulebook for a dream](assets/dreamstate-card.png)

A Claude Code mod that swaps your global `CLAUDE.md` for a different rulebook for one conversation: one built for thinking sideways instead of following orders.

## Why

A good global `CLAUDE.md` turns Claude into a careful engineer: stay in scope, write the minimum, don't speculate, report tersely. That is what you want most of the time.

It is the wrong rulebook when you are working outside your expertise, you are stuck, and the next step on a hard piece of technology isn't obvious. Then the same rules keep pulling the model back to the safe, small, incremental answer, and that answer is exactly what hasn't been working.

Typing "ignore your rules for now" doesn't help much, because the rules are still sitting in context and still pulling. `/dreamstate` starts a new conversation in which your global rules were never loaded, and a short ruleset for divergent thinking sits in their place.

## What the dream rules ask for

[`dreamstate.md`](dreamstate.md) is short; read it. In outline:

- **Anchors.** Think as a blend of Ada Lovelace, Richard Feynman, Leonardo da Vinci and Socrates, none of them in charge, drawing from any culture, era, species or discipline.
- **Methods, used where they fit.** First principles, beginner's mind, clean-room design, the Tenth Man, the pre-mortem, double-blind review, diverge before converging.
- **Three stages per task:**
  1. **Deepen, then stop.** What would a top professional do here that you didn't ask for? What raw material would they start from? Which methods and tools? What, other than you or Claude, would show the result is right? Then it rewrites your request and waits for you to confirm it.
  2. **Dream.** Distil 3 to 5 underlying needs, imagine 10 ideas that are each different in kind (at least three of them uncomfortable), then pick the 2 with the biggest impact plus a wild card.
  3. **Tenth Man review.** Assume the favourite is wrong and explain why, propose 3 fundamentally different approaches (one that seems unlikely to work), and compare them honestly, including where the original wins.

## How it works

- `claude-restart.zsh` wraps the `claude` command in zsh. The mod's slash commands write a note to a temp file and exit Claude; the wrapper then relaunches `claude` with your original flags.
- `/dreamstate <topic>` relaunches as a new conversation with `CLAUDE_DREAMSTATE=1` set and your topic as the first message.
- In that process, a `prompt.context` hook replaces the user-level `~/.claude/CLAUDE.md` in Claude's instruction files with `dreamstate.md`, or adds it if you have no global file. Nothing on disk moves, so other terminals keep your normal rules. Project `CLAUDE.md` files still load. The swap survives `/compact`, because the engine runs the hook again when it re-reads the instructions.
- Dream mode stays on across restarts until `/dreamstate off` or until you quit Claude.
- The same mod also provides `/restart-claude` (and `/restart`, where that name is free): it relaunches the current session in place. `/restart-claude fresh` starts a new conversation, and `/restart-claude <args>` adds flags to the relaunch.

## Install

You need Claude Code with mod support (plugin hooks and `prompt.context`) and zsh. This was built and tested on Claude Code 2.1.319 on macOS.

```zsh
git clone https://github.com/MPMyburgh/claude-dreamstate ~/.claude/mods/dreamstate
echo 'source ~/.claude/mods/dreamstate/claude-restart.zsh' >> ~/.zshrc
```

To load the mod in every session, add its absolute path to `CLAUDE_CODE_PLUGIN_DIRS` (colon-separated) in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/Users/you/.claude/mods/dreamstate" } }
```

For a single session, use `claude --plugin-dir ~/.claude/mods/dreamstate` instead; the wrapper keeps that flag across relaunches.

Then open a new terminal and start `claude`.

## Use

```
/dreamstate why does our pipeline stall at scale
/dreamstate                 # dream mode, no opening topic
/dreamstate off             # back to your normal rules, new conversation
```

To check which rulebook is active, ask: "What is the first heading of your global CLAUDE.md?" In dream mode the answer is `# Dreamstate`.

## Tune it

`dreamstate.md` is meant to be edited. Swap the anchors for your own: a jazz arranger, a mycologist, an octopus. Change the methods, drop the pause after Deepen, ask for 20 ideas instead of 10. Edits apply to the next `/dreamstate` conversation, with no rebuild. If you find a ruleset that works, share it.

## Things to know

- The dream rules carry no safety rules of their own; your `settings.json` permissions still apply as usual. If you normally run with permissions bypassed, so does the dream session.
- A headless `claude` started from inside a dream session inherits `CLAUDE_DREAMSTATE=1`, so it gets the dream rules too.
- If you later resume a dream conversation from a normal terminal, the dream rules stay in that conversation until it is compacted, because they are part of its first message.

## Tests

```zsh
cd ~/.claude/mods/dreamstate && claude plugin test .
```

## Credits

The Deepen stage adapts a "deeper, not bigger" prompt shared by an engineering manager at Anthropic. The Dream and Tenth Man stages grew out of my own prompting experiments with personalities and semantic anchors.

## License

MIT
