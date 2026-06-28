"use client";

import {
  LayoutDashboard,
  CalendarDays,
  UtensilsCrossed,
  ChefHat,
  Sigma,
  Wallet,
  Receipt,
  Bell,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ViewKey } from "@/stores/use-app-store";
import type { Role } from "@/stores/use-auth-store";

export type NavItem = {
  view: ViewKey;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Show on mobile bottom bar (primary 5) */
  primary?: boolean;
  /** Show on tablet rail */
  rail?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"], primary: true, rail: true },
  { view: "calendar", label: "Calendar", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"], primary: true, rail: true },
  { view: "meals", label: "Meals", icon: UtensilsCrossed, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"], primary: true, rail: true },
  { view: "kitchen", label: "Kitchen", icon: ChefHat, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], primary: true, rail: true },
  { view: "billing", label: "Billing", icon: Wallet, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"], primary: true, rail: true },
  { view: "payments", label: "Payments", icon: Wallet, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"], rail: true },
  { view: "expenses", label: "Expenses", icon: Receipt, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], rail: true },
  { view: "variables", label: "Variables", icon: Sigma, roles: ["SUPER_ADMIN", "ADMIN"], rail: true },
  { view: "users", label: "Users", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"], rail: true },
  { view: "notifications", label: "Notifications", icon: Bell, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"], rail: true },
  { view: "settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"], rail: true },
];

export const NAV_LABELS: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  calendar: "Meal Calendar",
  meals: "Meal Configuration",
  kitchen: "Kitchen Dashboard",
  variables: "Variable Engine",
  billing: "Billing & Invoices",
  payments: "Payments & Wallet",
  expenses: "Expenses & Procurement",
  notifications: "Notifications",
  users: "User Management",
  settings: "System Settings",
  profile: "My Profile",
  audit: "Audit Log",
};

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

export function primaryNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role) && n.primary);
}

export function railNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role) && n.rail);
}
