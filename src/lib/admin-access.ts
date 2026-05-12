import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_CODE = "8096";
const KEY = "diagnostic_admin_session";
const EVENT = "diagnostic-admin-access-change";

export interface AdminSession {
  role: "super" | "campus";
  campusId: string | null;
  campusName: string | null;
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAdminSession() {
  sessionStorage.removeItem(KEY);
  emit();
}

export async function tryAdminAccess(code: string): Promise<AdminSession | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (trimmed === SUPER_ADMIN_CODE) {
    const s: AdminSession = { role: "super", campusId: null, campusName: null };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    emit();
    return s;
  }
  // Look up campus admin code
  const { data, error } = await supabase
    .from("campuses")
    .select("id,name,admin_access_code")
    .eq("admin_access_code", trimmed)
    .maybeSingle();
  if (error || !data) return null;
  const s: AdminSession = { role: "campus", campusId: data.id, campusName: data.name };
  sessionStorage.setItem(KEY, JSON.stringify(s));
  emit();
  return s;
}

export function useAdminAccess() {
  const [session, setSession] = useState<AdminSession | null>(() => getAdminSession());

  useEffect(() => {
    const sync = () => setSession(getAdminSession());
    window.addEventListener(EVENT, sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("focus", sync); };
  }, []);

  const unlock = useCallback(async (code: string) => {
    const s = await tryAdminAccess(code);
    setSession(s);
    return !!s;
  }, []);

  const lock = useCallback(() => { clearAdminSession(); setSession(null); }, []);

  return { session, hasAccess: !!session, isSuper: session?.role === "super", unlock, lock };
}
