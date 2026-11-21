import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Dot, spring } from "./ui";
import { IconCamera, IconClose } from "./Icons";

/** "Rover camera · Connected / Not connected" row, with a QR sheet to connect the phone. */
export default function CameraConnect({ online }: { online: boolean }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const camUrl = `${window.location.origin}/cam`;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  useEffect(() => {
    if (!open || qr) return;
    QRCode.toDataURL(camUrl, { margin: 1, width: 440, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, qr, camUrl]);

  // Close the sheet automatically once the phone connects.
  useEffect(() => {
    if (online) setOpen(false);
  }, [online]);

  return (
    <>
      <div className="mt-3 flex items-center justify-between rounded-[12px] bg-fill px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <IconCamera size={17} className="text-mute" />
          <div>
            <div className="text-[13.5px] font-semibold">Rover camera</div>
            <div className="flex items-center gap-1.5 text-[12px] text-mute">
              <Dot color={online ? "#30d158" : "#86868b"} pulse={online} />
              {online ? "Connected · ready to scan" : "Not connected"}
            </div>
          </div>
        </div>
        {!online && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-9 rounded-pill bg-accent px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Connect
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={spring}
              className="glass-strong relative w-full max-w-[400px] rounded-sheet p-7 text-center"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-fill text-mute hover:text-ink"
              >
                <IconClose size={16} />
              </button>
              <div className="eyebrow">Rover camera</div>
              <h3 className="mt-2 text-[24px] font-semibold leading-tight">Connect the rover phone.</h3>
              <p className="mt-2 text-[14px] leading-[1.47] text-mute">
                Scan with the iPhone on the rover, tap <span className="text-ink">Start camera</span>, and allow access.
                Keep that page open. Scan wound then takes the photo by itself.
              </p>
              {isLocal ? (
                <p className="mt-5 rounded-[14px] bg-fill p-4 text-[13px] leading-snug text-warn">
                  This dashboard is open on localhost, which a phone can't reach. Open the https://…trycloudflare.com
                  link instead, then press Connect again.
                </p>
              ) : (
                <div className="mx-auto mt-5 w-[220px] rounded-[18px] bg-white p-3">
                  {qr ? <img src={qr} alt={`QR code for ${camUrl}`} className="h-full w-full" /> : <div className="aspect-square" />}
                </div>
              )}
              <div className="mt-4 break-all text-[12.5px] text-faint tnum">{camUrl}</div>
              <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-mute">
                <Dot color="#86868b" />
                Waiting for the phone…
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
