import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { post, useConfig, useStatus } from "../api";
import { useHerd } from "../sim";
import FlowPanel from "./FlowPanel";
import HerdPanel from "./HerdPanel";
import MapView, { type MapPadding } from "./MapView";
import NavBar from "./NavBar";
import ResultSheet from "./ResultSheet";
import { IconClose, IconWarning } from "./Icons";
import { Panel, Spinner, enter, spring } from "./ui";

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

export default function Dashboard() {
  const config = useConfig();
  const { status, online, clockOffset } = useStatus();
  const isDesktop = useMedia("(min-width: 1024px)");
  const [showSim, setShowSim] = useState(true);
  const [outbreak, setOutbreakState] = useState(false);
  const { herd, setOutbreak } = useHerd(config, showSim);
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const shownVersion = useRef<number>(-1);

  const now = Date.now() / 1000 + clockOffset;

  // Open the result sheet automatically when a new Gemini result lands.
  useEffect(() => {
    if (!status) return;
    if (shownVersion.current === -1) {
      shownVersion.current = status.result ? status.image_version : 0;
      return;
    }
    if (status.result && status.image_version !== shownVersion.current) {
      shownVersion.current = status.image_version;
      setResultOpen(true);
    }
    if (!status.result) setResultOpen(false);
  }, [status?.result, status?.image_version]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (name: string, path: string) => {
    setBusy(name);
    setLocalError(null);
    const r = await post(path);
    setBusy(null);
    if (!r.ok && r.error && !["radio offline", "cow id unknown", "camera offline"].includes(r.error)) setLocalError(r.error);
  };

  const toggleOutbreak = (on: boolean) => {
    if (on) setShowSim(true);
    setOutbreak(on);
    setOutbreakState(on);
  };

  const error = !online ? "Can't reach the Bullhorn server. Is uvicorn running?" : localError || status?.last_error || null;

  if (!config || !status) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-black text-mute">
        <div className="flex flex-col items-center gap-4">
          <span className="text-[28px] font-semibold tracking-[-0.01em] text-ink">Bullhorn</span>
          <div className="flex items-center gap-2 text-[14px]">
            <Spinner /> {online ? "Loading ranch" : "Waiting for server"}
          </div>
        </div>
      </div>
    );
  }

  const padding: MapPadding = isDesktop
    ? { top: 84, bottom: 24, left: 352, right: 412 }
    : { top: 72, bottom: 24, left: 0, right: 0 };

  const flow = (
    <FlowPanel
      status={status}
      now={now}
      busy={busy}
      onLocate={() => act("locate", "ping-cow")}
      onDispatch={() => act("dispatch", "dispatch")}
      onScan={() => act("scan", "request-scan")}
      onReset={() => {
        toggleOutbreak(false);
        act("reset", "reset");
      }}
      onOpenResult={() => setResultOpen(true)}
    />
  );
  const herdPanel = (
    <HerdPanel
      config={config}
      nodes={status.nodes}
      alert={status.alert}
      herd={showSim ? herd : []}
      showSim={showSim}
      radioOnline={status.radio_online}
      now={now}
    />
  );

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black">
      {/* Map hero */}
      <div className={`absolute inset-x-0 top-0 ${isDesktop ? "h-full" : "h-[50dvh]"}`}>
        <MapView
          config={config}
          nodes={status.nodes}
          alert={status.alert}
          herd={herd}
          showSim={showSim}
          dispatchedAt={status.flow.dispatched_at}
          clockOffset={clockOffset}
          padding={padding}
          focusNonce={focusNonce}
        />
      </div>

      {/* Nav */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 lg:inset-x-4 lg:top-4">
        <NavBar
          radioOnline={status.radio_online}
          serverOnline={online}
          showSim={showSim}
          onToggleSim={(v) => {
            setShowSim(v);
            if (!v) toggleOutbreak(false);
          }}
          outbreak={outbreak}
          onOutbreak={toggleOutbreak}
          onSimulateAlert={() => act("simulate", "simulate-alert")}
          onRecenter={() => setFocusNonce((n) => n + 1)}
        />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={enter}
            className="absolute inset-x-3 top-[72px] z-30 flex justify-center lg:left-[352px] lg:right-[412px] lg:top-[84px]"
          >
            <div className="glass-strong flex max-w-[560px] items-start gap-3 rounded-[14px] px-4 py-3 text-[13px]">
              <IconWarning size={18} className="mt-px shrink-0 text-warn" />
              <span className="leading-snug text-ink/90">{error}</span>
              {online && (
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="-mr-1 shrink-0 rounded-full p-0.5 text-mute hover:text-ink"
                  onClick={() => {
                    setLocalError(null);
                    post("clear-error");
                  }}
                >
                  <IconClose size={16} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isDesktop ? (
        <>
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="absolute bottom-4 left-4 top-[84px] z-20 w-[320px]"
          >
            <Panel className="no-scrollbar max-h-full overflow-y-auto">{herdPanel}</Panel>
          </motion.aside>
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.15 }}
            className="absolute bottom-4 right-4 top-[84px] z-20 w-[380px]"
          >
            <Panel className="no-scrollbar max-h-full overflow-y-auto">{flow}</Panel>
          </motion.aside>
        </>
      ) : (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring}
          className="glass-strong no-scrollbar absolute inset-x-0 bottom-0 top-[calc(50dvh-24px)] z-20 overflow-y-auto rounded-t-sheet pb-[env(safe-area-inset-bottom)]"
        >
          <div className="sticky top-0 z-10 flex justify-center pt-2">
            <span className="h-1 w-9 rounded-full bg-white/25" />
          </div>
          {flow}
          <div className="mx-5 h-px bg-line" />
          {herdPanel}
        </motion.div>
      )}

      <AnimatePresence>
        {resultOpen && status.result && (
          <ResultSheet result={status.result} imageVersion={status.image_version} scannedAt={status.flow.scanned_at} onClose={() => setResultOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
