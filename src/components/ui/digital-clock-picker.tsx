"use client";

import * as React from "react";
import { Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────

/** Parse a "HH:mm" (24-hour) string into { hour24, minute }. */
function parse24(value: string): { hour24: number; minute: number } {
  const safe = value && /^\d{1,2}:\d{2}$/.test(value) ? value : "08:00";
  const [h, m] = safe.split(":").map(Number);
  return {
    hour24: ((h % 24) + 24) % 24,
    minute: ((m % 60) + 60) % 60,
  };
}

/** Convert 24-hour → 12-hour display parts. */
function to12(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

/** Convert 12-hour → 24-hour. */
function to24(hour12: number, period: "AM" | "PM"): number {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return h;
}

/** Format "HH:mm" → "h:mm AM/PM" for display. */
function formatDisplay(value: string): string {
  const { hour24, minute } = parse24(value);
  const { hour12, period } = to12(hour24);
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export interface DigitalClockPickerProps {
  /** "HH:mm" in 24-hour format. */
  value: string;
  /** Receives "HH:mm" (24-hour). */
  onChange: (v: string) => void;
  label?: string;
  error?: string;
  className?: string;
  /** Optional id for label association. */
  id?: string;
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
}

export function DigitalClockPicker({
  value,
  onChange,
  label,
  error,
  className,
  id,
  ariaLabel,
}: DigitalClockPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"hour" | "minute">("hour");

  const { hour24, minute } = parse24(value);
  const { hour12, period } = to12(hour24);

  const commit = (next: {
    hour12?: number;
    minute?: number;
    period?: "AM" | "PM";
  }) => {
    const h12 = next.hour12 ?? hour12;
    const m = next.minute ?? minute;
    const p = next.period ?? period;
    const h24 = to24(h12, p);
    onChange(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const triggerId = React.useId();
  const labelId = label ? `${triggerId}-label` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          id={labelId}
          htmlFor={id ?? triggerId}
          className="ml-1 block text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id ?? triggerId}
            aria-label={ariaLabel ?? label ?? "Pick a time"}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "group relative flex h-10 w-full items-center justify-between gap-2 rounded-2xl px-3 text-left text-sm",
              "glass cursor-pointer outline-none transition-all",
              "hover:bg-glass-strong/60 focus-visible:ring-2 focus-visible:ring-primary/40",
              error && "ring-1 ring-destructive/60"
            )}
          >
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="font-medium tabular-nums">
                {formatDisplay(value)}
              </span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              24h
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className={cn(
            "w-[280px] max-w-[calc(100vw-2rem)] p-0",
            "rounded-3xl border-glass-border glass-strong"
          )}
        >
          <ClockFace
            hour12={hour12}
            minute={minute}
            period={period}
            tab={tab}
            onTabChange={setTab}
            onHour={(h) => commit({ hour12: h })}
            onMinute={(m) => commit({ minute: m })}
            onPeriod={(p) => commit({ period: p })}
            onDone={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>

      {error && <p className="ml-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Clock face (digital grid)
// ─────────────────────────────────────────────────────────────

interface ClockFaceProps {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
  tab: "hour" | "minute";
  onTabChange: (t: "hour" | "minute") => void;
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
  onPeriod: (p: "AM" | "PM") => void;
  onDone: () => void;
}

function ClockFace({
  hour12,
  minute,
  period,
  tab,
  onTabChange,
  onHour,
  onMinute,
  onPeriod,
  onDone,
}: ClockFaceProps) {
  // Round display minute to nearest 5 to keep UI consistent with grid steps.
  const displayMinute = Math.round(minute / 5) * 5 % 60;

  return (
    <div className="flex flex-col">
      {/* Header — live time readout */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {hour12}
          </span>
          <span className="text-2xl font-semibold tabular-nums text-muted-foreground">
            :
          </span>
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {String(displayMinute).padStart(2, "0")}
          </span>
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            {period}
          </span>
        </div>
        <button
          type="button"
          onClick={onDone}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold",
            "bg-primary text-primary-foreground shadow-sm transition-transform",
            "hover:scale-[1.03] active:scale-95"
          )}
        >
          <Check className="size-3.5" />
          Done
        </button>
      </div>

      {/* AM / PM toggle */}
      <div className="px-4 pb-3">
        <div className="glass-soft inline-flex rounded-full p-1">
          {(["AM", "PM"] as const).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPeriod(p)}
                aria-pressed={active}
                className={cn(
                  "h-7 flex-1 rounded-full px-4 text-xs font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hour / Minute tabs */}
      <div className="px-4 pb-2">
        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as "hour" | "minute")}
        >
          <TabsList className="glass-soft h-9 w-full rounded-xl">
            <TabsTrigger value="hour" className="rounded-lg">
              Hour
            </TabsTrigger>
            <TabsTrigger value="minute" className="rounded-lg">
              Minute
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hour" className="mt-3">
            <Grid>
              {HOURS.map((h) => {
                const active = h === hour12;
                return (
                  <GridButton
                    key={h}
                    active={active}
                    onClick={() => onHour(h)}
                    ariaLabel={`${h} o'clock`}
                  >
                    {h}
                  </GridButton>
                );
              })}
            </Grid>
          </TabsContent>

          <TabsContent value="minute" className="mt-3">
            <Grid>
              {MINUTES.map((m) => {
                const active = m === displayMinute;
                return (
                  <GridButton
                    key={m}
                    active={active}
                    onClick={() => onMinute(m)}
                    ariaLabel={`${String(m).padStart(2, "0")} minutes`}
                  >
                    {String(m).padStart(2, "0")}
                  </GridButton>
                );
              })}
            </Grid>
          </TabsContent>
        </Tabs>
      </div>

      <div className="px-4 pb-4 pt-1 text-center text-[10px] text-muted-foreground/70">
        5-minute steps · returns 24-hour format
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Grid primitives
// ─────────────────────────────────────────────────────────────

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {children}
    </div>
  );
}

function GridButton({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "h-10 rounded-2xl text-sm font-semibold tabular-nums transition-all duration-150",
        "glass-soft hover:scale-[1.04] active:scale-95",
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-foreground hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

export default DigitalClockPicker;
