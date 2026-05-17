import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, Layers, TrendingUp, UserRound } from "lucide-react";
import { useStudentSession } from "@/lib/student-session";
import { fetchSubmissions, type DBSubmission } from "@/lib/quiz-db";
import { StatCard } from "@/components/dashboard/StatCard";
import { LoadingState } from "@/components/dashboard/LoadingState";

const Profile = () => {
  const { session } = useStudentSession();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    let cancelled = false;
    setLoading(true);
    fetchSubmissions({ studentUuid: session.student.id }).then((s) => {
      if (cancelled) return;
      setSubs(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [session, navigate]);

  if (!session) return null;

  const { student, campus } = session;
  const dash = (v: string | null | undefined) => (v && v.trim() ? v : "-");

  const totalAttempts = subs.length;
  const avgScore = totalAttempts ? Math.round(subs.reduce((a, s) => a + s.scorePct, 0) / totalAttempts) : 0;
  const skillsAttempted = new Set(subs.map((s) => s.skillId).filter(Boolean)).size;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>

        {/* Identity card */}
        <div className="panel p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{dash(student.name)}</h1>
              <span className="mt-1 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                Student
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Student ID" value={dash(student.student_id)} />
            <Field label="Campus" value={dash(campus.name)} />
            <Field label="Email" value={dash(student.email)} />
            <Field label="Campus code" value={dash(campus.code)} />
          </div>
        </div>

        {/* Performance summary */}
        {loading ? (
          <div className="panel p-6"><LoadingState lines={3} label="Loading your performance…" /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={ClipboardList} label="Total attempts" value={totalAttempts} />
            <StatCard
              icon={TrendingUp}
              label="Average score"
              value={`${avgScore}%`}
              tone={totalAttempts === 0 ? "default" : avgScore >= 60 ? "success" : "warning"}
            />
            <StatCard icon={Layers} label="Skills attempted" value={skillsAttempted} />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This is a read-only profile. Contact your campus admin to update your details.
        </p>
      </div>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-card p-3">
    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
  </div>
);

export default Profile;
