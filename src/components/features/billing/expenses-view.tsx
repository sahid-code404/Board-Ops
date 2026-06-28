"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Wallet,
  IndianRupee,
  Plus,
  Trash2,
  ShoppingBag,
  Zap,
  Users,
  Wrench,
  Boxes,
  Calendar,
  Receipt,
  User,
  PencilLine,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type ExpenseCategory =
  | "GROCERY"
  | "UTILITIES"
  | "SALARY"
  | "MAINTENANCE"
  | "GENERAL";

type Expense = {
  id: string;
  title: string;
  description: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  paidTo: string | null;
  status: string;
  user: { name: string } | null;
};

type ApiResponse<T> = { success: boolean; data: T; error?: string };

// ─────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  ExpenseCategory,
  {
    label: string;
    icon: React.ReactNode;
    className: string;
    colorVar: string;
    chartColor: string;
  }
> = {
  GROCERY: {
    label: "Grocery",
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    className: "bg-success/15 text-success border-success/30",
    colorVar: "var(--success)",
    chartColor: "var(--success)",
  },
  UTILITIES: {
    label: "Utilities",
    icon: <Zap className="h-3.5 w-3.5" />,
    className: "bg-info/15 text-info border-info/30",
    colorVar: "var(--info)",
    chartColor: "var(--info)",
  },
  SALARY: {
    label: "Salary",
    icon: <Users className="h-3.5 w-3.5" />,
    className: "bg-primary/15 text-primary border-primary/30",
    colorVar: "var(--primary)",
    chartColor: "var(--primary)",
  },
  MAINTENANCE: {
    label: "Maintenance",
    icon: <Wrench className="h-3.5 w-3.5" />,
    className: "bg-warning/15 text-warning border-warning/30",
    colorVar: "var(--warning)",
    chartColor: "var(--warning)",
  },
  GENERAL: {
    label: "General",
    icon: <Boxes className="h-3.5 w-3.5" />,
    className: "bg-muted text-muted-foreground border-border",
    colorVar: "var(--muted-foreground)",
    chartColor: "var(--muted-foreground)",
  },
};

