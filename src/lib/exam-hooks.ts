import { useEffect, useRef, useState } from "react";

// ---------- Fullscreen ----------

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

/**
 * Requests browser fullscreen. Must be called from a user gesture
 * (e.g. a button click) — browsers reject programmatic requests otherwise.
 */
export async function enterFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    /* Browser/policy blocked the request — exam continues windowed. */
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

/** Fires `onExit` when the user leaves browser fullscreen while the exam is active. */
export function useFullscreenGuard(active: boolean, onExit: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = () => { if (!document.fullscreenElement) onExit(); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [active, onExit]);
}

/**
 * Fires `onHidden` when the user leaves the exam — tab switch / minimise
 * (`visibilitychange`) or alt-tab to another window (`blur`). The blur path is
 * confirmed on the next tick with `document.hasFocus()` so a transient blur
 * (e.g. a fullscreen transition) is not counted as a false positive. The
 * caller is expected to de-duplicate, since one incident can fire both events.
 */
export function useTabSwitchGuard(active: boolean, onHidden: () => void) {
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => { if (document.hidden) onHidden(); };
    const onBlur = () => {
      window.setTimeout(() => { if (!document.hasFocus()) onHidden(); }, 150);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, onHidden]);
}

// ---------- Elapsed timer ----------

/** Count-up elapsed seconds since `startTime`, ticking once per second while `running`. */
export function useElapsed(startTime: number | null, running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running || !startTime) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startTime, running]);
  return elapsed;
}

export function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Countdown from `durationSec`, derived from the wall-clock `startTime` so it
 * stays accurate even if the tab was backgrounded. Calls `onExpire` exactly
 * once when it reaches 0. With `durationSec <= 0` the exam is untimed.
 */
export function useCountdown(
  startTime: number | null,
  durationSec: number,
  running: boolean,
  onExpire: () => void,
): number {
  const [remaining, setRemaining] = useState(durationSec);
  const fired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!running || !startTime || durationSec <= 0) return;
    fired.current = false;
    const tick = () => {
      const left = Math.max(0, durationSec - Math.floor((Date.now() - startTime) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startTime, durationSec, running]);

  return remaining;
}
