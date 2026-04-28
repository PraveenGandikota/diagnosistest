import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Brain, Lock, Moon, Sun, GraduationCap } from "lucide-react";
import { useAdminAccess } from "@/lib/admin-access";

type Theme = "light" | "dark";

const publicItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/quiz", label: "Quiz", icon: Brain },
];

const adminItems = [
  { to: "/admin", label: "Admin", icon: Lock },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  const location = useLocation();
  const { hasAccess } = useAdminAccess();
  const items = hasAccess ? [...publicItems, ...adminItems] : publicItems;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="flex w-16 flex-col items-center justify-between border-r border-border bg-sidebar py-4 md:w-20">
        <div className="flex flex-col items-center gap-2">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`
              }
              title={label}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                {label}
              </span>
            </NavLink>
          ))}
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </aside>
      <main key={location.pathname} className="flex-1 anim-slide-in">{children}</main>
    </div>
  );
};
