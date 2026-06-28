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
  PencilLine,
  Search,
  ChevronLeft,
  ChevronRight,
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
  | "GENERAL"
  | "CUSTOM";

type Expense = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
  expenseDate: string;
  paidTo: string | null;
  status: string;
  user: { name: string } | null;
};

type ApiResponse<T> = { success: boolean; data: T; error?: string };

/** Payload sent to POST /api/expenses and PUT /api/expenses/[id]. */
type ExpensePayload = {
  title: string;
  category: string;
  quantity: number;
  unit: string;
  amount: number;
  description?: string;
  expenseDate: string;
};

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
  CUSTOM: {
    label: "Custom",
    icon: <Plus className="h-3.5 w-3.5" />,
    className: "bg-primary/15 text-primary border-primary/30",
    colorVar: "var(--primary)",
    chartColor: "var(--primary)",
  },
};

const CATEGORY_ORDER: ExpenseCategory[] = [
  "GROCERY",
  "UTILITIES",
  "SALARY",
  "MAINTENANCE",
  "GENERAL",
  "CUSTOM",
];

const UNIT_OPTIONS = ["piece", "kg", "gm", "litre", "metre", "box", "dozen"];

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Safely get category metadata — returns GENERAL meta for unknown/custom categories. */
function getCatMeta(cat: string) {
  return CATEGORY_META[cat as ExpenseCategory] || {
    label: cat.charAt(0) + cat.slice(1).toLowerCase(),
    icon: <Boxes className="h-3.5 w-3.5" />,
    className: "bg-muted text-muted-foreground border-border",
    colorVar: "var(--muted-foreground)",
    chartColor: "var(--muted-foreground)",
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format quantity + unit for display (e.g. "5 kg", "2 piece"). */
function formatQuantity(qty: number, unit: string): string {
  if (!qty && !unit) return "";
  if (!unit) return String(qty);
  if (!qty) return unit;
  return `${qty} ${unit}`;
}

/** An expense is locked when its status is LOCKED or it belongs to a past month. */
function isExpenseLocked(expense: Expense): boolean {
  if (expense.status === "LOCKED") return true;
  const expDate = new Date(expense.expenseDate);
  const now = new Date();
  const expYM = expDate.getFullYear() * 12 + expDate.getMonth();
  const todayYM = now.getFullYear() * 12 + now.getMonth();
  return expYM < todayYM;
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function ExpensesView() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN" || false;
  const qc = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const r = await api.get<ApiResponse<Expense[]>>("/expenses", {
        params: { month: selectedMonth, year: selectedYear, limit: 500 },
      });
      return r.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: (payload: ExpensePayload) =>
      api.post<ApiResponse<Expense>>("/expenses", payload),
    onSuccess: () => {
      toast.success("Expense added successfully");
      closeForm();
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add expense"),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayload }) =>
      api.put<ApiResponse<Expense>>(`/expenses/${id}`, payload),
    onSuccess: () => {
      toast.success("Expense updated successfully");
      closeForm();
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update expense"),
  });

  function openAddForm() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEditForm(exp: Expense) {
    setEditTarget(exp);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  function handleSubmit(payload: ExpensePayload, id?: string) {
    if (id) {
      editMutation.mutate({ id, payload });
    } else {
      addMutation.mutate(payload);
    }
  }

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

  // KPIs + breakdown — data is already filtered by selected month from the API
  const { totalThisMonth, byCategory, count } = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const byCat: Record<string, number> = {};
    expenses.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    });
    return {
      totalThisMonth: total,
      byCategory: byCat,
      count: expenses.length,
    };
  }, [expenses]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (categoryFilter !== "ALL") {
      result = result.filter((e) => e.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.paidTo || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, categoryFilter, search]);

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
      {/* Month picker — centered, spreaded */}
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

      {/* Action bar */}
      {isAdmin && (
        <StaggerItem>
          <div className="flex items-center justify-end gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Track & manage operational expenses
            </p>
            <GlassButton
              size="lg"
              onClick={openAddForm}
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
            label={`Total Expenses · ${new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "short" })}`}
            value={totalThisMonth}
            icon={<Wallet className="h-5 w-5" />}
            color="primary"
            prefix="₹"
          />
          <KpiCard
            label="Total Entries"
            value={count}
            icon={<Receipt className="h-5 w-5" />}
            color="info"
          />
        </div>
      </StaggerItem>

      {/* Top Categories — horizontal bars sorted high to low */}
      <StaggerItem>
        <GlassCard className="p-4 md:p-6" hover={false}>
          <h3 className="font-semibold mb-4">Top Categories <span className="text-xs font-normal text-muted-foreground ml-1">· {new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span></h3>
          <div className="space-y-3">
            {(() => {
              const sorted = Object.entries(byCategory)
                .map(([cat, amount]) => ({ cat, amount }))
                .filter((x) => x.amount > 0)
                .sort((a, b) => b.amount - a.amount);
              if (sorted.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">No expenses this month</p>;
              }
              const maxAmount = sorted[0].amount;
              return sorted.map(({ cat, amount }) => {
                const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                const meta = getCatMeta(cat);
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

      {/* Search + Filters */}
      <StaggerItem>
        <div className="space-y-3">
          <GlassInput
            placeholder="Search by title, category, vendor, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search />}
          />
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(() => {
              // Build list: ALL + predefined categories (except CUSTOM) + any custom categories from expenses
              const predefined = CATEGORY_ORDER.filter((c) => c !== "CUSTOM");
              const customCats = [...new Set(expenses.map((e) => e.category))].filter(
                (c) => !CATEGORY_ORDER.includes(c as ExpenseCategory)
              );
              const allCats = ["ALL", ...predefined, ...customCats] as const;
              return allCats.map((c) => {
              const active = categoryFilter === c;
              const meta = c === "ALL" ? null : getCatMeta(c);
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
              });
            })()}
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
                      canManage={isAdmin}
                      onEdit={() => openEditForm(exp)}
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
                    <TableHead className="pl-4">Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Date</TableHead>
                    {isAdmin && <TableHead className="text-right pr-4">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((exp) => {
                    const locked = isExpenseLocked(exp);
                    return (
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
                              getCatMeta(exp.category).className
                            )}
                          >
                            {getCatMeta(exp.category).icon}
                            {getCatMeta(exp.category).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {formatQuantity(exp.quantity, exp.unit) || "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatINR(exp.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(exp.expenseDate)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right pr-4">
                            {locked ? (
                              <Badge
                                variant="outline"
                                className="rounded-full bg-muted/60 text-muted-foreground border-border/60"
                              >
                                🔒 Locked
                              </Badge>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <GlassButton
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditForm(exp)}
                                  aria-label="Edit expense"
                                >
                                  <PencilLine className="h-4 w-4" />
                                </GlassButton>
                                <GlassButton
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(exp)}
                                  aria-label="Delete expense"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </GlassButton>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </GlassCard>
          </>
        )}
      </StaggerItem>

      {/* Add/Edit Expense Sheet */}
      <ExpenseFormSheet
        open={formOpen}
        onOpenChange={(o) => !o && closeForm()}
        onSubmit={handleSubmit}
        loading={addMutation.isPending || editMutation.isPending}
        expense={editTarget}
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
  canManage,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = getCatMeta(expense.category);
  const locked = isExpenseLocked(expense);
  const qty = formatQuantity(expense.quantity, expense.unit);
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
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase">Cost</p>
          <p className="text-2xl font-bold tabular-nums">
            {formatINR(expense.amount)}
          </p>
        </div>
        {qty && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase">Qty</p>
            <p className="text-sm font-semibold tabular-nums">{qty}</p>
          </div>
        )}
      </div>
      {expense.description && (
        <p className="mt-3 text-xs text-muted-foreground glass-soft rounded-2xl p-2.5 line-clamp-2">
          {expense.description}
        </p>
      )}
      {canManage && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {locked ? (
            <Badge
              variant="outline"
              className="rounded-full bg-muted/60 text-muted-foreground border-border/60"
            >
              🔒 Locked
            </Badge>
          ) : (
            <>
              <GlassButton variant="ghost" size="sm" onClick={onEdit}>
                <PencilLine className="h-3.5 w-3.5" />
                Edit
              </GlassButton>
              <GlassButton
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </GlassButton>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add / Edit Expense Sheet
// ─────────────────────────────────────────────────────────────

function ExpenseFormSheet({
  open,
  onOpenChange,
  onSubmit,
  loading,
  expense,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: ExpensePayload, id?: string) => void;
  loading: boolean;
  expense: Expense | null;
}) {
  // A `key` based on the editing target forces the body to remount whenever
  // the user switches between add / edit / a different expense. Combined with
  // the Sheet unmounting its content when closed, this means each open starts
  // with fresh state initialized from the `expense` prop — no useEffect sync
  // needed (which would trigger cascading renders per the react-hooks rule).
  const bodyKey = expense ? `edit-${expense.id}` : "add";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0"
      >
        <ExpenseFormBody
          key={bodyKey}
          expense={expense}
          onSubmit={onSubmit}
          loading={loading}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function ExpenseFormBody({
  expense,
  onSubmit,
  loading,
  onCancel,
}: {
  expense: Expense | null;
  onSubmit: (payload: ExpensePayload, id?: string) => void;
  loading: boolean;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!expense;

  // Derive initial category (predefined or CUSTOM) from the expense.
  const initialCategory: ExpenseCategory = (() => {
    if (!expense?.category) return "GROCERY";
    if (
      CATEGORY_ORDER.includes(expense.category as ExpenseCategory) &&
      expense.category !== "CUSTOM"
    ) {
      return expense.category as ExpenseCategory;
    }
    return "CUSTOM";
  })();
  const initialCustomCategory =
    initialCategory === "CUSTOM" ? expense?.category ?? "" : "";

  // Derive initial unit (predefined or CUSTOM) from the expense.
  const initialUnit: string = (() => {
    if (!expense?.unit) return "piece";
    if (UNIT_OPTIONS.includes(expense.unit)) return expense.unit;
    return "CUSTOM";
  })();
  const initialCustomUnit = initialUnit === "CUSTOM" ? expense?.unit ?? "" : "";

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(
    expense?.amount ? String(expense.amount) : ""
  );
  const [quantity, setQuantity] = useState(
    expense?.quantity ? String(expense.quantity) : ""
  );
  const [category, setCategory] = useState<ExpenseCategory>(initialCategory);
  const [customCategory, setCustomCategory] = useState(initialCustomCategory);
  const [unit, setUnit] = useState<string>(initialUnit);
  const [customUnit, setCustomUnit] = useState(initialCustomUnit);
  const [date, setDate] = useState(
    expense
      ? new Date(expense.expenseDate).toISOString().slice(0, 10)
      : today
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 2) next.title = "Item name is required";
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) next.amount = "Enter a valid cost";
    if (!date) next.date = "Date is required";
    if (category === "CUSTOM" && customCategory.trim().length < 2) {
      next.customCategory = "Enter a custom category name";
    }
    const qty = quantity ? parseFloat(quantity) : 0;
    if (quantity && (!qty || qty <= 0)) next.quantity = "Enter a valid quantity";
    if (unit === "CUSTOM" && customUnit.trim().length < 1) {
      next.customUnit = "Enter a custom unit";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const finalCategory =
      category === "CUSTOM"
        ? customCategory.trim().toUpperCase().replace(/\s+/g, "_")
        : category;
    const finalUnit = unit === "CUSTOM" ? customUnit.trim() : unit;

    onSubmit(
      {
        title: title.trim(),
        amount: amt,
        category: finalCategory,
        quantity: qty || 0,
        unit: finalUnit,
        expenseDate: new Date(date).toISOString(),
        description: description.trim() || undefined,
      },
      isEdit ? expense!.id : undefined
    );
  }

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-2">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <PencilLine className="h-5 w-5 text-primary" />
          {isEdit ? "Edit Expense" : "Add Expense"}
        </SheetTitle>
        <SheetDescription>
          {isEdit
            ? "Update the details of this expense."
            : "Record a new operational expense. It will be visible immediately."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
        <GlassInput
          label="Item"
          placeholder="e.g. Monthly groceries"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          icon={<Receipt />}
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
          {category === "CUSTOM" && (
            <GlassInput
              placeholder="Enter custom category name…"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              error={errors.customCategory}
              icon={<PencilLine className="h-4 w-4" />}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GlassInput
            label="Quantity"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={errors.quantity}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              Unit
            </label>
            <Select value={unit} onValueChange={(v) => setUnit(v)}>
              <SelectTrigger className="w-full h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
            {unit === "CUSTOM" && (
              <GlassInput
                placeholder="Enter custom unit…"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                error={errors.customUnit}
                icon={<PencilLine className="h-4 w-4" />}
              />
            )}
          </div>
        </div>

        <GlassInput
          label="Cost (₹)"
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

        <GlassTextarea
          label="Notes (optional)"
          placeholder="Add any notes about this expense…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <SheetFooter className="px-6 py-4 border-t border-border/40 flex-row gap-2">
        <GlassButton variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </GlassButton>
        <GlassButton
          className="flex-1"
          onClick={handleSubmit}
          loading={loading}
        >
          {isEdit ? (
            <PencilLine className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isEdit ? "Save Changes" : "Add Expense"}
        </GlassButton>
      </SheetFooter>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