const CATEGORY_ORDER: ExpenseCategory[] = [
  "GROCERY",
  "UTILITIES",
  "SALARY",
  "MAINTENANCE",
  "GENERAL",
];

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

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function ExpensesView() {
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "ADMIN" ||
    user?.role === "ADMIN" ||
    false;
  const qc = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "ALL">(
    "ALL"
  );
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const r = await api.get<ApiResponse<Expense[]>>("/expenses");
      return r.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      amount: number;
      category: ExpenseCategory;
      expenseDate: string;
      paidTo?: string;
      description?: string;
    }) => api.post<ApiResponse<Expense>>("/expenses", payload),
    onSuccess: () => {
      toast.success("Expense added successfully");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add expense"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/expenses/${id}`),
    onSuccess: () => {
      toast.success("Expense deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete expense"),
  });

  // KPIs + breakdown
  const { totalThisMonth, byCategory, count } = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter((e) => {
      const d = new Date(e.expenseDate);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });
    const total = thisMonth.reduce((s, e) => s + e.amount, 0);
    const byCat: Record<ExpenseCategory, number> = {
      GROCERY: 0,
      UTILITIES: 0,
      SALARY: 0,
      MAINTENANCE: 0,
      GENERAL: 0,
    };
    thisMonth.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    });
    return {
      totalThisMonth: total,
      byCategory: byCat,
      count: thisMonth.length,
    };
  }, [expenses]);

  const filtered = useMemo(() => {
    if (categoryFilter === "ALL") return expenses;
    return expenses.filter((e) => e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-32" />
          ))}
        </div>
        <ShimmerSkeleton className="h-72" />
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
      {/* Action bar */}
      {isAdmin && (
        <StaggerItem>
          <div className="flex items-center justify-end gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Track & manage operational expenses
            </p>
            <GlassButton
              size="lg"
              onClick={() => setAddOpen(true)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </GlassButton>
          </div>
        </StaggerItem>
      )}

      {/* KPIs */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <KpiCard
            label="Total This Month"
            value={totalThisMonth}
            icon={<Wallet className="h-5 w-5" />}
            color="primary"
            prefix="₹"
          />
          <KpiCard
            label="Transactions"
            value={count}
            icon={<Receipt className="h-5 w-5" />}
            color="info"
          />
        </div>
      </StaggerItem>

      {/* Top Categories — horizontal bars sorted high to low */}
      <StaggerItem>
        <GlassCard className="p-4 md:p-6" hover={false}>
          <h3 className="font-semibold mb-4">Top Categories <span className="text-xs font-normal text-muted-foreground ml-1">· this month</span></h3>
          <div className="space-y-3">
            {(() => {
              const sorted = CATEGORY_ORDER
                .map((cat) => ({ cat, amount: byCategory[cat] || 0 }))
                .filter((x) => x.amount > 0)
                .sort((a, b) => b.amount - a.amount);
              if (sorted.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">No expenses this month</p>;
              }
              const maxAmount = sorted[0].amount;
              return sorted.map(({ cat, amount }) => {
                const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: meta.chartColor }}
                        />
                        {meta.label}
                      </span>
                      <span className="font-medium tabular-nums">₹{amount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: meta.chartColor }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </GlassCard>
      </StaggerItem>

      {/* Filters */}
      <StaggerItem>
        <GlassCard className="p-3 md:p-4" hover={false}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(["ALL", ...CATEGORY_ORDER] as const).map((c) => {
              const active = categoryFilter === c;
              const meta =
                c === "ALL" ? null : CATEGORY_META[c as ExpenseCategory];
              return (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "glass-soft text-muted-foreground hover:text-foreground"
                  )}
                >
                  {meta?.icon}
                  {c === "ALL" ? "All Categories" : meta!.label}
                </button>
              );
            })}
          </div>
        </GlassCard>
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
                <p className="font-medium">No expenses found</p>
                <p className="text-sm text-muted-foreground">
                  {isAdmin
                    ? "Add your first expense to start tracking spending."
                    : "There are no expenses in this category yet."}
                </p>
              </div>
            </div>
          </GlassCard>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              <StaggerGroup className="space-y-3">
                {filtered.map((exp) => (
                  <StaggerItem key={exp.id}>
                    <ExpenseCard
                      expense={exp}
                      canDelete={isAdmin}
                      onDelete={() => setDeleteTarget(exp)}
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
                    <TableHead className="pl-4">Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Paid To</TableHead>
                    {isAdmin && <TableHead className="text-right pr-4">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((exp) => (
                    <TableRow key={exp.id} className="border-border/40">
                      <TableCell className="pl-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{exp.title}</span>
                          {exp.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">
                              {exp.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            CATEGORY_META[exp.category].className
                          )}
                        >
                          {CATEGORY_META[exp.category].icon}
                          {CATEGORY_META[exp.category].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatINR(exp.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(exp.expenseDate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {exp.paidTo || "—"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right pr-4">
                          <GlassButton
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(exp)}
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </GlassButton>
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

      {/* Add Expense Sheet */}
      <AddExpenseSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(payload) => addMutation.mutate(payload)}
        loading={addMutation.isPending}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Permanently delete{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.title}
                  </span>{" "}
                  ({formatINR(deleteTarget.amount)})? This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
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
  suffixLabel,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "danger" | "info";
  prefix?: string;
  suffixLabel?: string;
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
      {suffixLabel && (
        <p className="text-[11px] text-muted-foreground mt-1">{suffixLabel}</p>
      )}
    </GlassCard>
  );
}

function ExpenseCard({
  expense,
  canDelete,
  onDelete,
}: {
  expense: Expense;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const meta = CATEGORY_META[expense.category];
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className="glass rounded-3xl p-4 relative overflow-hidden"
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: meta.colorVar }}
      />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{expense.title}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" />
            {formatDate(expense.expenseDate)}
          </p>
        </div>
        <Badge variant="outline" className={cn("rounded-full", meta.className)}>
          {meta.icon}
          {meta.label}
        </Badge>
      </div>
      <div className="flex items-end justify-between">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase">Amount</p>
          <p className="text-2xl font-bold tabular-nums">
            {formatINR(expense.amount)}
          </p>
        </div>
        {expense.paidTo && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase">Paid To</p>
            <p className="text-sm font-medium truncate max-w-[140px]">
              {expense.paidTo}
            </p>
          </div>
        )}
      </div>
      {expense.description && (
        <p className="mt-3 text-xs text-muted-foreground glass-soft rounded-2xl p-2.5 line-clamp-2">
          {expense.description}
        </p>
      )}
      {canDelete && (
        <div className="mt-3 flex justify-end">
          <GlassButton
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </GlassButton>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add Expense Sheet
// ─────────────────────────────────────────────────────────────

function AddExpenseSheet({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: {
    title: string;
    amount: number;
    category: ExpenseCategory;
    expenseDate: string;
    paidTo?: string;
    description?: string;
  }) => void;
  loading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("GROCERY");
  const [date, setDate] = useState(today);
  const [paidTo, setPaidTo] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setTitle("");
    setAmount("");
    setCategory("GROCERY");
    setDate(today);
    setPaidTo("");
    setDescription("");
    setErrors({});
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 2) next.title = "Title is required";
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) next.amount = "Enter a valid amount";
    if (!date) next.date = "Date is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({
      title: title.trim(),
      amount: amt,
      category,
      expenseDate: new Date(date).toISOString(),
      paidTo: paidTo.trim() || undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <PencilLine className="h-5 w-5 text-primary" />
            Add Expense
          </SheetTitle>
          <SheetDescription>
            Record a new operational expense. It will be visible immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
          <GlassInput
            label="Title"
            placeholder="e.g. Monthly groceries"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            icon={<Receipt />}
          />

          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Amount (₹)"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errors.amount}
              icon={<IndianRupee />}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground ml-1">
                Category
              </label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger className="w-full h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              Date
            </label>
            <GlassInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={errors.date}
              icon={<Calendar />}
            />
          </div>

          <GlassInput
            label="Paid To (optional)"
            placeholder="Vendor / Person"
            value={paidTo}
            onChange={(e) => setPaidTo(e.target.value)}
            icon={<User />}
          />

          <GlassTextarea
            label="Description (optional)"
            placeholder="Add any notes about this expense…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40 flex-row gap-2">
          <GlassButton
            variant="ghost"
            className="flex-1"
            onClick={() => handleClose(false)}
          >
            Cancel
          </GlassButton>
          <GlassButton
            className="flex-1"
            onClick={handleSubmit}
            loading={loading}
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </GlassButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

