type AndroidBinder = {
  read: () => string;
  write: (value: string) => void;
  remove: () => void;
  hasCamera?: () => boolean;
  requestCamera?: () => void;
  hasPhotos?: () => boolean;
  requestPhotos?: () => void;
  pickPhoto?: () => void;
  saveCardImage?: (title: string, dataUrl: string) => string;
};

type SyncStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

function androidBridge(): AndroidBinder | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as Window & { WubrgerBinder?: AndroidBinder }).WubrgerBinder;
  if (!bridge || typeof bridge.read !== "function") return null;
  return bridge;
}

/** Room analog: Android filesDir first, localStorage mirror. */
export function binderStorage(): SyncStorage {
  return {
    getItem(name) {
      const bridge = androidBridge();
      if (bridge) {
        try {
          const raw = bridge.read();
          if (raw) return raw;
        } catch {
          /* fall through */
        }
      }
      try {
        return globalThis.localStorage?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const bridge = androidBridge();
      if (bridge) {
        try {
          bridge.write(value);
        } catch {
          /* still mirror */
        }
      }
      try {
        globalThis.localStorage?.setItem(name, value);
      } catch {
        /* quota */
      }
    },
    removeItem(name) {
      const bridge = androidBridge();
      if (bridge) {
        try {
          bridge.remove();
        } catch {
          /* ignore */
        }
      }
      try {
        globalThis.localStorage?.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export function isAndroidPackaged() {
  return androidBridge() != null;
}

export function requestNativeCamera(): Promise<boolean> {
  const bridge = androidBridge();
  if (!bridge?.requestCamera) return Promise.resolve(true);
  try {
    if (bridge.hasCamera?.()) return Promise.resolve(true);
  } catch {
    /* ask */
  }
  return new Promise((resolve) => {
    const w = window as Window & { __wubrgerCam?: (ok: boolean) => void };
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      resolve(Boolean(ok));
    };
    const timer = window.setTimeout(() => finish(bridge.hasCamera?.() ?? false), 20000);
    const poll = window.setInterval(() => {
      try {
        if (bridge.hasCamera?.()) finish(true);
      } catch {
        /* ignore */
      }
    }, 280);
    w.__wubrgerCam = (ok) => finish(Boolean(ok));
    try {
      bridge.requestCamera?.();
    } catch {
      finish(bridge.hasCamera?.() ?? false);
    }
  });
}

export async function openCameraStream(): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) throw new Error("No mediaDevices");
  const granted = await requestNativeCamera();
  if (!granted) {
    const bridge = androidBridge();
    if (bridge && !bridge.hasCamera?.()) {
      const err = new Error("Camera permission denied");
      err.name = "NotAllowedError";
      throw err;
    }
  }
  const tries: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    },
    { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } } },
    { audio: false, video: { facingMode: "environment" } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const spec of tries) {
    try {
      const stream = await md.getUserMedia(spec);
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          });
        } catch {
          try {
            await track.applyConstraints({ focusMode: "continuous" } as MediaTrackConstraints);
          } catch {
            /* device has no AF hook */
          }
        }
      }
      return stream;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Camera blocked");
}

export function requestNativePhotos(): Promise<boolean> {
  const bridge = androidBridge();
  if (!bridge?.requestPhotos) return Promise.resolve(true);
  try {
    if (bridge.hasPhotos?.()) return Promise.resolve(true);
  } catch {
    /* ask */
  }
  return new Promise((resolve) => {
    const w = window as Window & { __wubrgerPhotos?: (ok: boolean) => void };
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      resolve(Boolean(ok));
    };
    const timer = window.setTimeout(() => finish(bridge.hasPhotos?.() ?? false), 20000);
    const poll = window.setInterval(() => {
      try {
        if (bridge.hasPhotos?.()) finish(true);
      } catch {
        /* ignore */
      }
    }, 280);
    w.__wubrgerPhotos = (ok) => finish(Boolean(ok));
    try {
      bridge.requestPhotos?.();
    } catch {
      finish(bridge.hasPhotos?.() ?? false);
    }
  });
}

export function persistCardImage(title: string, dataUrl: string): string {
  const bridge = androidBridge();
  if (bridge?.saveCardImage) {
    try {
      const path = bridge.saveCardImage(title, dataUrl);
      if (path) return path;
    } catch {
      /* fall through */
    }
  }
  return "";
}

export function pickDevicePhoto(): Promise<string> {
  const bridge = androidBridge();
  if (bridge?.pickPhoto) {
    return new Promise((resolve) => {
      const w = window as Window & { __wubrgerPhoto?: (url: string) => void };
      const timer = window.setTimeout(() => resolve(""), 60000);
      w.__wubrgerPhoto = (url) => {
        window.clearTimeout(timer);
        resolve(url || "");
      };
      try {
        bridge.pickPhoto?.();
      } catch {
        window.clearTimeout(timer);
        resolve("");
      }
    });
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
