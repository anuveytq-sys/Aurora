import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Disc3, Headphones, Music2, Play, Search, X, FileUp, ExternalLink, Youtube } from "lucide-react";

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
  return track.previewUrl || (API + "/tracks/" + encodeURIComponent(track.id) + "/stream?app_name=" + APP_NAME);
}
function normalizeApple(t) {
  return {
    id: "apple-" + t.trackId, title: t.trackName, artistName: t.artistName,
    albumName: t.collectionName, artworkUrl100: t.artworkUrl100,
    duration: Math.round((t.trackTimeMillis || 0) / 1000),
    previewUrl: t.previewUrl, trackViewUrl: t.trackViewUrl,
    genre: t.primaryGenreName || "Pop", source: "Apple Music preview"
  };
}
async function appleSearch(term) {
  const url = term
    ? ITUNES + "/search?entity=song&limit=30&country=IN&term=" + encodeURIComponent(term)
    : ITUNES + "/rss/topsongs/limit=50/json";
  const response = await fetch(url);
  if (!response.ok) throw new Error("Apple music catalogue unavailable");
  const data = await response.json();
  const rows = term ? (data.results || []) : (data.feed?.entry || []).map(entry => ({
    trackId: entry.id?.attributes?.["im:id"],
    trackName: entry["im:name"]?.label,
    artistName: entry["im:artist"]?.label,
    collectionName: entry["im:collection"]?.label,
    artworkUrl100: entry["im:image"]?.at(-1)?.label,
    previewUrl: entry.link?.find(link => link.attributes?.type === "audio/x-m4a")?.attributes?.href,
    trackViewUrl: entry.id?.label,
    primaryGenreName: entry.category?.attributes?.label
  }));
  return rows.filter(t => t.trackName && t.artistName && t.previewUrl).map(normalizeApple);
}
const lyricCache = new Map();
const cleanMatch = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const artistMatchScore = (a, b) => {
  const primary = value => cleanMatch(String(value || "").split(/\b(?:feat(?:uring)?|ft\.?|with)\b|[,;|]/i)[0]);
  const left = primary(a), right = primary(b);
  if (!left || !right) return 0;
  if (left === right || left.startsWith(right) || right.startsWith(left)) return 1;
  const tokensA = new Set(left.match(/[a-z0-9]{2,}/g) || []);
  const tokensB = new Set(right.match(/[a-z0-9]{2,}/g) || []);
  const overlap = [...tokensA].filter(token => tokensB.has(token)).length;
  return overlap / Math.max(1, Math.min(tokensA.size, tokensB.size));
};
async function lyricRequest(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "Lrclib-Client": "AURORA/1.1 (https://github.com/anuveytq-sys/Aurora)" }
    });
    if (!response.ok) return null;
    return await response.json();
  } finally { clearTimeout(timer); }
}
function yamlScalar(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try { return JSON.parse(raw); } catch {}
  }
  return raw;
}
function parseLyricsFile(source) {
  const sourceLines = String(source || "").split(/\r?\n/);
  const rows = [];
  let line = null, word = null, inWords = false;
  for (const raw of sourceLines) {
    let match;
    if ((match = raw.match(/^  - text:\s*(.*)$/))) {
      if (line && Number.isFinite(line.at)) rows.push(line);
      line = { text: yamlScalar(match[1]), at: null, end: null, words: [] };
      word = null; inWords = false; continue;
    }
    if (!line) continue;
    if (/^    words:\s*$/.test(raw)) { inWords = true; word = null; continue; }
    if (inWords && (match = raw.match(/^      - text:\s*(.*)$/))) {
      word = { text: yamlScalar(match[1]), at: null, end: null };
      line.words.push(word); continue;
    }
    if (inWords && (match = raw.match(/^        start_ms:\s*(-?\d+)/))) { if (word) word.at = Number(match[1]) / 1000; continue; }
    if (inWords && (match = raw.match(/^        end_ms:\s*(-?\d+)/))) { if (word) word.end = Number(match[1]) / 1000; continue; }
    if ((match = raw.match(/^    start_ms:\s*(-?\d+)/))) { line.at = Number(match[1]) / 1000; inWords = false; continue; }
    if ((match = raw.match(/^    end_ms:\s*(-?\d+)/))) { line.end = Number(match[1]) / 1000; inWords = false; continue; }
    if (/^    [a-z_]+:/.test(raw) && !/^    words:/.test(raw)) inWords = false;
  }
  if (line && Number.isFinite(line.at)) rows.push(line);
  return rows.filter(row => row.text && Number.isFinite(row.at))
    .map(row => ({ ...row, words: row.words.filter(w => w.text && Number.isFinite(w.at)).sort((x,y) => x.at-y.at) }))
    .sort((x,y) => x.at-y.at);
}
function normalizeLiriQoCandidate(candidate, response) {
  if (!candidate || typeof candidate !== "object") return null;
  const meta = response?.metadata || {};
  const title = candidate.title || candidate.trackName || meta.title || "";
  const artistName = candidate.artist || candidate.artistName || meta.artist || "";
  if (title && cleanMatch(title) !== cleanMatch(meta.title || title)) return null;
  if (artistName && meta.artist && artistMatchScore(artistName, meta.artist) < .55) return null;

  const timed = Array.isArray(candidate.timed) ? candidate.timed : [];
  const wordMap = candidate.words && typeof candidate.words === "object" ? candidate.words : {};
  const rows = timed.map((line, index) => {
    const rawWords = Array.isArray(line.words) ? line.words : (Array.isArray(wordMap[line.id]) ? wordMap[line.id] : []);
    const words = rawWords.map(word => ({
      text: String(word.text || "").trim(),
      at: Number(word.start) / 1000,
      end: Number(word.end) / 1000
    })).filter(word => word.text && Number.isFinite(word.at))
      .sort((a, b) => a.at - b.at);
    return {
      at: Number(line.start) / 1000,
      end: Number(line.end) / 1000,
      text: String(line.text || words.map(word => word.text).join("")).trim(),
      words
    };
  }).filter(line => Number.isFinite(line.at) && line.text)
    .sort((a, b) => a.at - b.at);

  const hasNativeWordTiming = rows.some(line => line.words.length > 0) &&
    (candidate.nativeWordTiming === true || candidate.nativeRichsync === true ||
      candidate.syncLevel === "word" || candidate.syncLevel === "syllable");
  if (!hasNativeWordTiming) return null;
  return {
    rows,
    wordSynced: true,
    estimated: false,
    source: candidate.upstreamProvider || candidate.provider || "LiriQo"
  };
}

