import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3, BookOpen, Building2, ClipboardList, GraduationCap, History, KeyRound,
  LayoutDashboard, Lock, LogOut, Menu, Moon, Settings2, ShieldCheck, Sun, TrendingUp,
  Upload, UserRound, Users,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAdminAccess } from "@/lib/admin-access";
import { useStudentSession } from "@/lib/student-session";
import { useQuiz } from "@/lib/quiz-store";

type Theme = "light" | "dark";

interface NavItem { to: string; label: string; icon: LucideIcon; }
interface NavSectionDef { title: string; items: NavItem[]; }

const STUDENT_SECTIONS: NavSectionDef[] = [
  {
    title: "Learning",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/", label: "Available Skills", icon: BookOpen },
    ],
  },
  {
    title: "Review",
    items: [
      { to: "/history", label: "Attempt History", icon: History },
      { to: "/history", label: "My Performance", icon: TrendingUp },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: UserRound },
    ],
  },
];

const SUPER_ITEMS: NavItem[] = [
  { to: "/admin?tab=overview", label: "Overview", icon: BarChart3 },
  { to: "/admin?tab=students", label: "Students", icon: Users },
  { to: "/admin?tab=submissions", label: "Submissions", icon: ClipboardList },
  { to: "/admin?tab=uploads", label: "Uploads", icon: Upload },
  { to: "/admin?tab=campuses", label: "Campuses", icon: Building2 },
  { to: "/admin?tab=exams", label: "Skill Config", icon: Settings2 },
  { to: "/admin?tab=exam-codes", label: "Exam Codes", icon: KeyRound },
];

const CAMPUS_ITEMS: NavItem[] = [
  { to: "/admin?tab=overview", label: "Overview", icon: BarChart3 },
  { to: "/admin?tab=students", label: "Students", icon: Users },
  { to: "/admin?tab=submissions", label: "Submissions", icon: ClipboardList },
  { to: "/admin?tab=exam-codes", label: "Exam Codes", icon: KeyRound },
];

function isItemActive(item: NavItem, pathname: string, search: string): boolean {
  const [path, query] = item.to.split("?");
  if (path !== pathname) return false;
  if (!query) return true;
  const itemTab = new URLSearchParams(query).get("tab");
  const currentTab = new URLSearchParams(search).get("tab") || "overview";
  return itemTab === currentTab;
}

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  // An exam is "active" once it has started and before it is finalised.
  const examActive = useQuiz(
    (s) => s.session.startTime !== null && !s.session.finished && s.session.questions.length > 0,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // NOTE: nav chrome is toggled with conditional siblings — never an early
  // return with a different root — so `children` (e.g. the running Quiz) is
  // never unmounted when an exam starts/ends.
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sticky sidebar — hidden during an active exam */}
      {!examActive && (
        <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
          <NavContent theme={theme} onToggleTheme={toggleTheme} onNavigate={() => {}} />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile sticky top bar — hidden during an active exam */}
        {!examActive && (
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold">Diagnostic</span>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted/60"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>
        )}

        <main key={location.pathname} className="min-w-0 flex-1 anim-slide-in">{children}</main>
      </div>

      {/* Mobile drawer — hidden during an active exam */}
      {!examActive && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <NavContent theme={theme} onToggleTheme={toggleTheme} onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

const NavContent = ({
  theme, onToggleTheme, onNavigate,
}: { theme: Theme; onToggleTheme: () => void; onNavigate: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasAccess, isSuper, lock } = useAdminAccess();
  const { session: studentSession, logout } = useStudentSession();

  const roleLabel = hasAccess
    ? (isSuper ? "Super Admin" : "Campus Admin")
    : studentSession ? "Student" : "Guest";

  const handleSignOut = () => { logout(); onNavigate(); navigate("/"); };
  const handleLock = () => { lock(); onNavigate(); navigate("/admin"); };

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">Diagnostic</div>
          <div className="text-[11px] text-muted-foreground">Assessment Platform</div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
          <ShieldCheck className="h-3 w-3" /> {roleLabel}
        </span>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {hasAccess && (
          <NavSection
            title="Administration"
            items={isSuper ? SUPER_ITEMS : CAMPUS_ITEMS}
            location={location}
            onNavigate={onNavigate}
          />
        )}
        {studentSession && STUDENT_SECTIONS.map((sec) => (
          <NavSection key={sec.title} title={sec.title} items={sec.items} location={location} onNavigate={onNavigate} />
        ))}
        {!hasAccess && !studentSession && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Sign in to access your dashboard.</p>
        )}
      </nav>

      {/* Footer actions */}
      <div className="space-y-1 border-t border-border p-3">
        <button
          onClick={onToggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        {studentSession && (
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        )}
        {hasAccess && (
          <button
            onClick={handleLock}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Lock className="h-4 w-4" /> Lock admin
          </button>
        )}
      </div>
    </div>
  );
};

const NavSection = ({
  title, items, location, onNavigate,
}: {
  title: string;
  items: NavItem[];
  location: ReturnType<typeof useLocation>;
  onNavigate: () => void;
}) => (
  <div className="mb-2">
    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </div>
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isItemActive(item, location.pathname, location.search);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  </div>
);
