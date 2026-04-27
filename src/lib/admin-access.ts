import { useCallback, useEffect, useState } from "react";

const ADMIN_ACCESS_CODE = "8096";
const ADMIN_ACCESS_KEY = "grit_admin_access";
const ADMIN_ACCESS_EVENT = "grit-admin-access-change";

function emitAdminAccessChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_ACCESS_EVENT));
}

export function hasAdminAccess(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(ADMIN_ACCESS_KEY) === "granted";
}

export function submitAdminAccessCode(code: string): boolean {
  const isValid = code.trim() === ADMIN_ACCESS_CODE;
  if (!isValid || typeof window === "undefined") return isValid;
  sessionStorage.setItem(ADMIN_ACCESS_KEY, "granted");
  emitAdminAccessChange();
  return true;
}

export function clearAdminAccess() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_ACCESS_KEY);
  emitAdminAccessChange();
}

export function useAdminAccess() {
  const [hasAccess, setHasAccess] = useState(() => hasAdminAccess());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const sync = () => setHasAccess(hasAdminAccess());
    window.addEventListener(ADMIN_ACCESS_EVENT, sync);
    window.addEventListener("focus", sync);

    return () => {
      window.removeEventListener(ADMIN_ACCESS_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const unlock = useCallback((code: string) => {
    const isValid = submitAdminAccessCode(code);
    setHasAccess(hasAdminAccess());
    return isValid;
  }, []);

  const lock = useCallback(() => {
    clearAdminAccess();
    setHasAccess(false);
  }, []);

  return { hasAccess, unlock, lock };
}
