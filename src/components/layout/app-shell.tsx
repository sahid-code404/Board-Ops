"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { DesktopSidebar } from "./desktop-sidebar";
import { TopBar } from "./top-bar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { navForRole } from "./nav-config";
import { GlassButton } from "@/components/glass/glass-button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const view = useAppStore((s) => s.view);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const setView = useAppStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "USER";
  const items = navForRole(role);

  return (
    <div className="min-h-screen flex flex-col">
      <DesktopSidebar />

      {/* Mobile sidebar drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 glass-strong border-0">
          <div className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Navigate
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const active = view === item.view;
                const Icon = item.icon;
                return (
                  <GlassButton
                    key={item.view}
                    variant={active ? "primary" : "ghost"}
                    size="md"
                    className={cn("w-full justify-start", !active && "text-muted-foreground")}
                    onClick={() => {
                      setView(item.view);
                      setSidebarOpen(false);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </GlassButton>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-3 md:px-6 pb-28 md:pb-8 pt-4 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
