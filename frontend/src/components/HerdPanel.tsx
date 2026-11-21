import type { Alert, LiveNode, RanchConfig, SimCow } from "../types";
import { ago } from "../api";
import { Dot } from "./ui";

interface Props {
  config: RanchConfig;
  nodes: LiveNode[];
  alert: Alert | null;
  herd: SimCow[];
  showSim: boolean;
  radioOnline: boolean;
  now: number;
}

export default function HerdPanel({ config, nodes, alert, herd, showSim, radioOnline, now }: Props) {
  const flagged = herd.filter((c) => c.flagged);
  return (
    <div className="p-5">
      <div className="eyebrow">{config.name}</div>
      <h2 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[0.004em]">Herd</h2>
      <p className="mt-1 text-[13px] text-mute">
        {config.acres} acres · {config.county}
      </p>

      <div className="mt-5 text-[12px] font-medium text-faint">Live tags</div>
      <ul className="mt-2 space-y-1.5">
        {nodes.map((n) => {
          const isAlert = n.role === "cow" && !!alert;
          const heard = n.last_heard !== null;
          return (
            <li key={n.role} className="rounded-[12px] bg-fill px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Dot color={isAlert ? "#ff453a" : n.role === "cow" ? "#2997ff" : "#ffffff"} pulse={radioOnline} />
                  <span className="text-[15px] font-semibold">{n.name}</span>
                </div>
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.04em] ${
                    isAlert ? "bg-alert/15 text-alert" : "bg-white/10 text-white/75"
                  }`}
                >
                  {isAlert ? "ALERT" : "LIVE · LoRa"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-[18px] text-[12px] text-mute tnum">
                <span>{heard ? ago(n.last_heard, now) : radioOnline ? "Waiting for first packet" : "Radio offline"}</span>
                {n.battery !== null && <span>{n.battery > 100 ? "Charging" : `${n.battery}%`}</span>}
                {n.id && <span className="text-faint">{n.id}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center justify-between text-[12px] font-medium text-faint">
        <span>Simulated herd</span>
        <span>{showSim ? "Shown" : "Hidden"}</span>
      </div>
      <div className="mt-2 rounded-[12px] border border-dashed border-white/15 px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold tnum">{herd.length} cows</span>
          <span className="text-[12px] text-mute">Simulated</span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-faint">
          Grazing model for herd scale. Not real animals or radios.
        </p>
        {flagged.length > 0 && (
          <ul className="mt-2.5 space-y-1 border-t border-line pt-2.5">
            {flagged.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2">
                  <Dot color="#ff9f0a" />
                  {c.name}
                </span>
                <span className="text-faint">Flagged · simulated</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] text-mute">
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-link" />} label="Live tag" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-alert" />} label="Alert" />
        <Legend swatch={<span className="h-1.5 w-1.5 rounded-full bg-[#e8e8ed]/75" />} label="Simulated" />
        <Legend swatch={<span className="h-1.5 w-1.5 rounded-full bg-warn" />} label="Flagged (sim)" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-white bg-[#1d1d1f]" />} label="Barn Station" />
        <Legend swatch={<span className="h-px w-3 border-t border-dashed border-white" />} label="Rover route" />
      </div>
      <p className="mt-4 text-[11px] leading-snug text-faint">
        Tag positions are fixed for indoor demo use. GPS doesn't work indoors.
      </p>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid w-3 place-items-center">{swatch}</span>
      {label}
    </div>
  );
}
