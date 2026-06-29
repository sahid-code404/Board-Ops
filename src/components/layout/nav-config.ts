"use client";

import {
  LayoutDashboard,
  UtensilsCrossed,
  Utensils,
  BarChart3,
  Sigma,
  Wallet,
  Receipt,
  Bell,
  Users,
  Settings,
  Palette,
  CreditCard,
  MoreHorizontal,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import type { ViewKey } from "@/stores/use-app-store";
import type { Role } from "@/stores/use-auth-store";

export type NavItem = {
  view: ViewKey;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Show on mobile bottom bar — if true, shows for all roles. Use primaryRoles for role-specific. */
  primary?: boolean;
  /** Role-specific primary (overrides primary for specific roles) */
  primaryRoles?: Role[];
  /** Show on tablet rail */
  rail?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard, roles: ["ADMIN", "USER"], primary: true, rail: true },
  { view: "meals", label: "Meal Configuration", icon: UtensilsCrossed, roles: ["ADMIN"], rail: true },
  { view: "user-meals", label: "Meals", icon: Utensils, roles: ["USER"], primaryRoles: ["USER"], rail: true },
  { view: "kitchen", label: "Counts", icon: BarChart3, roles: ["ADMIN"], primary: true, rail: true },
  { view: "billing", label: "Billing", icon: Wallet, roles: ["ADMIN", "USER"], primaryRoles: ["USER"], rail: true },
  { view: "payments", label: "Payments", icon: CreditCard, roles: ["ADMIN", "USER"], primary: true, rail: true },
  { view: "expenses", label: "Expenses", icon: Receipt, roles: ["ADMIN"], rail: true },
  { view: "funds", label: "Funds", icon: PiggyBank, roles: ["ADMIN"], rail: true },
  { view: "variables", label: "Variables", icon: Sigma, roles: ["ADMIN"], rail: true },
  { view: "users", label: "Users", icon: Users, roles: ["ADMIN"], primary: true, rail: true },
  { view: "notifications", label: "Notifications", icon: Bell, roles: ["ADMIN", "USER"], rail: true },
  { view: "settings", label: "Settings", icon: Settings, roles: ["ADMIN"], rail: true },
  { view: "personalization", label: "Personalization", icon: Palette, roles: ["ADMIN"], rail: true },
];

export const NAV_LABELS: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  meals: "Meal Configuration",
  "user-meals": "Meals",
  kitchen: "Meal Counts",
  variables: "Variable Engine",
  billing: "Billing & Invoices",
  payments: "Payments & Wallet",
  expenses: "Expenses & Procurement",
  funds: "Funds Overview",
  notifications: "Notifications",
  users: "User Management",
  settings: "System Settings",
  personalization: "Personalization",
  profile: "My Profile",
  audit: "Audit Log",
};

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

export function primaryNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => {
    if (!n.roles.includes(role)) return false;
    if (n.primary) return true;
    if (n.primaryRoles && n.primaryRoles.includes(role)) return true;
    return false;
  });
}

export function railNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role) && n.rail);
}
