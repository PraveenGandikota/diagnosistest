import { useEffect, useState, type ReactNode } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { useAdminAccess } from "@/lib/admin-access";

export const AdminAccessGate = ({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode | ((controls: { lock: () => void }) => ReactNode);
}) => {
  const { hasAccess, unlock, lock } = useAdminAccess();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (hasAccess) { setCode(""); setError(""); } }, [hasAccess]);

  const handleUnlock = async () => {
    if (!code.trim()) { setError("Enter an access code to continue."); return; }
    setBusy(true);
    setError("");
    const ok = await unlock(code);
    setBusy(false);
    if (!ok) setError("That access code is not correct.");
  };

  if (hasAccess) return <>{typeof children === "function" ? children({ lock }) : children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Restricted area</div>
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          </div>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">{description}</p>

        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="admin-code">
          Access code
        </label>
        <div className="relative mb-3">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="admin-code"
            type="password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
            placeholder="Enter access code"
            aria-invalid={!!error}
            className="w-full rounded-md border border-border bg-card py-2.5 pl-9 pr-3 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {error && <p className="mb-3 text-xs text-destructive" role="alert">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Enter dashboard"}
        </button>

        <div className="mt-5 rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Super admins use the master code. Campus admins use the code provided for their campus.
        </div>
      </div>
    </div>
  );
};
