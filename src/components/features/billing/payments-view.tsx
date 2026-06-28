"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  Plus,
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  Wallet as WalletIcon,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/use-auth-store";

import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput, GlassTextarea } from "@/components/glass/glass-input";
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

type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";
type PaymentMethod = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "WALLET";

type Payment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  billId: string | null;
  createdAt: string;
  user: { name: string; email: string };
};

type ApiResponse<T> = { success: boolean; data: T; error?: string };

type BillListItem = {
  id: string;
  periodMonth: number;
  periodYear: number;
  dueAmount: number;
  status: string;
  user: { name: string };
};

// ─────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  PaymentStatus,
  { className: string; label: string }
> = {
  APPROVED: {
    className: "bg-success/15 text-success border-success/30",
    label: "Approved",
  },
  PENDING: {
    className: "bg-warning/15 text-warning border-warning/30",
    label: "Pending",
  },
  REJECTED: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
    label: "Rejected",
  },
  REFUNDED: {
    className: "bg-info/15 text-info border-info/30",
    label: "Refunded",
  },
};

const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: React.ReactNode; className: string }
> = {
  CASH: {
    label: "Cash",
    icon: <Banknote className="h-3.5 w-3.5" />,
    className: "bg-success/10 text-success border-success/20",
  },
  UPI: {
    label: "UPI",
    icon: <Smartphone className="h-3.5 w-3.5" />,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  CARD: {
    label: "Card",
    icon: <CreditCard className="h-3.5 w-3.5" />,
    className: "bg-info/10 text-info border-info/20",
  },
  BANK_TRANSFER: {
    label: "Bank",
    icon: <Building2 className="h-3.5 w-3.5" />,
    className: "bg-warning/10 text-warning border-warning/20",
  },
  WALLET: {
    label: "Wallet",
    icon: <WalletIcon className="h-3.5 w-3.5" />,
    className: "bg-secondary text-secondary-foreground border-border",
  },
};

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function PaymentsView() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "ALL">("ALL");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "ALL">("ALL");

  const [submitOpen, setSubmitOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<{
    payment: Payment;
    action: "APPROVE" | "REJECT";
  } | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const r = await api.get<ApiResponse<Payment[]>>("/payments");
      return r.data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: {
      amount: number;
      method: PaymentMethod;
      billId?: string;
      reference?: string;
      notes?: string;
    }) =>
      api.post<ApiResponse<Payment>>("/payments", payload),
    onSuccess: () => {
      toast.success("Payment submitted — pending admin approval");
      setSubmitOpen(false);
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to submit payment"),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "APPROVE" | "REJECT";
    }) => api.patch<ApiResponse<Payment>>(`/payments/${id}`, { action }),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === "APPROVE"
          ? "Payment approved — bill updated"
          : "Payment rejected"
      );
      setActionTarget(null);
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: Error) => toast.error(e.message || "Action failed"),
  });

  // KPIs
  const kpis = useMemo(() => {
    const approved = payments.filter((p) => p.status === "APPROVED");
    const totalApproved = approved.reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter((p) => p.status === "PENDING").length;
    const rejected = payments.filter((p) => p.status === "REJECTED").length;
    const now = new Date();
    const monthTotal = approved
      .filter((p) => {
        const d = new Date(p.createdAt);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((s, p) => s + p.amount, 0);
    return { totalApproved, pending, rejected, monthTotal };
  }, [payments]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (methodFilter !== "ALL" && p.method !== methodFilter) return false;
      if (!q) return true;
      return (
        p.user.name?.toLowerCase().includes(q) ||
        p.user.email?.toLowerCase().includes(q) ||
        (p.reference || "").toLowerCase().includes(q)
      );
    });
  }, [payments, search, statusFilter, methodFilter]);

  const pendingPayments = payments.filter((p) => p.status === "PENDING");

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
    <StaggerGroup className="space-y-4 md:space-y-6">
      {/* Header */}
      <StaggerItem>
        <GlassCard className="p-5 md:p-7" hover={false} glow="primary">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Payments & Wallet
              </p>
              <h2 className="text-2xl md:text-3xl font-bold">Payment Center</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdmin
                  ? "Approve resident payments and track all transactions."
                  : "Submit payments and track your transaction history."}
              </p>
            </div>
            <GlassButton
              size="lg"
              onClick={() => setSubmitOpen(true)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              Submit Payment
            </GlassButton>
          </div>
        </GlassCard>
      </StaggerItem>

      {/* KPIs */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            label="Total Approved"
            value={kpis.totalApproved}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="success"
            prefix="₹"
          />
          <KpiCard
            label="Pending Approvals"
            value={kpis.pending}
            icon={<Clock className="h-5 w-5" />}
            color="warning"
          />
          <KpiCard
            label="Rejected"
            value={kpis.rejected}
            icon={<XCircle className="h-5 w-5" />}
            color="danger"
          />
          <KpiCard
            label="This Month"
            value={kpis.monthTotal}
            icon={<Wallet className="h-5 w-5" />}
            color="info"
            prefix="₹"
          />
        </div>
      </StaggerItem>

      {/* Admin: Pending payments section */}
      {isAdmin && pendingPayments.length > 0 && (
        <StaggerItem>
          <GlassCard className="p-5 md:p-6" hover={false} glow="warning">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning" />
                  Pending Approvals
                  <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 rounded-full">
                    {pendingPayments.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review and approve or reject incoming payments.
                </p>
              </div>
            </div>
            <StaggerGroup className="space-y-2">
              {pendingPayments.slice(0, 4).map((p) => (
                <StaggerItem key={p.id}>
                  <PendingRow
                    payment={p}
                    onApprove={() =>
                      setActionTarget({ payment: p, action: "APPROVE" })
                    }
                    onReject={() =>
                      setActionTarget({ payment: p, action: "REJECT" })
                    }
                    loading={
                      actionMutation.isPending &&
                      actionTarget?.payment.id === p.id
                    }
                  />
                </StaggerItem>
              ))}
            </StaggerGroup>
          </GlassCard>
        </StaggerItem>
      )}

      {/* Filters */}
      <StaggerItem>
        <GlassCard className="p-3 md:p-4" hover={false}>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <GlassInput
                placeholder="Search by name, email, reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search />}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(
                ["ALL", "APPROVED", "PENDING", "REJECTED", "REFUNDED"] as const
              ).map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3.5 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "glass-soft text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "ALL" ? "All" : STATUS_STYLES[s].label}
                  </button>
                );
              })}
            </div>
            <Select
              value={methodFilter}
              onValueChange={(v) => setMethodFilter(v as PaymentMethod | "ALL")}
            >
              <SelectTrigger className="w-full md:w-40 h-11 rounded-2xl">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Methods</SelectItem>
                {Object.entries(METHOD_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>
      </StaggerItem>

      {/* List */}
      <StaggerItem>
        {filtered.length === 0 ? (
          <GlassCard className="p-10 md:p-16" hover={false}>
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="grid place-items-center h-14 w-14 rounded-3xl bg-muted/40">
                <IndianRupee className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No payments found</p>
                <p className="text-sm text-muted-foreground">
                  Submit a payment or adjust your filters.
                </p>
              </div>
            </div>
          </GlassCard>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              <StaggerGroup className="space-y-3">
                {filtered.map((p) => (
                  <StaggerItem key={p.id}>
                    <PaymentCard payment={p} isAdmin={isAdmin} />
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>

            {/* Desktop table */}
            <GlassCard className="hidden md:block p-2" hover={false}>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    {isAdmin && <TableHead className="pl-4">Resident</TableHead>}
                    <TableHead className={isAdmin ? "" : "pl-4"}>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    {!isAdmin && <TableHead className="text-right pr-4">Notes</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="border-border/40">
                      {isAdmin && (
                        <TableCell className="pl-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{p.user.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.user.email}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-semibold tabular-nums">
                        {formatINR(p.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("rounded-full", METHOD_META[p.method].className)}
                        >
                          {METHOD_META[p.method].icon}
                          {METHOD_META[p.method].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            STATUS_STYLES[p.status].className
                          )}
                        >
                          {STATUS_STYLES[p.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.reference || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(p.createdAt)}
                      </TableCell>
                      {!isAdmin && (
                        <TableCell className="text-right pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
                          {p.notes || "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          </>
        )}
      </StaggerItem>

      {/* Submit Payment Dialog */}
      <SubmitPaymentDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSubmit={(payload) => submitMutation.mutate(payload)}
        loading={submitMutation.isPending}
      />

      {/* Approve/Reject confirm */}
      <AlertDialog
        open={!!actionTarget}
        onOpenChange={(o) => !o && setActionTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.action === "APPROVE"
                ? "Approve payment?"
                : "Reject payment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget && (
                <>
                  {actionTarget.action === "APPROVE" ? (
                    <>
                      Approve{" "}
                      <span className="font-medium text-foreground">
                        {formatINR(actionTarget.payment.amount)}
                      </span>{" "}
                      from{" "}
                      <span className="font-medium text-foreground">
                        {actionTarget.payment.user.name}
                      </span>
                      ? The linked bill will be updated.
                    </>
                  ) : (
                    <>
                      Reject the{" "}
                      <span className="font-medium text-foreground">
                        {formatINR(actionTarget.payment.amount)}
                      </span>{" "}
                      payment from{" "}
                      <span className="font-medium text-foreground">
                        {actionTarget.payment.user.name}
                      </span>
                      ?
                    </>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "rounded-2xl",
                actionTarget?.action === "APPROVE"
                  ? "bg-success text-white hover:bg-success/90"
                  : "bg-destructive text-white hover:bg-destructive/90"
              )}
              onClick={() =>
                actionTarget &&
                actionMutation.mutate({
                  id: actionTarget.payment.id,
                  action: actionTarget.action,
                })
              }
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending
                ? "Processing…"
                : actionTarget?.action === "APPROVE"
                  ? "Approve"
                  : "Reject"}
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
    <GlassCard
      className="p-4 md:p-5"
      glow={color === "danger" ? "danger" : color === "warning" ? "warning" : color === "success" ? "success" : "primary"}
    >
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

function PendingRow({
  payment,
  onApprove,
  onReject,
  loading,
}: {
  payment: Payment;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="glass-soft rounded-2xl p-3 flex items-center gap-3"
    >
      <div
        className={cn(
          "grid place-items-center h-10 w-10 rounded-xl shrink-0",
          METHOD_META[payment.method].className
        )}
      >
        {METHOD_META[payment.method].icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{payment.user.name}</p>
          <span className="text-xs text-muted-foreground truncate">
            · {METHOD_META[payment.method].label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {formatDateTime(payment.createdAt)}
          {payment.reference ? ` · Ref ${payment.reference}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold tabular-nums">{formatINR(payment.amount)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <GlassButton
          size="sm"
          variant="success"
          onClick={onApprove}
          loading={loading}
          className="!h-8 !px-3"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </GlassButton>
        <GlassButton
          size="sm"
          variant="danger"
          onClick={onReject}
          loading={loading}
          className="!h-8 !px-3"
        >
          <XCircle className="h-3.5 w-3.5" />
        </GlassButton>
      </div>
    </motion.div>
  );
}

function PaymentCard({
  payment,
  isAdmin,
}: {
  payment: Payment;
  isAdmin: boolean;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className="glass rounded-3xl p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "grid place-items-center h-11 w-11 rounded-2xl shrink-0",
              METHOD_META[payment.method].className
            )}
          >
            {METHOD_META[payment.method].icon}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">
              {isAdmin ? payment.user.name : METHOD_META[payment.method].label}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {formatDateTime(payment.createdAt)}
              {payment.reference ? ` · Ref ${payment.reference}` : ""}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("rounded-full", STATUS_STYLES[payment.status].className)}
        >
          {STATUS_STYLES[payment.status].label}
        </Badge>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Amount</p>
          <p className="text-2xl font-bold tabular-nums">
            {formatINR(payment.amount)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("rounded-full", METHOD_META[payment.method].className)}
        >
          {METHOD_META[payment.method].icon}
          {METHOD_META[payment.method].label}
        </Badge>
      </div>
      {payment.notes && (
        <p className="mt-3 text-xs text-muted-foreground glass-soft rounded-2xl p-2.5">
          {payment.notes}
        </p>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Submit payment dialog
// ─────────────────────────────────────────────────────────────

function SubmitPaymentDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: {
    amount: number;
    method: PaymentMethod;
    billId?: string;
    reference?: string;
    notes?: string;
  }) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [billId, setBillId] = useState<string>("NONE");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>("");

  // Load user's outstanding bills for selection
  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const r = await api.get<ApiResponse<BillListItem[]>>("/bills");
      return r.data;
    },
    enabled: open,
  });

  const outstanding = bills.filter(
    (b) => b.status !== "PAID" && b.status !== "VOID" && b.dueAmount > 0
  );

  function reset() {
    setAmount("");
    setMethod("UPI");
    setBillId("NONE");
    setReference("");
    setNotes("");
    setError("");
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }
    onSubmit({
      amount: amt,
      method,
      billId: billId === "NONE" ? undefined : billId,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Submit a Payment
          </DialogTitle>
          <DialogDescription>
            Your payment will be reviewed by an administrator before being
            applied to your bill.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <GlassInput
            label="Amount (₹)"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            error={error}
            icon={<IndianRupee />}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              Method
            </label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <SelectTrigger className="w-full h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {outstanding.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground ml-1">
                Apply to bill (optional)
              </label>
              <Select value={billId} onValueChange={setBillId}>
                <SelectTrigger className="w-full h-11 rounded-2xl">
                  <SelectValue placeholder="Select a bill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No specific bill</SelectItem>
                  {outstanding.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.user.name} — {formatMonthLabel(b.periodMonth, b.periodYear)} · ₹
                      {Math.round(b.dueAmount).toLocaleString("en-IN")} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <GlassInput
            label="Reference (optional)"
            placeholder="UTR / Txn ID"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            icon={<ArrowUpRight />}
          />

          <GlassTextarea
            label="Notes (optional)"
            placeholder="Any note for the admin…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <GlassButton variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </GlassButton>
          <GlassButton onClick={handleSubmit} loading={loading}>
            <ArrowDownRight className="h-4 w-4" />
            Submit
          </GlassButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatMonthLabel(month: number, year: number) {
  return new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}
