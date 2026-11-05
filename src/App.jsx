import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, ChevronDown, Disc3, Maximize2, Music2, Orbit, Sparkles } from "lucide-react";

const stars = Array.from({ length: 115 }, (_, index) => ({
  id: index,
  left: (index * 37.17) % 100,
  top: (index * 61.73) % 100,
  delay: (index % 19) * -0.37,
  duration: 2.4 + (index % 13) * 0.31,
  size: index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1
}));

export default function App() {
  const [dockOpen, setDockOpen] = useState(true);
  const notice = "Your music universe is ready";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDockOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDockOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="universe">
      <div className="noise" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="horizon" />
      <div className="star-field" aria-hidden="true">
        {stars.map((star) => (
          <span key={star.id} className="star" style={{
            left: `${star.left}%`, top: `${star.top}%`, width: star.size,
            height: star.size, animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`
          }} />
        ))}
      </div>

      <header className="topbar">
        <a className="brand" href="#home" aria-label="Aurora home">
          <span className="brand-mark"><Orbit size={17} /></span>
          <span>AURORA<span className="brand-dot">.</span></span>
        </a>
        <div className="system-status"><span className="status-light" /> SYSTEM ONLINE <i /> LOCAL ENVIRONMENT</div>
        <button className="top-icon" onClick={() => setDockOpen((open) => !open)} aria-label="Toggle music dock">
          <AudioLines size={17} />
        </button>
      </header>

      <section className="center-stage" id="home">
        <div className="orbital orbital-a" />
        <div className="orbital orbital-b" />
        <motion.div className="core-emblem" animate={{ rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }}>
          <div className="core-inner"><Disc3 size={34} strokeWidth={1.1} /></div>
        </motion.div>
        <motion.div className="welcome-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <span className="eyebrow"><Sparkles size={12} /> YOUR PERSONAL SOUND UNIVERSE</span>
          <h1>Enter the <em>unknown.</em></h1>
          <p>A quieter space. A deeper connection to sound.</p>
          <button className="launch-button" onClick={() => setDockOpen(true)}>
            <Music2 size={15} /> OPEN MUSIC DOCK <span>↗</span>
          </button>
        </motion.div>
      </section>

      <footer className="bottom-bar">
        <div><span className="tiny-pulse" /> {notice}</div>
        <div className="shortcut">DOCK <kbd>CTRL</kbd> + <kbd>K</kbd><span className="footer-divider" /> ESC TO COLLAPSE</div>
      </footer>

      <AnimatePresence>
        {!dockOpen && (
          <motion.button className="mini-dock" onClick={() => setDockOpen(true)}
            initial={{ opacity: 0, scale: 0.45, x: -18, y: -12 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.55, x: -14, y: -10 }}
            transition={{ type: "spring", stiffness: 330, damping: 25 }}
            aria-label="Reopen music dock">
            <span className="mini-orbit"><AudioLines size={17} /></span>
            <span className="mini-eq"><i /><i /><i /><i /></span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dockOpen && (
          <motion.div className="dock-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="music-dock"
              initial={{ opacity: 0, scale: 0.82, y: 35, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.72, y: -22, filter: "blur(8px)" }}
              transition={{ type: "spring", stiffness: 190, damping: 23 }}
              role="dialog" aria-modal="false" aria-label="Aurora music dock">
              <div className="dock-edge" />
              <div className="dock-heading">
                <div className="dock-title"><span className="dock-symbol"><AudioLines size={17} /></span><div><strong>MUSIC INTERFACE</strong><small>STREAMING PORTAL <b>•</b> STAGE 01</small></div></div>
                <button className="close-button" onClick={() => setDockOpen(false)} aria-label="Collapse dock"><ChevronDown size={19} /></button>
              </div>

              <div className="dock-body">
                <div className="portal-art">
                  <div className="art-ring ring-one" /><div className="art-ring ring-two" />
                  <div className="art-core"><Disc3 size={48} strokeWidth={0.8} /></div>
                  <span className="art-caption">A U R O R A <i /> AUDIO PORTAL</span>
                </div>
                <div className="portal-content">
                  <span className="eyebrow">CONNECT YOUR SOUND</span>
                  <h2>Your next<br /><em>dimension.</em></h2>
                  <p>Connect a Spotify track, album or playlist using its share link. Spotify playback will be added in Stage 2.</p>
                  <div className="stage-preview">
                    <span className="stage-preview-icon"><Music2 size={17} /></span>
                    <div><strong>SPOTIFY CONNECTION</strong><small>OFFICIAL EMBED INTEGRATION ARRIVES IN STAGE 02</small></div>
                  </div>
                  <div className="portal-note"><span className="status-light" /> SPOTIFY INTEGRATION: STAGE 02</div>
                </div>
              </div>

              <div className="dock-footer"><span> <span className="footer-dot" /> SECURE LOCAL INTERFACE</span><span>AURORA / 001 <Maximize2 size={11} /></span></div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
