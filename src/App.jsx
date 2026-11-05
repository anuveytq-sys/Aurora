import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, ChevronDown, Disc3, ExternalLink, Link2, Orbit, Play, X } from "lucide-react";

const STORAGE_KEY = "aurora.spotify.content.v1";
const stars = Array.from({ length: 115 }, (_, index) => ({
  id: index, left: (index * 37.17) % 100, top: (index * 61.73) % 100,
  delay: (index % 19) * -0.37, duration: 2.4 + (index % 13) * 0.31,
  size: index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1
}));

function parseSpotifyLink(value) {
  const input = value.trim();
  const uriMatch = input.match(/^spotify:(track|album|playlist|artist|show|episode):([a-zA-Z0-9]+)$/);
  if (uriMatch) return { type: uriMatch[1], id: uriMatch[2] };
  try {
    const url = new URL(input);
    if (!["open.spotify.com", "www.open.spotify.com"].includes(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const offset = parts[0]?.startsWith("intl-") ? 1 : 0;
    const type = parts[offset], id = parts[offset + 1];
    if (!["track", "album", "playlist", "artist", "show", "episode"].includes(type)) return null;
    return id && /^[a-zA-Z0-9]+$/.test(id) ? { type, id } : null;
  } catch { return null; }
}

function embedUrl(content) {
  return content ? `https://open.spotify.com/embed/${content.type}/${content.id}?utm_source=generator&theme=0` : "";
}

export default function App() {
  const [dockOpen, setDockOpen] = useState(true);
  const [linkInput, setLinkInput] = useState("");
  const [content, setContent] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved && ["track", "album", "playlist", "artist", "show", "episode"].includes(saved.type) && /^[a-zA-Z0-9]+$/.test(saved.id) ? saved : null;
    } catch { return null; }
  });
  const [error, setError] = useState("");
  const [isPasting, setIsPasting] = useState(false);
  const [playerExpanded, setPlayerExpanded] = useState(true);
  const iframeSrc = useMemo(() => embedUrl(content), [content]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDockOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setDockOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (content) localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    else localStorage.removeItem(STORAGE_KEY);
  }, [content]);

  const connectContent = (event) => {
    event.preventDefault();
    const parsed = parseSpotifyLink(linkInput);
    if (!parsed) { setError("Paste a valid Spotify share link or URI."); return; }
    setContent(parsed); setError(""); setPlayerExpanded(true); setLinkInput("");
  };

  const pasteLink = async () => {
    if (!navigator.clipboard?.readText) { setError("Clipboard access is unavailable. Paste your link into the field."); return; }
    try {
      setIsPasting(true);
      setLinkInput(await navigator.clipboard.readText());
      setError("");
    } catch { setError("Clipboard permission was not granted. Paste your link manually."); }
    finally { setIsPasting(false); }
  };

  const clearContent = () => { setContent(null); setError(""); setPlayerExpanded(true); };

  return (
    <main className="universe">
      <div className="noise" /><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="horizon" />
      <div className="star-field" aria-hidden="true">
        {stars.map((star) => <span key={star.id} className="star" style={{left:`${star.left}%`,top:`${star.top}%`,width:star.size,height:star.size,animationDelay:`${star.delay}s`,animationDuration:`${star.duration}s`}} />)}
      </div>

      <header className="topbar">
        <a className="brand" href="#home" aria-label="Aurora home"><span className="brand-mark"><Orbit size={16} /></span><span>AURORA<span className="brand-dot">.</span></span></a>
        <div className="system-status"><span className="status-light" /> {content ? "SIGNAL CONNECTED" : "AWAITING SIGNAL"}</div>
        <button className="top-icon" onClick={() => setDockOpen((open) => !open)} aria-label="Toggle music interface"><AudioLines size={17} /></button>
      </header>

      <section className="center-stage" id="home">
        <div className="orbital orbital-a" /><div className="orbital orbital-b" />
        <motion.button className={`core-emblem ${content ? "is-active" : ""}`} onClick={() => setDockOpen(true)} aria-label="Open Aurora music interface" whileHover={{scale:1.06}} whileTap={{scale:.96}}>
          <motion.div className="core-inner" animate={{rotate:360}} transition={{duration:34,repeat:Infinity,ease:"linear"}}><Disc3 size={35} strokeWidth={1.05} /></motion.div>
        </motion.button>
        <motion.div className="center-hint" initial={{opacity:0}} animate={{opacity:.68}} transition={{delay:1}}>{content ? "SOUND IS IN MOTION" : "TOUCH THE ORBIT"}</motion.div>
      </section>

      <footer className="bottom-bar"><div><span className="tiny-pulse" /> {content ? "AUDIO PORTAL READY" : "A QUIETER KIND OF INFINITY"}</div><div className="shortcut"><kbd>CTRL</kbd> + <kbd>K</kbd><span className="footer-divider" /> <kbd>ESC</kbd></div></footer>

      <AnimatePresence>
        {!dockOpen && <motion.button className="mini-dock" onClick={() => setDockOpen(true)} initial={{opacity:0,scale:.45,x:-18,y:-12}} animate={{opacity:1,scale:1,x:0,y:0}} exit={{opacity:0,scale:.55,x:-14,y:-10}} transition={{type:"spring",stiffness:330,damping:25}} aria-label="Reopen music interface"><span className="mini-orbit"><AudioLines size={17}/></span><span className="mini-eq"><i/><i/><i/><i/></span></motion.button>}
      </AnimatePresence>

      {/* This is the only Spotify iframe. The dock is visually hidden, not unmounted, when collapsed. */}
      <motion.div className="dock-overlay" initial={false} animate={{opacity:dockOpen?1:0}} transition={{duration:.24}} style={{pointerEvents:dockOpen?"auto":"none"}}>
        <motion.section className={`music-dock ${content && playerExpanded ? "music-dock-player" : ""}`}
          initial={false} animate={{opacity:dockOpen?1:0,scale:dockOpen?1:.82,y:dockOpen?0:24,filter:dockOpen?"blur(0px)":"blur(8px)"}}
          transition={{type:"spring",stiffness:190,damping:23}} role="dialog" aria-modal="false" aria-label="Aurora music interface">
          <div className="dock-edge" />
          <div className="dock-heading"><div className="dock-title"><span className="dock-symbol"><AudioLines size={17}/></span><div><strong>AURORA</strong><small>PERSONAL SOUND PORTAL</small></div></div><button className="close-button" onClick={()=>setDockOpen(false)} aria-label="Collapse interface"><ChevronDown size={19}/></button></div>

          {!content ? (
            <div className="connect-view">
              <motion.div className="portal-art" animate={{rotate:[0,1.5,0,-1.5,0]}} transition={{duration:16,repeat:Infinity,ease:"easeInOut"}}><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-core"><Disc3 size={48} strokeWidth={.8}/></div></motion.div>
              <div className="connect-controls"><span className="eyebrow">CONNECT A FREQUENCY</span>
                <form className="spotify-form" onSubmit={connectContent}>
                  <div className="link-input"><Link2 size={15}/><input aria-label="Spotify share link" value={linkInput} onChange={(event)=>{setLinkInput(event.target.value);setError("");}} placeholder="Paste a Spotify link or URI" autoComplete="off" spellCheck="false"/><button type="button" onClick={pasteLink} disabled={isPasting} aria-label="Paste from clipboard">{isPasting?"…":"PASTE"}</button></div>
                  <button className="connect-button" type="submit" disabled={!linkInput.trim()}><Play size={13} fill="currentColor"/> CONNECT</button>
                </form>
                {error&&<p className="form-error" role="alert">{error}</p>}
                <p className="support-note">TRACKS · ALBUMS · PLAYLISTS · ARTISTS · SHOWS</p>
              </div>
            </div>
          ) : (
            <div className="connected-view">
              <div className="connected-topline"><span className="eyebrow"><span className="status-light"/> SPOTIFY SIGNAL ESTABLISHED</span><button className="text-icon-button" onClick={clearContent} aria-label="Disconnect current Spotify content"><X size={14}/></button></div>
              <div className="embed-shell">
                <div className="embed-label"><span>{content.type.toUpperCase()} STREAM</span><span>SPOTIFY OFFICIAL PLAYER</span></div>
                <div className={`player-frame ${playerExpanded?"":"player-frame-collapsed"}`}>
                  <iframe title="Spotify official embedded player" src={iframeSrc} width="100%" height={content.type==="track"||content.type==="episode"?"152":"352"} frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager" allowFullScreen/>
                </div>
              </div>
              <div className="connected-actions"><button className="text-icon-button" onClick={()=>setPlayerExpanded((expanded)=>!expanded)}>{playerExpanded?"COLLAPSE PLAYER":"SHOW PLAYER"}</button><a className="spotify-open" href={`https://open.spotify.com/${content.type}/${content.id}`} target="_blank" rel="noreferrer">OPEN IN SPOTIFY <ExternalLink size={12}/></a></div>
              <form className="change-link-form" onSubmit={connectContent}><input aria-label="Replace Spotify link" value={linkInput} onChange={(event)=>{setLinkInput(event.target.value);setError("");}} placeholder="Replace with another Spotify link"/><button type="submit" disabled={!linkInput.trim()} aria-label="Load new Spotify link"><Play size={13}/></button></form>
              {error&&<p className="form-error" role="alert">{error}</p>}
            </div>
          )}
          <div className="dock-footer"><span><span className="footer-dot"/> LOCAL-FIRST / NO API KEY</span><span>AURORA / 002 <Orbit size={11}/></span></div>
        </motion.section>
      </motion.div>
    </main>
  );
}
