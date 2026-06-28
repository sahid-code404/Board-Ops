"use client";

import { Bell, Search, Sun, Moon, Menu, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";
import { GlassButton } from "@/components/glass/glass-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NAV_LABELS } from "./nav-config";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-indigo-500 to-purple-500",
];

function gradientFor(name: string) {
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

export function TopBar() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const token = useAuthStore((s) => s.token);
  const isDark = resolvedTheme === "dark";

  // When theme changes via topbar, sync to user's profile so Profile page stays in sync
  const handleThemeChange = (t: string) => {
    setTheme(t);
    if (user) {
      setUser({ ...user, theme: t });
      api.put("/auth/profile", { theme: t }).catch(() => {});
    }
  };

  // Fetch unread notification count — refreshes every 30s
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { unreadCount: number } }>(
        "/notifications?unread=true"
      );
      return res.data.unreadCount;
    },
    enabled: !!token,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const label = NAV_LABELS[view] ?? "BoardOps";
  const showBadge = unreadCount > 0;

  return (
    <header className="sticky top-0 z-30 safe-top px-2.5 sm:px-3 pt-2.5 sm:pt-3">
      <div className="glass rounded-2xl sm:rounded-3xl px-2.5 sm:px-3 md:px-5 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-2 md:gap-4">
        {/* Hamburger — mobile only, well-sized touch target */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="md:hidden grid place-items-center h-10 w-10 rounded-2xl glass-soft text-foreground shrink-0"
        >
          <Menu className="h-5 w-5" />
        </motion.button>

        {/* Title — scales fluidly */}
        <div className="flex-1 min-w-0">
          <motion.p
            key={view}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight truncate"
          >
            {user?.role === "ADMIN" ? "Admin Console" : "Workspace"}
          </motion.p>
          <motion.h1
            key={`${view}-title`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm sm:text-base md:text-lg font-semibold leading-tight truncate"
          >
            {label}
          </motion.h1>
        </div>

        {/* Search button — icon on mobile, full on desktop */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setCommandOpen(true)}
          aria-label="Search"
          className="sm:hidden grid place-items-center h-10 w-10 rounded-2xl glass-soft text-muted-foreground hover:text-foreground shrink-0"
        >
          <Search className="h-[18px] w-[18px]" />
        </motion.button>
        <GlassButton
          variant="secondary"
          size="sm"
          onClick={() => setCommandOpen(true)}
          className="hidden sm:inline-flex"
        >
          <Search className="h-4 w-4" />
          <span className="text-xs text-muted-foreground">Search…</span>
          <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
            ⌘K
          </kbd>
        </GlassButton>

        {/* Theme switcher — overlay with Light/Dark/System */}
        <ThemeSwitcher isDark={isDark} onThemeChange={handleThemeChange} currentTheme={theme || "system"} />

        {/* Notifications — routes to notifications page, shows unread count badge */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setView("notifications")}
          aria-label={`Notifications${showBadge ? ` (${formatBadge(unreadCount)} unread)` : ""}`}
          className={cn(
            "relative grid place-items-center h-10 w-10 rounded-2xl glass-soft shrink-0 transition-colors",
            view === "notifications" ? "text-primary ring-2 ring-primary/50" : "text-foreground"
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          <AnimatePresence>
            {showBadge && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold grid place-items-center ring-2 ring-background"
              >
                {formatBadge(unreadCount)}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Profile avatar — routes to profile page */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.06 }}
          onClick={() => setView("profile")}
          aria-label="Open profile"
          className={cn(
            "relative grid place-items-center h-10 w-10 rounded-2xl overflow-hidden shrink-0",
            "ring-2 ring-border/50 hover:ring-primary/60 transition-all",
            view === "profile" && "ring-primary"
          )}
        >
          {user?.avatarUrl ? (
            <Avatar className="h-full w-full rounded-2xl">
              <AvatarImage src={user.avatarUrl} alt={user?.name || "Profile"} />
            </Avatar>
          ) : (
            <Avatar className="h-full w-full rounded-2xl">
              <AvatarFallback
                className={cn(
                  "rounded-2xl bg-gradient-to-br text-white font-bold text-xs h-full w-full grid place-items-center",
                  gradientFor(user?.name || "U")
                )}
              >
                {user?.name ? initials(user.name) || "U" : "U"}
              </AvatarFallback>
            </Avatar>
          )}
          {view === "profile" && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
          )}
        </motion.button>
      </div>
    </header>
  );
}

function ThemeSwitcher({
  isDark,
  onThemeChange,
  currentTheme,
}: {
  isDark: boolean;
  onThemeChange: (t: string) => void;
  currentTheme: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div ref={ref} className="relative shrink-0">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        aria-label="Theme switcher"
        suppressHydrationWarning
        className="grid place-items-center h-10 w-10 rounded-2xl glass-soft text-foreground hover:text-primary transition-colors"
      >
        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute right-0 top-12 z-50 glass-strong rounded-2xl p-1.5 min-w-[140px] shadow-xl"
          >
            {options.map((opt) => {
              const active = currentTheme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onThemeChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {active && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
