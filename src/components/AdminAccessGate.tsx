import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAdminAccess } from "@/lib/admin-access";

interface AdminAccessGateProps {
  title: string;
  description: string;
  children: ReactNode | ((controls: { lock: () => void }) => ReactNode);
}

export const AdminAccessGate = ({ title, description, children }: AdminAccessGateProps) => {
  const { hasAccess, unlock, lock } = useAdminAccess();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleUnlock = () => {
    if (unlock(code)) {
      setCode("");
      setError("");
      return;
    }
    setError("That access code is not correct.");
  };

  if (hasAccess) {
    return <>{typeof children === "function" ? children({ lock }) : children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel w-full max-w-sm p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="mb-2 text-xl font-semibold">{title}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        <input
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleUnlock();
          }}
          placeholder="Enter access code"
          className="mb-3 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
        {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
        <button
          onClick={handleUnlock}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Enter dashboard
        </button>
      </div>
    </div>
  );
};
