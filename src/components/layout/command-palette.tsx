"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  UtensilsCrossed,
  BarChart3,
  Sigma,
  Wallet,
  Receipt,
  Bell,
  Users,
  Settings,
  Palette,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore, type ViewKey } from "@/stores/use-app-store";
import { useAuthStore, type Role } from "@/stores/use-auth-store";

type PaletteItem = {
  view: ViewKey;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  roles: Role[];
  group: "Workspace" | "Finance" | "Admin" | "Account";
};

const ITEMS: PaletteItem[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview"], roles: ["ADMIN", "USER"], group: "Workspace" },
  { view: "meals", label: "Meal Configuration", icon: UtensilsCrossed, keywords: ["meals", "config", "menu"], roles: ["ADMIN"], group: "Workspace" },
  { view: "kitchen", label: "Meal Counts", icon: BarChart3, keywords: ["kitchen", "counts", "meals", "chart"], roles: ["ADMIN"], group: "Workspace" },
  { view: "billing", label: "Billing & Invoices", icon: Wallet, keywords: ["billing", "invoice", "bills"], roles: ["ADMIN", "USER"], group: "Finance" },
  { view: "payments", label: "Payments & Wallet", icon: Wallet, keywords: ["payment", "wallet", "pay"], roles: ["ADMIN", "USER"], group: "Finance" },
  { view: "expenses", label: "Expenses & Procurement", icon: Receipt, keywords: ["expense", "procurement", "spend"], roles: ["ADMIN"], group: "Finance" },
  { view: "variables", label: "Variable Engine", icon: Sigma, keywords: ["variable", "rate", "config"], roles: ["ADMIN"], group: "Admin" },
  { view: "notifications", label: "Notifications", icon: Bell, keywords: ["notification", "alert", "bell"], roles: ["ADMIN", "USER"], group: "Admin" },
  { view: "users", label: "User Management", icon: Users, keywords: ["user", "member", "account"], roles: ["ADMIN"], group: "Admin" },
  { view: "settings", label: "System Settings", icon: Settings, keywords: ["setting", "config", "feature", "flag"], roles: ["ADMIN"], group: "Admin" },
  { view: "personalization", label: "Personalization", icon: Palette, keywords: ["theme", "color", "accent", "ui", "personalize", "appearance"], roles: ["ADMIN"], group: "Admin" },
  { view: "profile", label: "My Profile", icon: User, keywords: ["profile", "me", "account"], roles: ["ADMIN", "USER"], group: "Account" },
];

const GROUP_ORDER: PaletteItem["group"][] = ["Workspace", "Finance", "Admin", "Account"];

export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const setView = useAppStore((s) => s.setView);
  const role = useAuthStore((s) => s.user?.role);

  // Cmd+K / Ctrl+K global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useAppStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  const visibleItems = ITEMS.filter((i) => role && i.roles.includes(role));

  const handleSelect = (view: ViewKey) => {
    setView(view);
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search navigation and actions"
      className="glass-strong border-border/60 max-w-xl rounded-3xl"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList className="max-h-[60vh] py-2">
        <CommandEmpty>No results found.</CommandEmpty>
        {GROUP_ORDER.map((group) => {
          const items = visibleItems.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <motion.div
              key={group}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <CommandGroup heading={group}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.view}
                      value={`${item.label} ${item.keywords.join(" ")}`}
                      onSelect={() => handleSelect(item.view)}
                      className="rounded-2xl aria-selected:bg-primary/15 aria-selected:text-primary"
                    >
                      <span className="grid place-items-center h-8 w-8 rounded-xl bg-primary/10 text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                        ↵
                      </kbd>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator className="my-1" />
            </motion.div>
          );
        })}
        <CommandGroup heading="Shortcuts">
          <CommandItem
            disabled
            className="rounded-2xl opacity-70"
          >
            <span className="grid place-items-center h-8 w-8 rounded-xl bg-muted text-muted-foreground shrink-0">
              <Bell className="h-4 w-4" />
            </span>
            <span className="flex-1">Open notifications</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
              ⌘N
            </kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
