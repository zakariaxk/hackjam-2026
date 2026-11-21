import { motion } from "framer-motion";
import { useState } from "react";
import type { TriageResult } from "../types";
import { copyText, formatTime } from "../api";
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
  scannedAt,
  onClose,
}: {
  result: TriageResult;
  imageVersion: number;
  scannedAt: number | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const risk = result.parsed && result.risk ? RISK[result.risk] : null;
  const report = result.parsed && result.fdacs_report;
  const photoUrl = `/api/last.jpg?v=${imageVersion}`;

  const copy = async () => {
    if (!report) return;
    const ok = await copyText(report);
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
        aria-labelledby="triage-title"
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
          <figure className="relative flex flex-col justify-center bg-black md:min-h-[520px]">
            <img
              src={photoUrl}
              alt="Rover camera capture of Cow1"
              className="max-h-[38dvh] w-full object-contain md:max-h-[60dvh]"
            />
            <figcaption className="flex flex-wrap items-center justify-between gap-x-3 px-4 text-[12px] text-mute">
              <span className="tnum">Cow1 · Rover camera{scannedAt !== null && ` · ${formatTime(scannedAt)}`}</span>
              <a className="inline-flex min-h-11 items-center text-link" href={photoUrl} target="_blank" rel="noopener noreferrer">
                Open full photo
              </a>
            </figcaption>
          </figure>

          {/* Details */}
          <div className="p-6 md:p-8">
            <div className="eyebrow">{result.demo ? "Demo result · Not for clinical use" : "AI-assisted screwworm triage"}</div>
            <h2 id="triage-title" className="mt-2 text-[24px] font-semibold">Veterinary review required.</h2>
            <p className="mt-1 text-[14px] text-mute">A photo cannot confirm or rule out screwworm.</p>

            {risk ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div
                  className="rounded-pill px-3 py-1.5 text-[15px] font-semibold"
                  style={{ color: risk.color, background: risk.bg }}
                >
                  {risk.label}
                </div>
                <span className="text-[14px] text-mute tnum">
                  {result.demo ? "Example confidence" : "Model confidence"}: {result.confidence == null ? "Unavailable" : `${result.confidence}%`}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-[15px] font-semibold">No risk rating available.</p>
            )}

            {risk && result.confidence != null && (
              <p className="mt-2 text-[12px] text-mute">This score is not the probability that the animal has screwworm.</p>
            )}

            <dl className="mt-5 space-y-4">
              <Field label={result.demo ? "Example next step" : "Recommended next step"}>
                {risk && result.recommended_action ? result.recommended_action : "Share the photo with a veterinarian. If the image is unclear, take a clearer photo."}
              </Field>
              {result.findings && <Field label={result.demo ? "Example findings" : "AI observations"}>{result.findings}</Field>}
            </dl>

            {report && (
              <div className="mt-6 rounded-[16px] bg-fill p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">{result.demo ? "Example FDACS draft" : "Draft report to FDACS"}</div>
                    <div className="text-[12px] text-mute">For veterinarian review · Not submitted</div>
                  </div>
                  <Button
                    variant="secondary"
                    className="!px-3.5 !text-[13px]"
                    onClick={copy}
                    icon={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  >
                    {copied ? "Copied" : "Copy draft"}
                  </Button>
                </div>
                <p className="mt-3 text-[14px] leading-[1.5] text-ink/90">{report}</p>
              </div>
            )}

            {result.model && !result.demo && <p className="mt-5 text-[12px] text-mute">Model: {result.model}</p>}
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
