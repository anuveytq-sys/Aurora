# AURORA

**A minimal, cinematic music player for discovering and playing open-catalogue music.**

AURORA is designed to feel almost empty until you summon its library: a dark atmospheric space, orbital motion, artwork-led ambient colours, and a compact player.

## Four-stage roadmap

### Stage 1 — Visual foundation
- Full-screen dark sci-fi environment, star field, ambient glow and orbital centerpiece.
- Compact floating dock, mini dock and keyboard shortcuts.

### Stage 2 — Search and playback (Audius)
- Search tracks and artists in the Audius open music catalogue.
- Trending discovery when the search field is empty.
- Plays selected catalogue tracks using the Audius stream endpoint and a native audio element.
- Play/pause, seek, volume, next/previous result and automatic next-track behavior.
- Remembers the last selected track and recent tracks in browser localStorage.
- No Spotify link, no Spotify account, and no API key for basic read-only discovery. Audius may apply rate limits; API access and stream availability can change.
- The Audius catalogue is not every commercial song ever released. Results depend on what creators have made available through Audius.

### Stage 3 — Dynamic music environment
- Ambient theme palette changes when the selected track changes.
- Track artwork, title and creator appear in the minimal player.
- Animated orbital centerpiece and animated visualizer modes that respond to playback state.
- Lyric Constellation visual mode entry point. It currently explains the licensing limitation; it does not display copyrighted lyric text. A full synchronized-lyrics feature requires a provider and rights that permit display and synchronization.

### Stage 4 — Product polish and local release
- Further accessibility, settings, error handling, performance and browser compatibility work.
- Production build verification and optional static deployment assessment.

## Important catalogue and lyrics limitations

- Audius is an open music catalogue, not a universal catalogue of all commercial releases. Some requested songs will not be available.
- Audius read-only endpoints are documented for search, trending and streaming. Basic reads do not require an API key, but higher rate limits may require one.
- Lyrics are not bundled with the music stream. AURORA does not scrape lyric websites or reproduce copyrighted lyrics. A licensed lyrics integration is a separate requirement.
- The current visualizer animates with playback state; it is not yet a calibrated beat detector or a word-by-word lyric synchronizer.

## Technology
- React + Vite
- Framer Motion and CSS animation
- Audius REST API for catalogue search and streams
- Native HTML audio playback
- Browser localStorage for last track and recent history

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Search for a song or artist, select a result, and use the compact player. Collapse the library to return to the cinematic screen. Press Space to play/pause, Ctrl/Cmd + K to toggle the library, or Esc to close it.

## Verification status

Stage 2 and Stage 3 source changes are on the `stage-2-audius-stage-3-visuals` branch. They have not yet been installed, built, or browser-tested in this environment. Verify with `npm install` and `npm run build`, then test actual track playback in a browser.
