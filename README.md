# AURORA

**An immersive, local-first music environment with a minimal sci-fi interface.**

Aurora is designed to feel almost empty until you summon its music portal: a dark atmospheric space, slow orbital motion, subtle stars, warm ambient light, and one compact floating player surface.

## Four-stage roadmap

### Stage 1 — Visual foundation (implemented)
- Full-screen dark sci-fi environment, animated star field, ambient glow and orbital centerpiece.
- Compact floating dock, animated mini dock and keyboard controls.
- Responsive layout and reduced-motion fallback.

### Stage 2 — Spotify Free integration (implemented in source; local verification pending)
- Uses Spotify's official Embed Player; no unofficial audio extraction, private endpoints, or API key.
- Accepts Spotify share links and Spotify URIs for tracks, albums, playlists, artists, shows and episodes.
- Validates supported Spotify content before loading it.
- Remembers the selected Spotify content locally in the browser.
- Keeps the official player iframe mounted when the visual dock is collapsed, so the app does not intentionally unload it when you hide the panel.
- Includes paste-from-clipboard support, replace/disconnect actions and an "Open in Spotify" link.
- Minimal full-screen experience: orbital center, small status indicators and a single expandable portal.

### Stage 3 — Dynamic music environment
- Artwork-derived color palettes when artwork is available.
- Smooth ambient theme transitions and restrained audio-reactive-inspired motion.
- Metadata presentation where supported.
- Lyrics only from appropriately licensed/permitted sources. Spotify recordings must not be synchronised with lyrics or visual media in ways prohibited by Spotify's terms.

### Stage 4 — Product polish and local release
- Settings, saved appearance preferences and accessibility refinements.
- Browser compatibility checks, error states, performance tuning and production build verification.
- Optional GitHub Pages-compatible static frontend assessment.

## Spotify Free compatibility and limitations

- Spotify's official embed is used for playback. Spotify controls and availability are supplied by Spotify and can vary by content, region, browser, account and embed context.
- Spotify may require the listener to sign in or open content in Spotify; some tracks may only offer previews or may not be playable in the embedded context.
- Playback is not guaranteed for every item. Autoplay is not forced; use the controls inside Spotify's player.
- The iframe remains mounted while the AURORA dock is collapsed, but browser/Spotify policies can still affect background playback.
- AURORA does not scrape Spotify audio, bypass restrictions, or recreate Spotify's private interface.

## Technology
- React + Vite
- Framer Motion and CSS animation
- Spotify official Embed Player
- Browser localStorage for the last selected Spotify item

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Paste a Spotify share link (or Spotify URI) into the portal. Use the Spotify player controls to start playback, then collapse the portal. Press Ctrl/Cmd + K to toggle the portal or Esc to collapse it.

## Current status

Stage 1 and Stage 2 source changes are committed to the `phase-2-spotify-integration` branch. The code has not yet been installed, built or browser-tested in this environment. Run `npm install` and `npm run build` before treating this stage as verified.
