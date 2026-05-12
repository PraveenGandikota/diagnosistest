import { useCallback, useEffect, useState } from "react";
import type { Student, Campus } from "./quiz-db";

const KEY = "diagnostic_student_session";
const EVENT = "diagnostic-student-session-change";

export interface StudentSession {
  student: Student;
  campus: Campus;
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setStudentSession(s: StudentSession) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
  emit();
}

export function clearStudentSession() {
  sessionStorage.removeItem(KEY);
  emit();
}

export function useStudentSession() {
  const [session, setSession] = useState<StudentSession | null>(() => getStudentSession());

  useEffect(() => {
    const sync = () => setSession(getStudentSession());
    window.addEventListener(EVENT, sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("focus", sync); };
  }, []);

  const logout = useCallback(() => { clearStudentSession(); setSession(null); }, []);

  return { session, setSession: (s: StudentSession) => { setStudentSession(s); setSession(s); }, logout };
}
