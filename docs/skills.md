# Skills

Skills are `SKILL.md` instruction packages the model loads **on demand**. Only
each skill's name and description sit in the system prompt; Claude pulls the full
body in with the `load_skill` tool when a task matches — so a shelf of skills
doesn't flood every request.

## Importing a skill

Open **Settings → Skills** and import a `SKILL.md` file. Each skill has a name, a
description, the full content, and an enabled flag (`Skill` in
`src/types/index.ts`). Skills live in `librarySlice` and persist to IndexedDB.

## How loading works

- The **name + description** of every enabled skill is added to the system
  prompt, so the model knows what's available.
- When a task matches, the model calls **`load_skill`** (`src/lib/tools/skills.ts`)
  and the full skill body is returned into the tool loop.
- This keeps the base prompt small while still giving the model access to
  detailed, task-specific instructions when it needs them.

## SKILL.md shape

A `SKILL.md` is a Markdown document whose front-matter/name and description
identify it, with the body carrying the actual instructions. Import surfaces the
name and description for the prompt and keeps the body for `load_skill`.

## Managing skills

In **Settings → Skills** you can enable/disable individual skills (a disabled
skill isn't advertised or loadable) and remove them. Disabling rather than
deleting is handy when you want to keep a skill around without spending prompt
space on its description.
