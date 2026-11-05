# AURORA

**A minimal, cinematic music player for discovering and playing open-catalogue music.**

AURORA is designed to stay almost empty: a dark atmospheric space, a thin audio-reactive screen boundary, and a connected star constellation. The song chooser lives behind one small top-left control.

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
- Animated orbital centerpiece with album-art-derived ambient colours.
- Live audio-spectrum visualizer using the Web Audio analyser when the browser and stream permit audio analysis; Orbit and Wave layouts remain available, with CSS animation as a graceful fallback.
- Compact persistent transport with artwork, title, creator, seek, volume, previous/next and playback status while the discovery dock is closed.
- Lyric Constellation: an animated, track-labelled constellation visual that accompanies playback without displaying unlicensed lyric text.

### Stage 4 — Product polish and local release
- Further accessibility, settings, error handling, performance and browser compatibility work.
- Production build verification and optional static deployment assessment.

## Important catalogue and lyrics limitations

- Audius is an open music catalogue, not a universal catalogue of all commercial releases. Some requested songs will not be available.
- Audius read-only endpoints are documented for search, trending and streaming. Basic reads do not require an API key, but higher rate limits may require one.
- Lyrics are not bundled with the music stream. AURORA does not scrape lyric websites or reproduce copyrighted lyrics. A licensed lyrics integration is a separate requirement.
- Audio-spectrum animation reflects measured frequency energy when Web Audio access is available; it is a visualizer, not a calibrated beat detector.
- Lyric Constellation is a visual experience, not a lyric feed. Word-by-word synchronized lyrics still require a licensed provider and display/synchronization rights.

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

The minimal listening-view redesign and expanded Audius discovery are committed to `main`. CI runs `npm install` and `npm run build` for each commit. Actual browser playback, border response, and stream-specific Web Audio analysis still require a browser check.
