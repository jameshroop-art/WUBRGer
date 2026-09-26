import { useEffect, useRef, useState } from "react";
import { printingById, searchPrintings } from "@/lib/catalog";
import { useBinder } from "@/lib/binder-store";
import { openCameraStream, pickDevicePhoto, requestNativePhotos } from "@/lib/device-storage";
import { resetCardPrior, type CardRect } from "@/lib/scan/edges";
import { saveScanPhoto, scanPhotoFor } from "@/lib/scan/photos";
import { recognizeStillDataUrl, recognizeVideoFrame, resetScanIterate } from "@/lib/scan/recognize";
import { ensureCollectorVision } from "@/lib/scan/collector-vision";
import type { ScanHit } from "@/lib/scan/resolve";
import { haptic } from "@/lib/utils";
import { CardArt } from "@/components/card-tile";
import type { Finish } from "@/lib/types";

export function LensView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastId = useRef<string | null>(null);
  const opening = useRef(false);
  const live = useRef(true);
  const cameraOn = useBinder((s) => s.cameraOn);
  const setCamera = useBinder((s) => s.setCamera);
  const confirm = useBinder((s) => s.confirmScan);
  const addFromSearch = useBinder((s) => s.addFromSearch);
  const sessions = useBinder((s) => s.sessions);
  const chooser = useBinder((s) => s.chooser);
  const closeChooser = useBinder((s) => s.closeChooser);
  const openSheet = useBinder((s) => s.openSheet);
  const [q, setQ] = useState("");
  const [foil, setFoil] = useState<Finish>("nonfoil");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("Starting sensor…");
  const [hit, setHit] = useState<ScanHit | null>(null);
  const [rect, setRect] = useState<CardRect | null>(null);
  const [tray, setTray] = useState(false);
  const hits = searchPrintings(q, 12);
  const chips = sessions[0]?.chips ?? [];

  useEffect(() => {
    live.current = true;
    void ensureCollectorVision((p) => {
      const pct = p.ratio != null ? ` ${Math.round(p.ratio * 100)}%` : "";
      setStatus(`CollectorVision ${p.stage}${pct}`);
    }).catch(() => setStatus("CollectorVision pack loading…"));
    void requestNativePhotos();
    void startUntilReady();
    const onCam = (ok: boolean) => {
      if (ok) void startUntilReady();
    };
    const w = window as Window & { __wubrgerCam?: (ok: boolean) => void };
    const prev = w.__wubrgerCam;
    w.__wubrgerCam = (ok) => {
      prev?.(ok);
      onCam(ok);
    };
    const vis = () => {
      if (document.visibilityState === "visible") void startUntilReady();
    };
    document.addEventListener("visibilitychange", vis);
    const kick = window.setInterval(() => {
      if (live.current && !streamRef.current?.active) void startUntilReady();
    }, 1500);
    return () => {
      live.current = false;
      window.clearInterval(kick);
      document.removeEventListener("visibilitychange", vis);
      stopTracks();
      resetCardPrior();
      resetScanIterate();
      useBinder.getState().setCamera(false);
    };
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    let stop = false;
    let running = false;
    const loop = async () => {
      while (!stop) {
        if (!running) {
          running = true;
          try {
            await tick();
          } catch (e) {
            const msg = e instanceof Error ? e.message : "scan";
            setStatus(`Vision retry (${msg})`);
          } finally {
            running = false;
          }
        }
        await new Promise((r) => window.setTimeout(r, 320));
      }
    };
    void loop();
    return () => {
      stop = true;
    };
  }, [cameraOn]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }

  async function attach(stream: MediaStream) {
    const v = videoRef.current;
    if (!v) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("No video node");
    }
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.autoplay = true;
    try {
      await v.play();
    } catch {
      await new Promise<void>((resolve) => {
        v.onloadedmetadata = () => {
          void v.play().finally(() => resolve());
        };
        window.setTimeout(() => resolve(), 800);
      });
    }
    streamRef.current = stream;
  }

  async function startUntilReady() {
    if (!live.current) return;
    if (streamRef.current?.active) {
      setCamera(true, false);
      setBusy(false);
      return;
    }
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setErr(null);
    try {
      stopTracks();
      const stream = await openCameraStream();
      if (!live.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      await attach(stream);
      setCamera(true, false);
      setStatus("Point at a card. CollectorVision captures the printing.");
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError") setErr("Waiting for camera permission…");
      else if (name === "NotFoundError") setErr("No camera found.");
      else setErr("Opening camera…");
      setCamera(false, name === "NotAllowedError");
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }

  async function tick() {
    const v = videoRef.current;
    if (!v || !streamRef.current?.active) return;
    if (v.readyState < 2) {
      setStatus("Focusing…");
      return;
    }
    const { title, hit: next, rect: box, locked, photo } = await recognizeVideoFrame(v);
    setRect(box);
    if (!next) {
      setHit(null);
      setStatus(
        title
          ? `Match “${title}” — holding for lock…`
          : box
            ? "Card in frame. Identifying printing…"
            : "Hold a card in frame…",
      );
      return;
    }
    setHit(next);
    setFoil(next.foil);
    setStatus(`Snap · ${next.printing.name}`);
    if (locked && next.printing.id !== lastId.current) {
      if (photo) saveScanPhoto(next.printing.name, next.printing.id, photo);
      lastId.current = next.printing.id;
      haptic();
      confirm(next.printing.id, next.foil, Math.max(next.confidence, 0.88), photo);
    }
  }

  async function processGalleryPhoto() {
    setStatus("Opening photos…");
    const url = await pickDevicePhoto();
    if (!url) {
      setStatus("No photo selected.");
      return;
    }
    setStatus("Identifying printing from photo…");
    try {
      const { title, hit: next, locked, photo } = await recognizeStillDataUrl(url);
      if (!next) {
        setStatus(title ? `Saw “${title}”` : "Could not match that photo.");
        return;
      }
      setHit(next);
      setFoil(next.foil);
      setStatus(`Photo · ${next.printing.name}`);
      if (locked) {
        if (photo) saveScanPhoto(next.printing.name, next.printing.id, photo);
        lastId.current = next.printing.id;
        haptic();
        confirm(next.printing.id, next.foil, Math.max(next.confidence, 0.88), photo);
      }
    } catch {
      setStatus("Could not process that photo.");
    }
  }

  return (
    <div className="relative min-h-0 flex-1 bg-bg">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-sm ring-2 ring-accent"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          }}
        >
          <span className="absolute -top-5 left-0 text-[10px] tracking-wide text-accent">CARD</span>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-[12%] inset-y-[8%] rounded-sm ring-1 ring-white/25" />
      )}

      {!cameraOn ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/80 px-6 text-center">
          <p className="text-sm text-muted">{busy ? "Opening the back camera…" : err ?? "Starting sensor…"}</p>
          <p className="text-xs text-faint">Allow camera and photos if asked. CollectorVision identifies the printing — no tap.</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        <p className="pointer-events-auto text-sm text-fg">{status}</p>
        {hit ? (
          <div className="pointer-events-auto mt-2 flex items-center gap-3">
            <div className="w-10 shrink-0">
              <CardArt
                src={scanPhotoFor(hit.printing.id, hit.printing.name) ?? hit.printing.image_small}
                name={hit.printing.name}
                foil={foil !== "nonfoil"}
              />
            </div>
            <p className="min-w-0 flex-1 truncate text-sm">{hit.printing.name}</p>
          </div>
        ) : null}
        <div className="pointer-events-auto mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-11 rounded-md bg-surface/90 text-sm ring-1 ring-border"
            onClick={() => void processGalleryPhoto()}
          >
            From photos
          </button>
          <button
            type="button"
            className="h-11 rounded-md bg-surface/90 text-sm ring-1 ring-border"
            onClick={() => setTray(true)}
          >
            Session
          </button>
        </div>
      </div>

      {tray ? (
        <div className="absolute inset-0 z-20">
          <button type="button" className="absolute inset-0 bg-bg/50" aria-label="Close tray" onClick={() => setTray(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-xl bg-surface p-4 ring-1 ring-border">
            <div className="flex items-center justify-between">
              <p className="font-display text-xl">Session</p>
              <button type="button" className="text-sm text-muted" onClick={() => setTray(false)}>
                Close
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {chips.length === 0 ? <p className="text-sm text-muted">No captures yet.</p> : null}
              {chips.map((c) => {
                const p = printingById(c.scryfall_id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="w-20 shrink-0"
                    onClick={() => openSheet({ kind: "printing", id: c.scryfall_id })}
                  >
                    <CardArt
                      src={c.photo ?? scanPhotoFor(c.scryfall_id, p?.name) ?? p?.image_small}
                      name={p?.name ?? ""}
                      foil={c.foil !== "nonfoil"}
                    />
                    <p className="mt-1 truncate text-[11px]">{p?.name}</p>
                  </button>
                );
              })}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name search still commits"
              className="mt-4 h-11 w-full rounded-md bg-raised px-3 text-sm outline-none ring-1 ring-border placeholder:text-faint"
            />
            {q ? (
              <ul className="mt-2 max-h-40 overflow-y-auto">
                {hits.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 py-2 text-left text-sm"
                      onClick={() => {
                        addFromSearch(p.id, foil);
                        setQ("");
                        haptic();
                      }}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-faint">{p.set.toUpperCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {chooser ? (
        <div className="absolute inset-0 z-30 flex items-end bg-bg/70">
          <div className="w-full rounded-t-xl bg-surface p-4 ring-1 ring-border">
            <h2 className="font-display text-xl">Which printing?</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {chooser.candidates.map((id) => {
                const p = printingById(id);
                if (!p) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      confirm(id, foil, 0.99);
                      closeChooser();
                    }}
                  >
                    <CardArt src={p.image_small} name={p.name} />
                    <p className="mt-1 text-[11px]">
                      {p.set.toUpperCase()} {p.collector_number}
                    </p>
                  </button>
                );
              })}
            </div>
            <button type="button" className="mt-3 text-sm text-muted" onClick={closeChooser}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
