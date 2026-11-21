import { AnimatePresence, motion } from "framer-motion";
import type { Status } from "../types";
import { formatTime } from "../api";
import { Button, Spinner, enter, spring } from "./ui";
import { IconBell, IconCamera, IconChevron, IconReset, IconRover } from "./Icons";
import { ROVER_TRIP_S } from "./MapView";

interface Props {
  status: Status;
  now: number;
  busy: string | null;
  onLocate: () => void;
  onDispatch: () => void;
  onScan: () => void;
  onReset: () => void;
  onOpenResult: () => void;
}

const STEPS = ["Detected", "Located", "Dispatched", "Scanned", "Reported"] as const;

export default function FlowPanel({ status, now, busy, onLocate, onDispatch, onScan, onReset, onOpenResult }: Props) {
  const { alert, flow, result } = status;
  const done = [
    !!alert,
    !!flow.located_at,
    !!flow.dispatched_at,
    !!flow.scanned_at || status.has_image,
    !!result?.parsed,
  ];
  const current = done.findIndex((d) => !d);

  const next: "locate" | "dispatch" | "scan" | "report" | null = !alert
    ? null
    : !done[1]
      ? "locate"
      : !done[2]
        ? "dispatch"
        : !done[3]
          ? "scan"
          : result
            ? "report"
            : null;

  const roverArrived = flow.dispatched_at ? now - flow.dispatched_at >= ROVER_TRIP_S : false;
  const waitingForCam = status.scan_pending;
  const waitedLong = waitingForCam && flow.scan_requested_at ? now - flow.scan_requested_at > 6 : false;

  return (
    <div className="p-5">
      {/* ---------- Headline ---------- */}
      <AnimatePresence mode="wait" initial={false}>
        {alert ? (
          <motion.div
            key={`alert-${alert.id}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={spring}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-alert">
                <span className="h-1.5 w-1.5 rounded-full bg-alert" />
                ALERT
              </span>
              {alert.source === "manual" && (
                <span className="rounded-pill border border-warn/40 px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.04em] text-warn">
                  MANUAL TRIGGER
                </span>
              )}
            </div>
            <h2 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[0.004em]">Cow1</h2>
            <p className="mt-1 text-[15px] text-ink/90">Abnormal behavior · head shaking</p>
            <p className="mt-1 text-[13px] text-mute tnum">
              {formatTime(alert.time)} · via {alert.source === "lora" ? "LoRa mesh" : "manual backup trigger"}
            </p>
          </motion.div>
        ) : (
          <motion.div key="quiet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={enter}>
            <div className="eyebrow">Monitoring</div>
            <h2 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[0.004em]">All quiet.</h2>
            <p className="mt-1.5 text-[14px] leading-snug text-mute">
              Bullhorn sounds the alarm the moment a tag reports irritated behavior.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Steps ---------- */}
      <ol className="mt-5 flex items-center gap-1">
        {STEPS.map((s, i) => {
          const isDone = done[i];
          const isCurrent = !!alert && i === current;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${isDone ? "bg-ink" : "bg-link"}`}
                  initial={false}
                  animate={{ width: isDone ? "100%" : isCurrent ? "35%" : "0%" }}
                  transition={spring}
                />
              </div>
              <span
                className={`truncate text-[10.5px] font-medium transition-colors duration-300 ${
                  isDone ? "text-ink" : isCurrent ? "text-link" : "text-faint"
                }`}
              >
                {s}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ---------- Live state line ---------- */}
      <div className="mt-4 min-h-[44px]">
        <AnimatePresence mode="wait" initial={false}>
          {status.analyzing ? (
            <StateLine key="an" icon={<Spinner />} title="Analyzing with Gemini" sub="Screwworm risk triage · usually under 10 s" progress />
          ) : waitingForCam ? (
            <StateLine
              key="wait"
              icon={<Spinner />}
              title="Waiting for rover camera"
              sub={waitedLong ? "Is /cam open on the rover phone with the camera started?" : "Capturing frame…"}
            />
          ) : flow.dispatched_at && !done[3] ? (
            <StateLine
              key="rv"
              icon={<IconRover size={18} />}
              title={roverArrived ? "Rover on site" : "Rover en route"}
              sub={roverArrived ? "Ready to scan the wound." : "Driving from Barn Station to Cow1."}
            />
          ) : flow.located_at && !flow.dispatched_at ? (
            <StateLine key="lc" icon={<IconBell size={18} />} title="Tag beeping" sub="Cow1's tag received the locate signal over LoRa." />
          ) : null}
        </AnimatePresence>
      </div>

      {/* ---------- Actions ---------- */}
      <div className="mt-2 grid grid-cols-1 gap-2">
        {next === "report" ? (
          <Button variant="primary" full onClick={onOpenResult} icon={<IconChevron size={16} />}>
            View triage report
          </Button>
        ) : null}
        <Button
          full
          variant={next === "locate" ? "primary" : "secondary"}
          icon={<IconBell size={17} />}
          busy={busy === "locate"}
          onClick={onLocate}
          disabled={!status.radio_online}
        >
          Locate · beep tag
        </Button>
        <Button
          full
          variant={next === "dispatch" ? "primary" : "secondary"}
          icon={<IconRover size={17} />}
          busy={busy === "dispatch"}
          onClick={onDispatch}
        >
          Dispatch rover
        </Button>
        <Button
          full
          variant={next === "scan" ? "primary" : "secondary"}
          icon={<IconCamera size={17} />}
          busy={busy === "scan" || status.analyzing || waitingForCam}
          onClick={onScan}
        >
          {status.analyzing ? "Analyzing" : waitingForCam ? "Waiting for camera" : "Scan wound"}
        </Button>
        <Button full variant="quiet" icon={<IconReset size={16} />} busy={busy === "reset"} onClick={onReset}>
          Reset
        </Button>
      </div>

      {!status.radio_online && (
        <p className="mt-3 text-[12px] leading-snug text-faint">
          Plug the Base tag into this laptop to locate tags over LoRa.
        </p>
      )}

      {/* ---------- Alert log ---------- */}
      {status.alert_log.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-[12px] font-medium text-faint">Recent alerts</div>
          <ul className="mt-2 space-y-1.5">
            {status.alert_log.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-[12.5px] tnum">
                <span className="text-ink/90">{a.name} · abnormal behavior</span>
                <span className="text-faint">
                  {formatTime(a.time)} · {a.source === "lora" ? "LoRa" : "Manual"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StateLine({ icon, title, sub, progress }: { icon: React.ReactNode; title: string; sub: string; progress?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={enter}
      className="rounded-[12px] bg-fill px-3.5 py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-link">{icon}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">{title}</div>
          <div className="truncate text-[12px] text-mute">{sub}</div>
        </div>
      </div>
      {progress && (
        <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-1/3 rounded-full bg-link"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          />
        </div>
      )}
    </motion.div>
  );
}