async function fetchLiriQoWordLyrics(item) {
  const params = new URLSearchParams({
    title: item.title || "",
    artist: artist(item),
    ...(item.albumName ? { album: item.albumName } : {}),
    ...(item.duration > 0 && item.duration < 3600 ? { duration: String(Math.round(item.duration)) } : {})
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch("https://api.liriqo-alfarrizi.my.id/v1/lyrics?" + params.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload?.error || !payload?.primary && !Array.isArray(payload?.tracks)) return null;

    const candidates = [];
    if (payload.primary) candidates.push(payload.primary);
    if (Array.isArray(payload.tracks)) candidates.push(...payload.tracks);
    const unique = [...new Set(candidates)];
    const ranked = unique.sort((a, b) => {
      const score = value => value?.syncLevel === "syllable" ? 3 :
        value?.syncLevel === "word" || value?.nativeWordTiming === true || value?.nativeRichsync === true ? 2 : 0;
      return score(b) - score(a);
    });
    for (const candidate of ranked) {
      const result = normalizeLiriQoCandidate(candidate, payload);
      if (result?.rows?.length) return result;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


async function fetchLyricaWordLyrics(item) {
  const params = new URLSearchParams({
    artist: artist(item),
    song: item.title || "",
    timestamps: "true",
    word: "true",
    fast: "true"
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch("https://wilooper-lyrica.hf.space/lyrics/?" + params.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const data = payload?.data;
    if (payload?.status !== "success" || !data || data.sync_level !== "word") return null;
    if (data.title && cleanMatch(data.title) !== cleanMatch(item.title)) return null;
    if (data.artist && artistMatchScore(data.artist, artist(item)) < .55) return null;
    const rows = (Array.isArray(data.timed_lyrics) ? data.timed_lyrics : []).map(line => {
      const words = (Array.isArray(line.words) ? line.words : []).map(word => ({
        text: String(word.text || "").trim(),
        at: Number(word.start) / 1000,
        end: Number(word.end) / 1000
      })).filter(word => word.text && Number.isFinite(word.at)).sort((a,b) => a.at-b.at);
      return {
        at: Number(line.start_time) / 1000,
        end: Number(line.end_time) / 1000,
        text: String(line.text || words.map(word => word.text).join("")).trim(),
        words
      };
    }).filter(line => Number.isFinite(line.at) && line.text && line.words.length)
      .sort((a,b) => a.at-b.at);
    if (!rows.length) return null;
    return { rows, wordSynced: true, estimated: false, source: data.source || "Lyrica" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function lyricRecordResult(record, item) {
  if (!record || cleanMatch(record.trackName || record.name) !== cleanMatch(item.title) ||
      artistMatchScore(record.artistName, artist(item)) < .55) return null;
  const wordRows = record.hasWordSync ? parseLyricsFile(record.lyricsfile) : [];
  const rows = wordRows.length ? wordRows : parseLrc(record.syncedLyrics);
  if (!rows.length) return null;
  return {
    rows,
    wordSynced: wordRows.some(row => row.words.length),
    estimated: false,
    source: "LRCLIB"
  };
}

async function fetchLRCLIBSearch(item) {
  const params = new URLSearchParams({
    track_name: item.title || "",
    artist_name: artist(item)
  });
  const matches = await lyricRequest(LYRICS_API + "/search?" + params.toString(), 3500);
  if (!Array.isArray(matches)) return null;
  const candidates = matches
    .map(record => ({ record, result: lyricRecordResult(record, item) }))
    .filter(entry => entry.result)
    .sort((a, b) => {
      const word = Number(b.result.wordSynced) - Number(a.result.wordSynced);
      const albumA = cleanMatch(a.record.albumName) === cleanMatch(item.albumName) ? 1 : 0;
      const albumB = cleanMatch(b.record.albumName) === cleanMatch(item.albumName) ? 1 : 0;
      const durationA = item.duration ? Math.abs(Number(a.record.duration || 0) - item.duration) : 0;
      const durationB = item.duration ? Math.abs(Number(b.record.duration || 0) - item.duration) : 0;
      return word || albumB - albumA || durationA - durationB;
    });
  return candidates[0]?.result || null;
}

async function fetchSyncedLyrics(item, onUpdate = () => {}) {
  const key = [
    cleanMatch(item.title),
    cleanMatch(artist(item)),
    cleanMatch(item.albumName),
    Math.round(Number(item.duration || 0))
  ].join("|");
  if (lyricCache.has(key)) {
    const cached = lyricCache.get(key);
    onUpdate(cached);
    return cached;
  }

  // Start all independent catalogues together. The first usable result is
  // rendered immediately; a later native word-timed result upgrades it.
  let best = null;
  const publish = result => {
    if (!result?.rows?.length) return;
    const rank = value => value.wordSynced ? 3 : 1;
    if (!best || rank(result) > rank(best)) {
      best = result;
      lyricCache.set(key, result);
      onUpdate(result);
    }
  };
  const sources = [
    fetchLiriQoWordLyrics(item),
    fetchLyricaWordLyrics(item),
    fetchLRCLIBSearch(item)
  ];
  const tasks = sources.map(source => source.then(result => {
    if (!result?.rows?.length) throw new Error("No matched lyrics");
    publish(result);
    return result;
  }));
  const first = await Promise.any(tasks).catch(() => null);
  if (first) {
    // Let a native word-timed source that finishes shortly afterward improve
    // a line-synced first result without delaying the first visible lyrics.
    await Promise.race([
      Promise.allSettled(tasks),
      new Promise(resolve => setTimeout(resolve, 9000))
    ]);
    return best || first;
  }

  // Slow external LRCLIB lookup is only attempted if the fast parallel
  // sources found nothing; it never blocks a usable first result.
  const params = new URLSearchParams({
    track_name: item.title || "",
    artist_name: artist(item),
    ...(item.albumName ? { album_name: item.albumName } : {}),
    ...(item.duration > 0 && item.duration < 3600 ? { duration: String(Math.round(item.duration)) } : {})
  });
  try {
    const record = await lyricRequest(LYRICS_API + "/get?" + params.toString(), 6500);
    const result = lyricRecordResult(record, item);
    if (result) {
      publish(result);
      return result;
    }
  } catch {}
  return best || { rows: [], wordSynced: false, estimated: false };
}

function cataloguePath(query, genre, offset) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), app_name: APP_NAME, sort_method: "popular" });
  if (query.trim()) params.set("query", query.trim());
  if (genre !== "All") params.set("genre", genre);
  return "/tracks/" + (query.trim() ? "search" : "trending") + "?" + params.toString();
}
function parseLrc(source) {
  const rows = [];
  const lines = String(source || "").split(/\r?\n/);
  const offsetLine = lines.find(line => /^\[offset:\s*-?\d+\s*\]/i.test(line));
  const offsetMatch = offsetLine?.match(/^\[offset:\s*(-?\d+)\s*\]/i);
  const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  for (const raw of lines) {
    const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = raw.replace(/\[[^\]]+\]/g, "").trim();
    if (!matches.length || !text) continue;
    for (const match of matches) {
      const digits = match[3] || "0";
      const fraction = Number(digits) / Math.pow(10, digits.length);
      const at = Math.max(0, Number(match[1]) * 60 + Number(match[2]) + fraction + offsetSeconds);
      const existing = rows.find(row => Math.abs(row.at - at) < .005);
      if (existing && !existing.text.includes(text)) existing.text += " · " + text;
      else if (!existing) rows.push({ at, text, end: null, words: [] });
    }
  }
  return rows.sort((x,y) => x.at-y.at);
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
  const [lyrics, setLyrics] = useState([]);
  const [lyricsStatus, setLyricsStatus] = useState("idle");
  const [lyricFileName, setLyricFileName] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [palette, setPalette] = useState(["#a9c8ff", "#5976c8", "#111a38"]);
  const [sourceLabel, setSourceLabel] = useState("AUDIO REACTIVE");
  const [youtubeMode, setYoutubeMode] = useState(false);
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeMeta, setYoutubeMeta] = useState("");
  const [youtubeId, setYoutubeId] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeReady, setYoutubeReady] = useState(false);
  const audio = useRef(null);
  const youtubeMount = useRef(null);
  const youtubePlayer = useRef(null);
  const youtubePlaying = useRef(false);
  const fileInput = useRef(null);
  const mainRef = useRef(null);
  const analyserRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const envelopeRef = useRef(0);
  const lastLowRef = useRef(0);
  const frequencyDataRef = useRef(null);
  const waveformDataRef = useRef(null);
  const lyricRequestRef = useRef(0);
  const lastUiTimeRef = useRef(-1);
  const lastFrameRef = useRef(0);
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

  async function ensureAudioGraph(element) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !sourceRef.current) {
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = .42;
      analyser.minDecibels = -88;
      analyser.maxDecibels = -18;
      const source = context.createMediaElementSource(element);
      source.connect(analyser);
      analyser.connect(context.destination);
      contextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      waveformDataRef.current = new Uint8Array(analyser.fftSize);
    }
    if (contextRef.current?.state === "suspended") await contextRef.current.resume();
  }

  async function playSelected(item) {
    const requestId = ++lyricRequestRef.current;
    setTrack(item);
    setRecent(old => [item, ...old.filter(x => x.id !== item.id)].slice(0, 8));
    setLyrics([]); setLyricsStatus("loading"); setLyricFileName(""); setCurrentTime(0); lastUiTimeRef.current = -1;
    setError(""); setOpen(false); envelopeRef.current = 0; lastLowRef.current = 0;
    fetchSyncedLyrics(item, result => {
      if (requestId !== lyricRequestRef.current) return;
      setLyrics(result.rows);
      setLyricsStatus(result.rows.length ? "ready" : "missing");
    }).then(result => {
      if (requestId !== lyricRequestRef.current) return;
      if (result.rows.length) {
        setLyrics(result.rows);
        setLyricsStatus("ready");
      } else if (!lyrics.length) {
        setLyricsStatus("missing");
      }
    }).catch(() => {
      if (requestId === lyricRequestRef.current) setLyricsStatus("missing");
    });
    const element = audio.current;
    if (!element) return;
    try {
      await ensureAudioGraph(element);
    } catch {
      // Keep playback available even on browsers that deny audio analysis.
    }
    try {
      element.pause();
      element.src = stream(item);
      element.load();
      await element.play();
    } catch { setError(item.previewUrl ? "This preview could not start." : "This stream could not start. Try another result."); }
  }
  async function togglePlayback() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      try {
        await ensureAudioGraph(element);
        await element.play();
      } catch { try { await element.play(); } catch { setError("Playback failed. Choose another track."); } }
    } else element.pause();
  }
  function youtubeSearchSubmit(event) {
    event.preventDefault();
    const q = youtubeSearch.trim();
    if (q) window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(q), "_blank", "noopener,noreferrer");
  }
  async function youtubeLoadSubmit(event) {
    event.preventDefault();
    const raw = youtubeUrl.trim();
    let id = raw;
    try {
      const url = new URL(raw);
      id = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : (url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop());
    } catch {}
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) { setYoutubeError("Paste a valid YouTube video link."); return; }
    setYoutubeError("");
    setYoutubeReady(false);
    setYoutubeId(id);
    youtubePlaying.current = false;
    const parts = youtubeMeta.split(" — ");
    let title = parts[0]?.trim() || "";
    let artistName = parts.slice(1).join(" — ").trim() || "YouTube";
    if (!title) {
      try {
        const res = await fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id) + "&format=json");
        if (res.ok) { const meta = await res.json(); title = meta.title || "YouTube video"; artistName = meta.author_name || artistName; }
      } catch {}
    }
    const item = { id: "youtube-" + id, title: title || "YouTube video", artistName, duration: 0, source: "YouTube" };
    setTrack(item);
    setLyrics([]);
    setLyricsStatus("loading");
    setLyricFileName("");
    setCurrentTime(0);
    lastUiTimeRef.current = -1;
    const requestId = ++lyricRequestRef.current;
    fetchSyncedLyrics(item, result => {
      if (requestId !== lyricRequestRef.current) return;
      setLyrics(result.rows);
      setLyricsStatus(result.rows.length ? "ready" : "missing");
    }).then(result => {
      if (requestId !== lyricRequestRef.current) return;
      setLyrics(result.rows);
      setLyricsStatus(result.rows.length ? "ready" : "missing");
    }).catch(() => { if (requestId === lyricRequestRef.current) setLyricsStatus("missing"); });
  }
  useEffect(() => {
    if (!youtubeId || !youtubeMount.current) return;
    let cancelled = false;
    const mountPlayer = () => {
      if (cancelled || !window.YT?.Player || !youtubeMount.current) return;
      if (youtubePlayer.current) { try { youtubePlayer.current.destroy(); } catch {} }
      youtubePlayer.current = new window.YT.Player(youtubeMount.current, {
        videoId: youtubeId,
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) setYoutubeReady(true); },
          onStateChange: event => {
            const state = window.YT.PlayerState;
            const active = event.data === state.PLAYING;
            youtubePlaying.current = active;
            setPlaying(active);
          },
          onError: event => setYoutubeError(event.data === 101 || event.data === 150 ? "This video does not allow embedded playback." : "YouTube playback is unavailable for this video.")
        }
      });
    };
    if (window.YT?.Player) mountPlayer();
    else {
      const prior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { try { prior?.(); } catch {} mountPlayer(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => setYoutubeError("Could not load the YouTube player.");
        document.head.appendChild(script);
      }
    }
    return () => { cancelled = true; youtubePlaying.current = false; if (youtubePlayer.current) { try { youtubePlayer.current.destroy(); } catch {} youtubePlayer.current = null; } };
  }, [youtubeId]);
  useEffect(() => {
    let frame;
    const tick = timestamp => {
      const elapsed = lastFrameRef.current ? Math.min(.08, (timestamp - lastFrameRef.current) / 1000) : .016;
      lastFrameRef.current = timestamp;
      const analyser = analyserRef.current;
      const element = audio.current;
      let pulse = 0;
      if (analyser && playing && element && !element.paused) {
        const bins = frequencyDataRef.current || new Uint8Array(analyser.frequencyBinCount);
        const wave = waveformDataRef.current || new Uint8Array(analyser.fftSize);
        analyser.getByteFrequencyData(bins);
        analyser.getByteTimeDomainData(wave);
        let bass = 0, mids = 0, peak = 0, rms = 0;
        for (let i = 2; i < Math.min(28, bins.length); i++) bass += bins[i] / 255;
        bass /= Math.max(1, Math.min(28, bins.length) - 2);
        for (let i = 28; i < Math.min(110, bins.length); i++) mids += bins[i] / 255;
        mids /= Math.max(1, Math.min(110, bins.length) - 28);
        for (let i = 0; i < wave.length; i++) {
          const sample = Math.abs((wave[i] - 128) / 128);
          peak = Math.max(peak, sample);
          rms += sample * sample;
        }
        rms = Math.sqrt(rms / Math.max(1, wave.length));
        const energy = Math.min(1, bass * .72 + mids * .18 + rms * .65 + peak * .12);
        if (energy < .006) {
          // Some cross-origin previews play normally but expose silent analyser buffers.
          const phase = (element.currentTime % .52) / .52;
          const fallbackPulse = Math.pow(Math.max(0, Math.sin(phase * Math.PI * 2)), 5) * .72;
          envelopeRef.current = Math.max(fallbackPulse, envelopeRef.current * Math.exp(-elapsed * 3));
          pulse = envelopeRef.current;
        } else {
          const transient = Math.max(0, energy - lastLowRef.current) * 3.2;
          lastLowRef.current = energy;
          envelopeRef.current = Math.max(transient, envelopeRef.current * Math.exp(-elapsed * 5.2), energy * .42);
          pulse = Math.min(1, envelopeRef.current);
        }
      } else if (playing && element && !element.paused) {
        // Rhythmic visual fallback for browsers that expose playback but block analyser data.
        const beatPhase = (element.currentTime % .52) / .52;
        const rhythmic = Math.pow(Math.max(0, Math.sin(beatPhase * Math.PI * 2)), 5);
        envelopeRef.current = Math.max(rhythmic * .72, envelopeRef.current * Math.exp(-elapsed * 3));
        pulse = envelopeRef.current;
      } else {
        envelopeRef.current *= Math.exp(-elapsed * 7);
        lastLowRef.current = 0;
      }
      mainRef.current?.style.setProperty("--beat", String(pulse));
      mainRef.current?.style.setProperty("--beat-glow", String(.16 + pulse * .84));
      if (element && !element.paused) {
        const now = element.currentTime;
        if (lastUiTimeRef.current < 0 || Math.abs(now - lastUiTimeRef.current) >= .075) {
          lastUiTimeRef.current = now;
          setCurrentTime(now);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); lastFrameRef.current = 0; };
  }, [playing]);

  const activeLyric = useMemo(() => {
    let found = -1;
    for (let i = 0; i < lyrics.length; i++) if (lyrics[i].at <= currentTime) found = i; else break;
    return found;
  }, [lyrics, currentTime]);
  const activeWords = useMemo(() => {
    if (activeLyric < 0) return [];
    const row = lyrics[activeLyric];
    // Prefer native per-word timing. Line-synced LRC remains usable as an
    // immediate visual fallback, with words revealed in sequence at the
    // verified line timestamp (not falsely labelled as native word sync).
    const nativeWords = Array.isArray(row.words) && row.words.length;
    const words = nativeWords
      ? row.words
      : String(row.text || "").trim().split(/\\s+/).filter(Boolean).map((text, index) => ({
          text, at: row.at, end: row.end, index
        }));
    return words.slice(0, 18)
      .filter(word => !nativeWords || (Number.isFinite(word.at) && word.at <= currentTime + .015))
      .map((word, index) => ({
        text: word.text.trim(),
        index: Number.isFinite(word.index) ? word.index : index,
        live: nativeWords ? currentTime <= (word.end ?? word.at + .45) : true,
        native: !!nativeWords
      }));
  }, [lyrics, activeLyric, currentTime]);

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
      {lyrics.length > 0 && activeLyric >= 0 && (lyrics[activeLyric]?.words?.length || lyrics[activeLyric]?.text) ? <>
        <div className="lyric-kicker">{lyricFileName ? "LOCAL LYRIC CONSTELLATION" : lyrics[activeLyric]?.words?.length ? "WORD-SYNCED LYRIC CONSTELLATION" : "LINE-SYNCED LYRIC CONSTELLATION"}</div>
        <svg className="word-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          {activeWords.slice(0, 18).map((word, i) => <line key={i} x1={8 + i * (84 / Math.max(1, activeWords.length))} y1={50 + Math.sin(i * 1.8) * 15} x2={8 + (i + 1) * (84 / Math.max(1, activeWords.length))} y2={50 + Math.sin((i + 1) * 1.8) * 15} />)}
        </svg>
        <div className="lyric-word-row">{activeWords.slice(0, 18).map((word, i) => <motion.span key={activeLyric + "-" + word.index} className={"lyric-word " + (word.live ? "is-current-word" : "")} initial={{ opacity: 0, y: 24, scale: .7, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} transition={{ duration: .24, delay: word.native ? 0 : i * .055, type: "spring", stiffness: 220, damping: 19 }}>{word.text}<i /></motion.span>)}</div>
        <div className="lyric-next">{lyrics[activeLyric + 1]?.text || ""}</div>
      </> : <div className="lyric-idle">{track ? (lyricsStatus === "loading" ? "SEARCHING FOR SYNCHRONIZED LYRICS" : lyricsStatus === "missing" ? "NO SYNCHRONIZED LYRICS FOUND FOR THIS TRACK" : lyrics.length > 0 ? "NATIVE WORD SYNC NOT AVAILABLE FOR THIS TRACK" : "AURORA · SOUND BECOMES LIGHT") : "AURORA · SOUND BECOMES LIGHT"}</div>}
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
