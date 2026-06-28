"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Receipt,
  Plus,
  Search,
  Ban,
  Eye,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/use-auth-store";
import { useAppStore } from "@/stores/use-app-store";

import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import {
  StaggerGroup,
  StaggerItem,
} from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type BillStatus =
  | "DRAFT"
  | "GENERATED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";

type Bill = {
  id: string;
  periodMonth: number;
  periodYear: number;
  mealCharges: number;
  otherCharges: number;
  adjustments: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: BillStatus;
  dueDate: string | null;
  generatedAt: string | null;
  createdAt: string;
  user: { name: string; email: string; room: string | null };
};

type ApiResponse<T> = { success: boolean; data: T; error?: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─────────────────────────────────────────────────────────────
// Status badge helpers
// ─────────────────────────────────────────────────────────────

const BILL_STATUS_STYLES: Record<
  BillStatus,
  { className: string; label: string }
> = {
  PAID: {
    className:
      "bg-success/15 text-success border-success/30",
    label: "Paid",
  },
  PARTIALLY_PAID: {
    className:
      "bg-warning/15 text-warning border-warning/30",
    label: "Partially Paid",
  },
  OVERDUE: {
    className:
      "bg-destructive/15 text-destructive border-destructive/30",
    label: "Overdue",
  },
  GENERATED: {
    className:
      "bg-info/15 text-info border-info/30",
    label: "Generated",
  },
  DRAFT: {
    className:
      "bg-muted text-muted-foreground border-border",
    label: "Draft",
  },
  VOID: {
    className:
      "bg-muted text-muted-foreground border-border",
    label: "Void",
  },
};

function BillStatusBadge({ status }: { status: BillStatus }) {
  const s = BILL_STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={cn("rounded-full", s.className)}>
      {s.label}
    </Badge>
  );
}

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatMonthYear(month: number, year: number) {
  return `${MONTHS[month] ?? "—"} ${year}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function BillingView() {
  const user = useAuthStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);
  const isAdmin =
    user?.role === "ADMIN";

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatus | "ALL">("ALL");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genMonth, setGenMonth] = useState<number>(new Date().getMonth());
  const [genYear, setGenYear] = useState<number>(new Date().getFullYear());
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [voidTarget, setVoidTarget] = useState<Bill | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["bills", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const r = await api.get<ApiResponse<Bill[]>>("/bills", {
        params: { month: selectedMonth, year: selectedYear },
      });
      return r.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<{ generated: number; month: number; year: number }>>(
        "/bills",
        { month: genMonth, year: genYear }
      ),
    onSuccess: (r) => {
      toast.success(`Generated ${r.data.generated} bills for ${MONTHS[genMonth]} ${genYear}`);
      setGenerateOpen(false);
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to generate bills"),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/bills/${id}`),
    onSuccess: () => {
      toast.success("Bill voided successfully");
      setVoidTarget(null);
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to void bill"),
  });

  // ── Derived KPIs ──
  const kpis = useMemo(() => {
    const active = bills.filter((b) => b.status !== "VOID");
    const totalBilled = active.reduce((s, b) => s + b.totalAmount, 0);
    const totalCollected = active.reduce((s, b) => s + b.paidAmount, 0);
    const totalOutstanding = active.reduce((s, b) => s + b.dueAmount, 0);
    const overdueCount = active.filter((b) => b.status === "OVERDUE").length;
    return { totalBilled, totalCollected, totalOutstanding, overdueCount };
  }, [bills]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.user.name?.toLowerCase().includes(q) ||
        b.user.email?.toLowerCase().includes(q) ||
        (b.user.room || "").toLowerCase().includes(q)
      );
    });
  }, [bills, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-32" />
          ))}
        </div>
        <ShimmerSkeleton className="h-14 w-full" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <StaggerGroup className="space-y-4 md:space-y-5">
      {/* Month picker — centered, capsule design (matches expenses page) */}
      <StaggerItem>
        <div className="flex items-center justify-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth - 1, 1);
              setSelectedMonth(d.getMonth());
              setSelectedYear(d.getFullYear());
            }}
            aria-label="Previous month"
            className="grid place-items-center h-10 w-10 rounded-full glass-strong shrink-0 ring-1 ring-border/40 hover:ring-primary/40 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>

          <div className="flex-1 max-w-[280px] flex items-center justify-center gap-2.5 glass-soft rounded-full px-6 py-2.5">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <div className="leading-tight text-center">
              <p className="text-sm font-bold text-primary">
                {new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "long" })}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selectedYear}
              </p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth + 1, 1);
              setSelectedMonth(d.getMonth());
              setSelectedYear(d.getFullYear());
            }}
            aria-label="Next month"
            className="grid place-items-center h-10 w-10 rounded-full glass-strong shrink-0 ring-1 ring-border/40 hover:ring-primary/40 transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </StaggerItem>

      {/* Compact action bar — no duplicate title (TopBar already shows it) */}
      {isAdmin && (
        <StaggerItem>
          <div className="flex items-center justify-end gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Generate and track resident bills
            </p>
            <GlassButton
              onClick={() => setGenerateOpen(true)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              Generate Bills
            </GlassButton>
          </div>
        </StaggerItem>
      )}

      {/* KPIs */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            label="Total Billed"
            value={kpis.totalBilled}
            icon={<Wallet className="h-5 w-5" />}
            color="primary"
            prefix="₹"
          />
          <KpiCard
            label="Total Collected"
            value={kpis.totalCollected}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="success"
            prefix="₹"
          />
          <KpiCard
            label="Outstanding"
            value={kpis.totalOutstanding}
            icon={<TrendingUp className="h-5 w-5" />}
            color="warning"
            prefix="₹"
          />
          <KpiCard
            label="Overdue Count"
            value={kpis.overdueCount}
            icon={<AlertCircle className="h-5 w-5" />}
            color="danger"
          />
        </div>
      </StaggerItem>

      {/* Search + Filter pills (expenses-style design) */}
      <StaggerItem>
        <div className="space-y-3">
          <GlassInput
            placeholder="Search by name, email, room…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search />}
          />
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(
              [
                "ALL",
                "GENERATED",
                "PARTIALLY_PAID",
                "PAID",
                "OVERDUE",
                "VOID",
              ] as const
            ).map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "glass-soft text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "ALL" ? "All" : BILL_STATUS_STYLES[s].label}
                </button>
              );
            })}
          </div>
        </div>
      </StaggerItem>

      {/* List */}
      <StaggerItem>
        {filtered.length === 0 ? (
          <GlassCard className="p-10 md:p-16" hover={false}>
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="grid place-items-center h-14 w-14 rounded-3xl bg-muted/40">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No bills found</p>
                <p className="text-sm text-muted-foreground">
                  {isAdmin
                    ? "Generate bills for the current period to get started."
                    : "You have no bills matching the current filters."}
                </p>
              </div>
              {isAdmin && (
                <GlassButton className="mt-2" onClick={() => setGenerateOpen(true)}>
                  <Wallet className="h-4 w-4" />
                  Generate Bills
                </GlassButton>
              )}
              {!isAdmin && (
                <GlassButton variant="ghost" className="mt-2" onClick={() => setView("dashboard")}>
                  Back to Dashboard
                </GlassButton>
              )}
            </div>
          </GlassCard>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              <StaggerGroup className="space-y-3">
                {filtered.map((bill) => (
                  <StaggerItem key={bill.id}>
                    <BillCard
                      bill={bill}
                      isAdmin={isAdmin}
                      onView={() => setSelectedBill(bill)}
                      onVoid={() => setVoidTarget(bill)}
                    />
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>

            {/* Desktop table */}
            <GlassCard className="hidden md:block p-2" hover={false}>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead className="pl-4">Resident</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Meals</TableHead>
                    <TableHead className="text-right">Other</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((bill) => (
                    <TableRow key={bill.id} className="border-border/40">
                      <TableCell className="pl-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{bill.user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {bill.user.room ? `Room ${bill.user.room}` : bill.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMonthYear(bill.periodMonth, bill.periodYear)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatINR(bill.mealCharges)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatINR(bill.otherCharges)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatINR(bill.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-success tabular-nums">
                        {formatINR(bill.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-warning tabular-nums">
                        {formatINR(bill.dueAmount)}
                      </TableCell>
                      <TableCell>
                        <BillStatusBadge status={bill.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(bill.dueDate)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <GlassButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedBill(bill)}
                            aria-label="View bill"
                          >
                            <Eye className="h-4 w-4" />
                          </GlassButton>
                          {isAdmin && bill.status !== "VOID" && (
                            <GlassButton
                              variant="ghost"
                              size="icon"
                              onClick={() => setVoidTarget(bill)}
                              aria-label="Void bill"
                              className="text-destructive hover:text-destructive"
                            >
                              <Ban className="h-4 w-4" />
                            </GlassButton>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          </>
        )}
      </StaggerItem>

      {/* Generate Bills Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generate Bills
            </DialogTitle>
            <DialogDescription>
              Generate or refresh bills for all active residents for the
              selected period. Existing non-void bills will be re-calculated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground ml-1">
                Month
              </label>
              <Select
                value={String(genMonth)}
                onValueChange={(v) => setGenMonth(Number(v))}
              >
                <SelectTrigger className="w-full h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground ml-1">
                Year
              </label>
              <Select
                value={String(genYear)}
                onValueChange={(v) => setGenYear(Number(v))}
              >
                <SelectTrigger className="w-full h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <GlassButton
              variant="ghost"
              onClick={() => setGenerateOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
            >
              <Sparkles className="h-4 w-4" />
              Generate
            </GlassButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill detail dialog */}
      <Dialog
        open={!!selectedBill}
        onOpenChange={(o) => !o && setSelectedBill(null)}
      >
        <DialogContent className="rounded-3xl max-w-lg">
          {selectedBill && (
            <BillDetail bill={selectedBill} isAdmin={isAdmin} />
          )}
        </DialogContent>
      </Dialog>

      {/* Void confirm */}
      <AlertDialog
        open={!!voidTarget}
        onOpenChange={(o) => !o && setVoidTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Void this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              {voidTarget && (
                <>
                  This will mark the bill for{" "}
                  <span className="font-medium text-foreground">
                    {voidTarget.user.name}
                  </span>{" "}
                  ({formatMonthYear(voidTarget.periodMonth, voidTarget.periodYear)}
                  ) as void. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                voidTarget && voidMutation.mutate(voidTarget.id)
              }
              disabled={voidMutation.isPending}
            >
              {voidMutation.isPending ? "Voiding…" : "Void Bill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StaggerGroup>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
  prefix,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "danger" | "info";
  prefix?: string;
}) {
  const colorVar =
    color === "primary"
      ? "var(--primary)"
      : color === "success"
        ? "var(--success)"
        : color === "warning"
          ? "var(--warning)"
          : color === "danger"
            ? "var(--destructive)"
            : "var(--info)";
  return (
    <GlassCard className="p-4 md:p-5" glow={color === "danger" ? "danger" : color === "warning" ? "warning" : color === "success" ? "success" : "primary"}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="grid place-items-center h-10 w-10 rounded-2xl"
          style={{
            background: `color-mix(in oklch, ${colorVar} 15%, transparent)`,
            color: colorVar,
          }}
        >
          {icon}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
        <AnimatedCounter value={value} prefix={prefix || ""} />
      </div>
    </GlassCard>
  );
}

function BillCard({
  bill,
  isAdmin,
  onView,
  onVoid,
}: {
  bill: Bill;
  isAdmin: boolean;
  onView: () => void;
  onVoid: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className="glass rounded-3xl p-4 cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{bill.user.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {bill.user.room ? `Room ${bill.user.room}` : bill.user.email}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatMonthYear(bill.periodMonth, bill.periodYear)}
          </p>
        </div>
        <BillStatusBadge status={bill.status} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass-soft rounded-2xl py-2">
          <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatINR(bill.totalAmount)}
          </p>
        </div>
        <div className="glass-soft rounded-2xl py-2">
          <p className="text-[10px] text-muted-foreground uppercase">Paid</p>
          <p className="text-sm font-semibold text-success tabular-nums">
            {formatINR(bill.paidAmount)}
          </p>
        </div>
        <div className="glass-soft rounded-2xl py-2">
          <p className="text-[10px] text-muted-foreground uppercase">Due</p>
          <p className="text-sm font-semibold text-warning tabular-nums">
            {formatINR(bill.dueAmount)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Due {formatDate(bill.dueDate)}
        </span>
        <div className="flex items-center gap-1">
          <GlassButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onView(); }}>
            <Eye className="h-3.5 w-3.5" /> View
          </GlassButton>
          {isAdmin && bill.status !== "VOID" && (
            <GlassButton
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onVoid(); }}
            >
              <Ban className="h-3.5 w-3.5" />
            </GlassButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BillDetail({ bill, isAdmin }: { bill: Bill; isAdmin: boolean }) {
  const { data: payments = [] } = useQuery({
    queryKey: ["bill", bill.id, "payments"],
    queryFn: async () => {
      const r = await api.get<
        ApiResponse<{
          id: string;
          payments: Array<{
            id: string;
            amount: number;
            method: string;
            status: string;
            reference: string | null;
            createdAt: string;
          }>;
        }>
      >(`/bills/${bill.id}`);
      return r.data.payments || [];
    },
    enabled: isAdmin,
  });

  const rows = [
    { label: "Meal Charges", value: bill.mealCharges, icon: <IndianRupee className="h-3.5 w-3.5" /> },
    { label: "Other Charges", value: bill.otherCharges, icon: <IndianRupee className="h-3.5 w-3.5" /> },
    {
      label: "Adjustments",
      value: bill.adjustments,
      icon: <IndianRupee className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Bill Breakdown
          </p>
          <h3 className="text-lg font-semibold">{bill.user.name}</h3>
          <p className="text-xs text-muted-foreground">
            {formatMonthYear(bill.periodMonth, bill.periodYear)} · Room{" "}
            {bill.user.room || "—"}
          </p>
        </div>
        <BillStatusBadge status={bill.status} />
      </div>

      <div className="space-y-2 mb-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between glass-soft rounded-2xl px-4 py-2.5"
          >
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              {r.icon}
              {r.label}
            </span>
            <span className="text-sm font-medium tabular-nums">
              {formatINR(r.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Total Amount</span>
          <span className="text-base font-semibold tabular-nums">
            {formatINR(bill.totalAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-success flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
          </span>
          <span className="text-sm font-medium text-success tabular-nums">
            {formatINR(bill.paidAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <span className="text-sm text-warning flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Outstanding
          </span>
          <span className="text-base font-bold text-warning tabular-nums">
            {formatINR(bill.dueAmount)}
          </span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2 mb-4">
        <Clock className="h-3.5 w-3.5" />
        Due {formatDate(bill.dueDate)} · Generated {formatDate(bill.generatedAt)}
      </div>

      {isAdmin && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 ml-1 uppercase tracking-wide">
            Payment History ({payments.length})
          </p>
          {payments.length === 0 ? (
            <div className="glass-soft rounded-2xl p-4 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between glass-soft rounded-2xl px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium tabular-nums">
                      {formatINR(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.method} · {formatDate(p.createdAt)}
                      {p.reference ? ` · Ref ${p.reference}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Small inline icon (sparkle) to avoid extra import cost
function Sparkles({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}
