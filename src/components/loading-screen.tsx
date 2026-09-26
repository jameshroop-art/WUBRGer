import { useEffect, useState } from "react";
import { LOADING_SLIDES, pickSlide, type LoadingSlide } from "@/lib/loading-rulings";

const SESSION_KEY = "wubrger.splash.seen";

export function LoadingScreen({
  force,
  onDone,
}: {
  force?: boolean;
  onDone: () => void;
}) {
  const [slide, setSlide] = useState<LoadingSlide>(() => pickSlide());

  useEffect(() => {
    if (force) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") onDone();
    } catch {
      /* ignore */
    }
  }, [force, onDone]);

  useEffect(() => {
    const t = window.setTimeout(() => dismiss(), 9000);
    return () => window.clearTimeout(t);
  }, [slide.id]);

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
      <div className="relative min-h-0 flex-1">
        <img src={slide.art} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
        <img
          src="/icons/app-icon.png"
          alt=""
          className="absolute top-4 left-4 size-12 rounded-md ring-1 ring-border"
        />
      </div>
      <div className="shrink-0 space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Obscure EDH · {slide.cite}</p>
        <h1 className="font-display text-[26px] leading-tight tracking-tight">{slide.title}</h1>
        <p className="text-sm leading-relaxed text-muted">{slide.rule}</p>
        <p className="text-xs text-faint">{slide.cards.join(" · ")}</p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="h-11 flex-1 rounded-md bg-accent text-sm font-medium text-accent-fg"
            onClick={dismiss}
          >
            Open binder
          </button>
          <button
            type="button"
            className="h-11 rounded-md bg-raised px-4 text-sm ring-1 ring-border"
            onClick={() => setSlide(pickSlide(slide.id))}
          >
            Next ruling
          </button>
        </div>
        <p className="text-center text-[11px] text-faint">
          {LOADING_SLIDES.findIndex((s) => s.id === slide.id) + 1} / {LOADING_SLIDES.length}
        </p>
      </div>
    </div>
  );
}
