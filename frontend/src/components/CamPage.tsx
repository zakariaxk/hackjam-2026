import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner, enter, spring } from "./ui";
import { IconCamera, IconCheck } from "./Icons";

type Phase = "idle" | "starting" | "live" | "error";
const MAX_W = 1600;

/**
 * Rover camera page (/cam). Open on the iPhone taped to the rover.
 * Polls /api/should-scan every second; when the dashboard asks for a scan,
 * grabs a frame and uploads it to /api/analyze.
 */
export default function CamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [connected, setConnected] = useState(true);
  const [uploading, setUploading] = useState(false);

  const start = async () => {
    setPhase("starting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera needs HTTPS. Open this page through the cloudflared https:// link.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setPhase("live");
      // Keep the screen awake while mounted on the rover (iOS 16.4+).
      try {
        await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock?.request(
          "screen",
        );
      } catch {
        /* optional */
      }
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const capture = useCallback(async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || busyRef.current || !v.videoWidth) return;
    busyRef.current = true;
    setUploading(true);
    setFlash((f) => f + 1);
    try {
      const scale = Math.min(1, MAX_W / v.videoWidth);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      const blob: Blob = await new Promise((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode frame"))), "image/jpeg", 0.85),
      );
      setToast("Captured");
      const fd = new FormData();
      fd.append("file", blob, "capture.jpg");
      const r = await fetch("/api/analyze", { method: "POST", body: fd });
      const body = await r.json().catch(() => ({}));
      setToast(r.ok ? "Sent to Bullhorn" : body.error ? "Analysis failed" : "Upload failed");
    } catch (e) {
      setToast("Upload failed");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setUploading(false);
      window.setTimeout(() => setToast(null), 2200);
    }
  }, []);

  // Poll for scan requests from the dashboard.
  useEffect(() => {
    if (phase !== "live") return;
    let alive = true;
    let t: number | undefined;
    const tick = async () => {
      try {
        const r = await fetch("/api/should-scan", { cache: "no-store" });
        const { scan } = await r.json();
        if (!alive) return;
        setConnected(true);
        if (scan) await capture();
      } catch {
        if (alive) setConnected(false);
      } finally {
        if (alive) t = window.setTimeout(tick, 1000);
      }
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [phase, capture]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-ink">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* shutter flash */}
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      {/* top status */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(16px,env(safe-area-inset-top))]">
        <span className="rounded-pill bg-black/50 px-3.5 py-1.5 text-[15px] font-semibold tracking-[-0.02em] backdrop-blur-md">
          Bullhorn
          <span className="ml-1.5 font-normal text-white/60">Rover camera</span>
        </span>
        {phase === "live" && (
          <span className="flex items-center gap-2 rounded-pill bg-black/50 px-3 py-1.5 text-[12px] backdrop-blur-md">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-ok" : "bg-warn"}`} />
            {connected ? (uploading ? "Uploading" : "Ready for scan") : "Reconnecting"}
          </span>
        )}
      </div>

      {/* start screen */}
      <AnimatePresence>
        {phase !== "live" && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black px-8 text-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={enter}
          >
            <div className="grid h-16 w-16 place-items-center rounded-full bg-fill text-ink">
              <IconCamera size={28} />
            </div>
            <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.003em]">Rover camera</h1>
            <p className="mt-2 max-w-[300px] text-[15px] leading-[1.47] text-mute">
              Mount this phone on the rover. When the dashboard taps Scan wound, a frame is captured and sent for triage.
            </p>
            <button
              type="button"
              onClick={start}
              disabled={phase === "starting"}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-pill bg-accent px-7 text-[17px] text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {phase === "starting" && <Spinner />}
              Start camera
            </button>
            {error && <p className="mt-5 max-w-[320px] text-[13px] leading-snug text-warn">{error}</p>}
            <p className="mt-10 text-[12px] text-faint">Tip: set Auto-Lock to Never in Settings › Display & Brightness.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[16px] bg-black/60 px-5 py-3.5 text-[17px] font-semibold backdrop-blur-xl"
          >
            <IconCheck size={20} className="text-ok" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* shutter */}
      {phase === "live" && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(36px,env(safe-area-inset-bottom))] pt-6">
          <motion.button
            type="button"
            aria-label="Capture"
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.12 }}
            onClick={capture}
            className="grid h-[78px] w-[78px] place-items-center rounded-full border-[4px] border-white/90"
          >
            <span className={`h-[62px] w-[62px] rounded-full bg-white transition-opacity ${uploading ? "opacity-50" : ""}`} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
