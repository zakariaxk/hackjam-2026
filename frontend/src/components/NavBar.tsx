import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Dot, Toggle, enter } from "./ui";
import { IconMore } from "./Icons";

interface Props {
  radioOnline: boolean;
  serverOnline: boolean;
  showSim: boolean;
  onToggleSim: (v: boolean) => void;
  outbreak: boolean;
  onOutbreak: (v: boolean) => void;
  onSimulateAlert: () => void;
  onRecenter: () => void;
}

export default function NavBar(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const pill = !p.serverOnline
    ? { color: "#ff9f0a", text: "Server unreachable", pulse: false }
    : p.radioOnline
      ? { color: "#30d158", text: "LoRa mesh · Online", pulse: true }
      : { color: "#86868b", text: "LoRa mesh · Offline", pulse: false };

  const item = "flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[14px] text-ink hover:bg-fill";

  return (
    <header className="glass pointer-events-auto flex h-13 items-center justify-between gap-3 rounded-panel px-4 pl-5">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Bullhorn</span>
        <span className="hidden truncate text-[13px] text-faint lg:inline">
          Early warning for New World screwworm, built for the open range.
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex h-8 items-center gap-2 rounded-pill bg-fill px-3 text-[12px] font-medium text-ink tnum">
          <Dot color={pill.color} pulse={pill.pulse} />
          <span className="whitespace-nowrap">{pill.text}</span>
        </div>

        <Toggle checked={p.showSim} onChange={p.onToggleSim} label="Simulation" />

        <div ref={ref} className="relative">
          <button
            type="button"
            aria-label="More"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full text-mute transition-colors hover:bg-fill hover:text-ink"
          >
            <IconMore size={20} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={enter}
                className="glass-strong absolute right-0 top-11 z-50 w-64 origin-top-right rounded-[14px] p-1.5 shadow-2xl"
              >
                <button className={item} onClick={() => { p.onRecenter(); setOpen(false); }}>
                  Recenter ranch
                </button>
                <button className={item} onClick={() => { p.onOutbreak(!p.outbreak); setOpen(false); }}>
                  {p.outbreak ? "Clear outbreak scenario" : "Run outbreak scenario"}
                  <span className="text-[11px] text-faint">Simulated</span>
                </button>
                <a className={item} href="/cam" target="_blank" rel="noreferrer">
                  Open rover camera
                </a>
                <div className="my-1 h-px bg-line" />
                <button className={`${item} text-mute`} onClick={() => { p.onSimulateAlert(); setOpen(false); }}>
                  Simulate alert (backup)
                  <span className="text-[11px] text-faint">Manual</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
