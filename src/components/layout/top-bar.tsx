"use client";

import { Bell, Search, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";
import { GlassButton } from "@/components/glass/glass-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NAV_LABELS } from "./nav-config";
import { cn } from "@/lib/utils";

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

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme();
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const setNotificationsOpen = useAppStore((s) => s.setNotificationsOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const user = useAuthStore((s) => s.user);
  const isDark = resolvedTheme === "dark";

  const label = NAV_LABELS[view] ?? "BoardOps";

  return (
    <header className="sticky top-0 z-30 safe-top px-3 pt-3">
      <div className="glass rounded-3xl px-3 md:px-5 py-2.5 flex items-center gap-2 md:gap-4">
        <GlassButton
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </GlassButton>

        <div className="flex-1 min-w-0">
          <motion.p
            key={view}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs md:text-sm text-muted-foreground"
          >
            {user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "Admin Console" : "Workspace"}
          </motion.p>
          <motion.h1
            key={`${view}-title`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-base md:text-lg font-semibold leading-tight truncate"
          >
            {label}
          </motion.h1>
        </div>

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

        <GlassButton
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </GlassButton>

        <GlassButton
          variant="ghost"
          size="icon"
          onClick={() => setNotificationsOpen(true)}
          aria-label="Notifications"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </GlassButton>

        {/* Profile avatar button — routes to profile page */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.06 }}
          onClick={() => setView("profile")}
          aria-label="Open profile"
          className={cn(
            "relative grid place-items-center h-10 w-10 rounded-2xl overflow-hidden",
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
