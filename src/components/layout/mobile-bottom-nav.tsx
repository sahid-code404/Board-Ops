"use client";

import { motion } from "framer-motion";
import { navForRole } from "./nav-config";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";
import { cn } from "@/lib/utils";

/** Mobile bottom navigation bar — primary experience */
export function MobileBottomNav() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const role = useAuthStore((s) => s.user?.role) ?? "USER";
  const items = navForRole(role).slice(0, 5);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 safe-x safe-bottom"
      aria-label="Primary navigation"
    >
      <div className="mx-auto max-w-md px-3 pb-2 pt-1">
        <div className="glass-strong rounded-3xl px-2 py-2 flex items-center justify-around shadow-2xl">
          {items.map((item) => {
            const active = view === item.view;
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl"
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-active"
                    className="absolute inset-0 rounded-2xl bg-primary/15"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className={cn(
                    "relative z-10 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                </motion.div>
                <span
                  className={cn(
                    "relative z-10 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
