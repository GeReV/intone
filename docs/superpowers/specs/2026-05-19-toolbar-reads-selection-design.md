# Design: Toolbar Button Reads Active Selection

**Date:** 2026-05-19

## Problem

Clicking the toolbar button always reads the full page via Readability/Defuddle. Users who have selected text expect the button to read just that selection, mirroring the existing context-menu "Read selection" behavior.

## Behavior

- **No active player + selection present** → read the selection (same path as `play-selection`)
- **No active player + no selection** → read the full page (existing behavior, unchanged)
- **Player already active** → toggle pause/resume (existing behavior, unchanged)

## Implementation

**One change in `src/extension/content/index.ts`, `play` message handler:**

```ts
case "play":
  if (!player) {
    const sel = window.getSelection()?.toString().trim();
    void start(sel || undefined);
  } else if (player.isPlaying) {
    player.pause();
  } else {
    void player.play();
  }
  break;
```

`start(textOverride?)` already handles both paths: a non-empty string reads the selection; `undefined` runs the page extractor. No new message types, no other file changes.

## Out of Scope

- Keyboard shortcut (`commands`) behavior — left unchanged (always reads full page)
- Restarting playback with a new selection when a player is already active
