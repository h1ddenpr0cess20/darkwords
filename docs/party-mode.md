# Party Mode

Party mode is an autonomous multi-character group chat. You define a cast and a
scenario, hit **Start party**, and the characters converse on their own. It's
selected as a prompt mode in **Settings → Personality → Party**.

The engine lives in `src/lib/party/` (types, prompts, turn-loop engine); its
state is held in `partySlice` and hosted by `src/store/partyHost.ts`.

## Defining a party

- **Cast** — each character has a name, a persona description, and per-character
  tool grants.
- **Scenario** — a topic, setting, mood, and conversation type.

Set these in the Party form (**Settings → Personality → Party**), then
**Start party**.

## Turn taking

- **Two characters** simply alternate.
- **Three or more** use a speaker-decision request to pick who speaks next.
- **You can interject at any time** by typing — it doesn't pause the loop. Name a
  character and they take the next turn.

Pause, stop, and resume from the control bar above the input (`PartyBar`).

## Persistence and resuming

A conversation's cast/scenario is saved as `partyConfig` on the `Conversation`.
On reload or when you switch back to a party conversation,
`loadPartyForConversation` re-derives party state so it reopens as a **stopped,
resumable** party rather than an inert transcript. Party status itself
(running/paused) is transient and rebuilt on load.

A `party` prompt mode is normalized back to `personality` when persisted, so a
party is always restored through `partyConfig`, never through a persona snapshot
— this avoids resurrecting a phantom party mode after the party is left.

## Limitations

- **No per-character temperature.** Opus 4.8 and Sonnet 5 reject the
  `temperature` parameter outright, so character voice comes from the persona
  prompt alone.
- While the party owns the conversation, per-message **regenerate** and
  **branch** are hidden — rewriting a single turn under the engine would desync
  the transcript. They return once the party is stopped and you're chatting solo.
