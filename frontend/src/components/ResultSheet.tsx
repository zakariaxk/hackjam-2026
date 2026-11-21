import { motion } from "framer-motion";
import { useState } from "react";
import type { TriageResult } from "../types";
import { copyText } from "../api";
import { Button, spring } from "./ui";
import { IconCheck, IconClose, IconCopy } from "./Icons";

const RISK = {
  HIGH: { color: "#ff453a", bg: "rgba(255,69,58,0.14)", label: "High risk" },
  MEDIUM: { color: "#ff9f0a", bg: "rgba(255,159,10,0.14)", label: "Medium risk" },
  LOW: { color: "#30d158", bg: "rgba(48,209,88,0.14)", label: "Low risk" },
} as const;

export default function ResultSheet({
  result,
  imageVersion,
  onClose,
}: {
  result: TriageResult;
  imageVersion: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const risk = result.parsed && result.risk ? RISK[result.risk] : null;

  const copy = async () => {
    const ok = await copyText(result.fdacs_report || result.raw);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 md:items-center md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-label="Triage result"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        transition={spring}
        className="glass-strong relative max-h-[92dvh] w-full overflow-y-auto rounded-t-sheet md:max-w-[920px] md:rounded-sheet"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-ink backdrop-blur-md hover:bg-black/70"
        >
          <IconClose size={18} />
        </button>

        <div className="grid md:grid-cols-[1fr_1.1fr]">
          {/* Photo */}
          <div className="relative bg-black md:min-h-[520px]">
            <img
              src={`/api/last.jpg?v=${imageVersion}`}
              alt="Rover camera capture of Cow1"
              className="h-[38dvh] w-full object-cover md:absolute md:inset-0 md:h-full"
            />
            <div className="absolute bottom-3 left-3 rounded-pill bg-black/60 px-3 py-1 text-[11px] text-white/80 backdrop-blur-md">
              Rover camera · Cow1
            </div>
          </div>

          {/* Details */}
          <div className="p-6 md:p-8">
            <div className="eyebrow">Screwworm triage</div>

            {risk ? (
              <div className="mt-3 flex items-end gap-4">
                <div
                  className="rounded-[16px] px-4 py-2.5 text-[34px] font-semibold leading-none tracking-[-0.01em]"
                  style={{ color: risk.color, background: risk.bg }}
                >
                  {result.risk}
                </div>
                <div className="pb-1">
                  <div className="text-[15px] font-semibold" style={{ color: risk.color }}>
                    {risk.label}
                  </div>
                  <div className="text-[13px] text-mute tnum">{result.confidence}% confidence</div>
                </div>
              </div>
            ) : (
              <h3 className="mt-3 text-[24px] font-semibold">Unstructured response</h3>
            )}

            {risk && (
              <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: risk.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${result.confidence ?? 0}%` }}
                  transition={{ ...spring, delay: 0.15 }}
                />
              </div>
            )}

            {result.parsed ? (
              <dl className="mt-6 space-y-5">
                <Field label="Findings">{result.findings}</Field>
                <Field label="Recommended action">{result.recommended_action}</Field>
              </dl>
            ) : (
              <pre className="mt-4 whitespace-pre-wrap rounded-[12px] bg-fill p-4 text-[12.5px] text-mute">{result.raw}</pre>
            )}

            {result.parsed && result.fdacs_report && (
              <div className="mt-6 rounded-[16px] bg-fill p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">Draft report to FDACS</div>
                    <div className="text-[11.5px] text-faint">Division of Animal Industry · for veterinarian review</div>
                  </div>
                  <Button
                    variant="secondary"
                    className="!min-h-9 !px-3.5 !text-[13px]"
                    onClick={copy}
                    icon={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="mt-3 text-[14px] leading-[1.5] text-ink/90">{result.fdacs_report}</p>
              </div>
            )}

            <p className="mt-6 text-[11.5px] leading-snug text-faint">
              Triage only, never a diagnosis. A veterinarian must confirm any suspected New World screwworm case.
              {result.model ? ` Analyzed by ${result.model}.` : ""}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-faint">{label}</dt>
      <dd className="mt-1 text-[15px] leading-[1.47] text-ink">{children}</dd>
    </div>
  );
}
