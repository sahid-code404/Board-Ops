"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore, type CurrentUser } from "@/stores/use-auth-store";
import { AuthScreen } from "@/components/features/auth/auth-screen";
import { AppShell } from "@/components/layout/app-shell";
import { AnimatedBackground } from "@/components/glass/animated-background";
import { api } from "@/lib/api-client";
import { DashboardView } from "@/components/features/dashboard/dashboard-view";
import { MealsConfigView } from "@/components/features/meals/meals-config-view";
import { UserMealsView } from "@/components/features/meals/user-meals-view";
import { KitchenView } from "@/components/features/kitchen/kitchen-view";
import { VariablesView } from "@/components/features/variables/variables-view";
import { BillingView } from "@/components/features/billing/billing-view";
import { PaymentsView } from "@/components/features/billing/payments-view";
import { ExpensesView } from "@/components/features/billing/expenses-view";
import { FundsView } from "@/components/features/billing/funds-view";
import { NotificationsView } from "@/components/features/notifications/notifications-view";
import { SettingsView } from "@/components/features/settings/settings-view";
import { UsersView } from "@/components/features/users/users-view";
import { ProfileView } from "@/components/features/auth/profile-view";
import { PersonalizationView } from "@/components/features/personalization/personalization-view";
import { useAppStore } from "@/stores/use-app-store";
import { CommandPalette } from "@/components/layout/command-palette";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";

export default function Page() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.logout);
  const view = useAppStore((s) => s.view);

  const { isLoading, isError } = useQuery({
    queryKey: ["auth-me", token],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: CurrentUser }>("/auth/me");
      setUser(r.data);
      return r.data;
    },
    enabled: !!token,
    retry: false,
    staleTime: 60 * 1000,
  });

  if (isError && token) {
    // Token invalid — clear it once. Using a microtask to avoid setState during render.
    queueMicrotask(() => clearAuth());
  }

  if (token && isLoading && !user) {
    return (
      <div className="min-h-screen grid place-items-center safe-top safe-bottom">
        <AnimatedBackground />
        <div className="space-y-3 w-72">
          <ShimmerSkeleton className="h-12 w-12 rounded-3xl mx-auto" />
          <ShimmerSkeleton className="h-4 w-3/4 mx-auto" />
          <ShimmerSkeleton className="h-3 w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!token || (isError && !user)) {
    return <AuthScreen />;
  }

  return (
    <>
      <AnimatedBackground />
      <AppShell>
        {view === "dashboard" && <DashboardView />}
        {view === "meals" && <MealsConfigView />}
        {view === "user-meals" && <UserMealsView />}
        {view === "kitchen" && <KitchenView />}
        {view === "variables" && <VariablesView />}
        {view === "billing" && <BillingView />}
        {view === "payments" && <PaymentsView />}
        {view === "expenses" && <ExpensesView />}
        {view === "funds" && <FundsView />}
        {view === "notifications" && <NotificationsView />}
        {view === "settings" && <SettingsView />}
        {view === "personalization" && <PersonalizationView />}
        {view === "users" && <UsersView />}
        {view === "profile" && <ProfileView />}
      </AppShell>
      <CommandPalette />
    </>
  );
}
