import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Disc3, Headphones, Music2, Play, Search, X, FileUp, ExternalLink } from "lucide-react";

const API = "https://api.audius.co/v1";
const APP_NAME = "AURORA";
const PAGE_SIZE = 30;
const ITUNES = "https://itunes.apple.com";
const LYRICS_API = "https://lrclib.net/api";
const STORAGE = "aurora.audius.last-track.v1";
const genres = ["All", "Electronic", "Hip-Hop/Rap", "Pop", "Rock", "Ambient", "Classical", "Jazz", "House", "Techno"];
const stars = Array.from({ length: 34 }, (_, i) => ({ id: i, x: 5 + (i * 37.17) % 90, y: 8 + (i * 61.73) % 82 }));
const links = Array.from({ length: 46 }, (_, i) => [i % stars.length, (i * 7 + 5) % stars.length]).filter(([a, b]) => a !== b);
const art = t => t?.artwork?.["1000x1000"] || t?.artwork?.["480x480"] || t?.artwork?.["150x150"] || t?.artworkUrl100?.replace("100x100bb", "600x600bb") || "";
const time = s => Math.floor((s || 0) / 60) + ":" + String(Math.floor((s || 0) % 60)).padStart(2, "0");
const artist = t => t?.artistName || t?.user?.name || "Independent artist";
const trackId = t => String(t?.id ?? "");

async function api(path) {
  const response = await fetch(API + path);
  if (!response.ok) throw new Error(response.status === 429 ? "The open music catalogue is busy. Please retry shortly." : "The music catalogue could not be reached.");
  const json = await response.json();
  return json.data || [];
}
function stream(track) {
  return API + "/tracks/" + encodeURIComponent(track.id) + "/stream?app_name=" + APP_NAME;
}
function cataloguePath(query, genre, offset) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), app_name: APP_NAME, sort_method: "popular" });
  if (query.trim()) params.set("query", query.trim());
  if (genre !== "All") params.set("genre", genre);
  return "/tracks/" + (query.trim() ? "search" : "trending") + "?" + params.toString();
}
function parseLrc(source) {
  const rows = [];
  for (const raw of source.split(/\r?\n/)) {
    const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = raw.replace(/\[[^\]]+\]/g, "").trim();
    if (!text || !matches.length) continue;
    for (const match of matches) {
      const fraction = Number("0." + (match[3] || "0"));
      rows.push({ at: Number(match[1]) * 60 + Number(match[2]) + fraction, text });
    }
  }
  return rows.sort((a, b) => a.at - b.at);
}

