# AURORA

**An immersive, local-first music environment with a cinematic sci-fi interface.**

Aurora is designed around a dark atmospheric desktop experience: glowing boundaries, ambient stars, floating panels, smooth transitions, and an expandable music dock. Spotify integration will use Spotify's official supported embed experience and will respect account and platform limitations.

## Four-stage roadmap

### Stage 1 — Visual foundation (started)
- Full-screen dark sci-fi environment.
- Animated star field and ambient glow.
- Central floating dock with open/close transitions.
- Compact top-left mini dock.
- Responsive layout and reduced-motion fallback.
- Persistent dock component so later Spotify playback is not interrupted by hiding the panel.

### Stage 2 — Spotify Free integration
- Official Spotify Embed integration.
- Accept Spotify track, album, playlist, artist, and podcast links where supported.
- Keep the embed mounted while the dock is collapsed.
- Clear playback and availability messaging for Free accounts.
- No unauthorized audio extraction or imitation of Spotify's private interface.

### Stage 3 — Dynamic music environment
- Artwork-derived color palettes when artwork is available.
- Smooth ambient theme transitions.
- Track and embed metadata presentation where supported.
- Independent floating typography and visual effects.
- Lyrics only from appropriately licensed/permitted sources; no prohibited synchronization of Spotify recordings with lyrics or visual media.

### Stage 4 — Product polish and local release
- Settings, saved appearance preferences, and keyboard accessibility.
- Error states, browser compatibility checks, and performance tuning.
- Local production build and launch instructions.
- Documentation, test checklist, and optional GitHub Pages-compatible static frontend assessment (the local backend-dependent features remain local).

## Technology
- React + Vite
- CSS animations and Canvas-ready visual layer
- Node.js tooling for local development
- Spotify Embed for supported Spotify content

## Run locally
```bash
npm install
npm run dev
```

## Current status
Stage 1 foundation is being implemented. Spotify playback is not yet connected in this stage.