export default function App() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [results, setResults] = useState([]);
  const [track, setTrack] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE) || "null"); } catch { return null; } });
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem("aurora.recent") || "[]"); } catch { return []; } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [lyrics, setLyrics] = useState([]);\n  const [lyricsStatus, setLyricsStatus] = useState("idle");
  const [lyricFileName, setLyricFileName] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [palette, setPalette] = useState(["#a9c8ff", "#5976c8", "#111a38"]);
  const [sourceLabel, setSourceLabel] = useState("AUDIO REACTIVE");
  const audio = useRef(null);
  const fileInput = useRef(null);
  const mainRef = useRef(null);
  const analyserRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const envelopeRef = useRef(0);
  const lastLowRef = useRef(0);
  const load = useCallback(async ({ reset = true, q = query, g = genre } = {}) => {
    setLoading(true); setError("");
    const start = reset ? 0 : offset;
    try {
      const [audiusResult, appleResult] = await Promise.allSettled([
        api(cataloguePath(q, g, start)),
        reset && start === 0 ? appleSearch(q) : (q.trim() ? appleSearch(q) : Promise.resolve([]))
      ]);
      const audius = audiusResult.status === "fulfilled" ? audiusResult.value.map(t => ({ ...t, source: "Audius" })) : [];
      const apple = appleResult.status === "fulfilled" ? appleResult.value : [];
      const key = t => (String(t.title || "").toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + artist(t).toLowerCase().replace(/[^a-z0-9]/g, ""));
      const merged = [...apple, ...audius].filter((t, i, all) => all.findIndex(x => key(x) === key(t)) === i);
      setResults(old => reset ? merged : [...old, ...merged.filter(item => !old.some(existing => existing.id === item.id))]);
      setOffset(start + (audius.length || 0));
      setHasMore(audius.length === PAGE_SIZE);
      if (!merged.length && reset) setError("No playable matches found. Try the artist name or song title.");
      else if (!apple.length && !audius.length) setError("Music catalogues are temporarily unavailable. Please retry.");
    } catch (e) { setError(e.message || "Could not load tracks."); }
    finally { setLoading(false); }
  }, [query, genre, offset]);

  useEffect(() => { load({ reset: true, q: "", g: "All" }); }, []);
  useEffect(() => { track ? localStorage.setItem(STORAGE, JSON.stringify(track)) : localStorage.removeItem(STORAGE); }, [track]);
  useEffect(() => { localStorage.setItem("aurora.recent", JSON.stringify(recent.slice(0, 8))); }, [recent]);
  useEffect(() => {
    if (!track) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, 1, 1);
        const p = ctx.getImageData(0, 0, 1, 1).data;
        const tint = factor => [p[0], p[1], p[2]].map(v => Math.max(0, Math.min(255, Math.round(v * factor))));
        const hex = values => "#" + values.map(v => v.toString(16).padStart(2, "0")).join("");
        setPalette([hex(tint(1.35)), hex(tint(.78)), hex(tint(.18))]);
      } catch { setPalette(["#a9c8ff", "#5976c8", "#111a38"]); }
    };
    image.src = art(track);
    return () => { image.onload = null; };
  }, [track]);

  async function playSelected(item) {
    setTrack(item);
    setRecent(old => [item, ...old.filter(x => x.id !== item.id)].slice(0, 8));
    setLyrics([]); setLyricsStatus("loading"); setLyricFileName(""); setCurrentTime(0); setError(""); setOpen(false);
    fetchSyncedLyrics(item).then(rows => {
      setLyrics(rows);
      setLyricsStatus(rows.length ? "ready" : "missing");
    }).catch(() => setLyricsStatus("missing"));
    const element = audio.current;
    if (!element) return;
    try {
      element.src = stream(item); element.load();
      await element.play();
    } catch { setError(item.previewUrl ? "This preview could not start." : "This stream could not start. Try another result."); }
  }
  async function togglePlayback() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !sourceRef.current) {
          const context = new AudioContextClass();
          const analyser = context.createAnalyser();
          analyser.fftSize = 512; analyser.smoothingTimeConstant = .68;
          const source = context.createMediaElementSource(element);
          source.connect(analyser); analyser.connect(context.destination);
          contextRef.current = context; analyserRef.current = analyser; sourceRef.current = source;
        }
        if (contextRef.current?.state === "suspended") await contextRef.current.resume();
        await element.play();
      } catch { try { await element.play(); } catch { setError("Playback failed. Choose another track."); } }
    } else element.pause();
  }
  useEffect(() => {
    let frame;
    const tick = () => {
      const analyser = analyserRef.current;
      let pulse = 0;
      if (analyser && playing) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(bins);
        let low = 0;
        for (let i = 0; i < 10; i++) low += bins[i];
        low /= 10 * 255;
        const transient = Math.max(0, low - lastLowRef.current) * 3.8;
        lastLowRef.current = low;
        envelopeRef.current = Math.max(transient, envelopeRef.current * .86, low * .22);
        pulse = Math.min(1, envelopeRef.current);
      } else { envelopeRef.current *= .9; lastLowRef.current = 0; }
      mainRef.current?.style.setProperty("--beat", String(pulse));
      mainRef.current?.style.setProperty("--beat-glow", String(.12 + pulse * .88));
      if (audio.current && Math.floor(audio.current.currentTime * 8) !== Math.floor(currentTime * 8)) setCurrentTime(audio.current.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, currentTime]);

  const activeLyric = useMemo(() => {
    let found = -1;
    for (let i = 0; i < lyrics.length; i++) if (lyrics[i].at <= currentTime) found = i; else break;
    return found;
  }, [lyrics, currentTime]);
  const activeWords = useMemo(() => activeLyric >= 0 ? lyrics[activeLyric].text.split(/\s+/).filter(Boolean) : [], [lyrics, activeLyric]);

  function onLyricFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseLrc(String(reader.result || ""));
      if (!parsed.length) { setError("That file has no readable LRC timestamps. Choose a valid .lrc file."); return; }
      setLyrics(parsed); setLyricFileName(file.name); setError("");
    };
    reader.onerror = () => setError("Could not read that lyrics file.");
    reader.readAsText(file);
    event.target.value = "";
  }
  function runSearch(event) { event?.preventDefault(); setOffset(0); load({ reset: true, q: query, g: genre }); }
  function changeGenre(next) { setGenre(next); setOffset(0); load({ reset: true, q: query, g: next }); }
  function openLibrary() { setOpen(true); if (!results.length && !loading) load({ reset: true, q: "", g: "All" }); }

  return <main ref={mainRef} className={"universe aurora-universe " + (playing ? "is-playing" : "")} style={{ "--accent": palette[0], "--glow": palette[1], "--deep": palette[2] }}>
    <div className="noise" />
    <div className="star-field">{Array.from({ length: 155 }, (_, i) => <span key={i} className="star" style={{ left: ((i * 37.17) % 100) + "%", top: ((i * 61.73) % 100) + "%", animationDelay: ((i % 17) * -.4) + "s" }} />)}</div>
    <svg className="star-web" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g>{links.map(([a, b], i) => <line key={i} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} style={{ "--line-delay": (i % 9) * .17 + "s" }} />)}</g><g>{stars.map(s => <circle key={s.id} cx={s.x} cy={s.y} r={s.id % 5 === 0 ? .16 : .1} />)}</g></svg>

    <div className="lyric-constellation" aria-live="polite">
      {lyrics.length > 0 && activeLyric >= 0 ? <>
        <div className="lyric-kicker">{lyricFileName ? "LOCAL LYRIC CONSTELLATION" : "LYRIC CONSTELLATION"}</div>
        <svg className="word-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          {activeWords.slice(0, 18).map((word, i) => <line key={i} x1={8 + i * (84 / Math.max(1, activeWords.length))} y1={50 + Math.sin(i * 1.8) * 15} x2={8 + (i + 1) * (84 / Math.max(1, activeWords.length))} y2={50 + Math.sin((i + 1) * 1.8) * 15} />)}
        </svg>
        <div className="lyric-word-row">{activeWords.slice(0, 18).map((word, i) => <motion.span key={activeLyric + "-" + i} className="lyric-word" initial={{ opacity: 0, y: 24, scale: .7, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} transition={{ delay: i * .055, type: "spring", stiffness: 180, damping: 16 }}>{word}<i /></motion.span>)}</div>
        <div className="lyric-next">{lyrics[activeLyric + 1]?.text || ""}</div>
      </> : <div className="lyric-idle">{track ? (lyricsStatus === "loading" ? "SEARCHING FOR SYNCHRONIZED LYRICS" : lyricsStatus === "missing" ? "NO SYNCHRONIZED LYRICS FOUND FOR THIS TRACK" : "AURORA · SOUND BECOMES LIGHT") : "AURORA · SOUND BECOMES LIGHT"}</div>}
    </div>

    <motion.button className="library-trigger" layoutId="aurora-library" onClick={() => open ? setOpen(false) : openLibrary()} aria-label={open ? "Close song chooser" : "Open song chooser"} title="Song universe"><AudioLines size={19} /><span className="trigger-eq"><i /><i /><i /><i /></span></motion.button>
    <audio ref={audio} crossOrigin="anonymous" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />

    {track && <div className="track-presence"><span className="presence-dot" />{track.title}<b>{artist(track)}</b></div>}
    {track && <div className="lyric-tools">
      <input ref={fileInput} type="file" accept=".lrc,text/plain" onChange={onLyricFile} hidden />
      <button onClick={() => fileInput.current?.click()}><FileUp size={14} />{lyrics.length ? "CHANGE LYRICS" : "IMPORT .LRC"}</button>
      {lyricFileName && <span>{lyricFileName}</span>}
    </div>}
    {track && <button className="play-toggle" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>}

    <AnimatePresence>
      {open && <motion.div className="chooser-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}>
        <motion.section layoutId="aurora-library" className="music-dock aurora-dock" initial={{ opacity: 0, scale: .92, y: 24, filter: "blur(12px)" }} animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, scale: .08, x: -window.innerWidth * .42, y: -window.innerHeight * .38, filter: "blur(12px)" }} transition={{ type: "spring", stiffness: 175, damping: 22 }}>
          <div className="dock-heading"><div className="dock-title"><span className="dock-symbol"><Headphones size={18} /></span><div><strong>AURORA / SONG UNIVERSE</strong><small>SELECT A FREQUENCY TO ENTER</small></div></div><button className="close-button" onClick={() => setOpen(false)} aria-label="Close"><X size={17} /></button></div>
          <form className="search-form" onSubmit={runSearch}><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search artist, track or sound..." aria-label="Search music" /><button type="submit" disabled={loading}>{loading ? "..." : "SEARCH"}</button></form>
          <div className="genre-row">{genres.map(g => <button key={g} className={genre === g ? "active" : ""} onClick={() => changeGenre(g)}>{g}</button>)}</div>
          <div className="library-toolbar"><span>{query.trim() ? "SEARCH RESULTS" : genre === "All" ? "TRENDING FREQUENCIES" : genre.toUpperCase()}</span><span>APPLE MUSIC + AUDIUS CATALOGUES</span></div>
          {error && <p className="form-error">{error}</p>}
          <div className="track-results">{results.map(item => <button className={"track-result " + (track?.id === item.id ? "selected" : "")} key={item.id} onClick={() => playSelected(item)}>
            <span className="result-art">{art(item) ? <img src={art(item)} alt="" /> : <Disc3 size={21} />}<span className="result-play"><Play size={12} /></span></span>
            <span className="result-copy"><strong>{item.title}</strong><small>{artist(item)} · {item.source === "Audius" ? "FULL OPEN STREAM" : "30-SEC PREVIEW"}{item.genre ? " · " + item.genre : ""}</small></span><span className="result-duration">{time(item.duration)}</span>
          </button>)}</div>
          {hasMore && results.length > 0 && <button className="load-more" onClick={() => load({ reset: false })} disabled={loading}>{loading ? "SCANNING..." : "LOAD MORE TRACKS"}</button>}
          {recent.length > 0 && <div className="recent-strip"><span>RECENT</span>{recent.slice(0, 4).map(item => <button key={item.id} onClick={() => playSelected(item)}>{item.title}</button>)}</div>}
          <div className="dock-footer"><span>APPLE PREVIEWS + AUDIUS STREAMS</span><span>{playing ? "SIGNAL ACTIVE" : "AWAITING INPUT"}</span></div>
          <p className="catalogue-note">Apple results provide short previews where available; Audius provides full streams for its open catalogue. Full commercial playback depends on the rights holder and a licensed music service.</p>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  </main>;
}
