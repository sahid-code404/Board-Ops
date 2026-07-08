"use client";

import * as React from "react";
import { Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// ─────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────

function parse24(value: string): { hour24: number; minute: number } {
  const safe = value && /^\d{1,2}:\d{2}$/.test(value) ? value : "08:00";
  const [h, m] = safe.split(":").map(Number);
  return { hour24: ((h % 24) + 24) % 24, minute: ((m % 60) + 60) % 60 };
}

function to12(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24(hour12: number, period: "AM" | "PM"): number {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return h;
}

function formatDisplay(value: string): string {
  const { hour24, minute } = parse24(value);
  const { hour12, period } = to12(hour24);
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export interface DigitalClockPickerProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  error?: string;
  className?: string;
  id?: string;
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
  const { hour24, minute } = parse24(value);
  const { hour12, period } = to12(hour24);

  const commit = (next: { hour12?: number; minute?: number; period?: "AM" | "PM" }) => {
    const h12 = next.hour12 ?? hour12;
    const m = next.minute ?? minute;
    const p = next.period ?? period;
    const h24 = to24(h12, p);
    onChange(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const triggerId = React.useId();

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id ?? triggerId} className="ml-1 block text-xs font-medium text-muted-foreground">
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
              <span className="font-medium tabular-nums">{formatDisplay(value)}</span>
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[240px] max-w-[calc(100vw-2rem)] p-0 rounded-3xl border-glass-border glass-strong"
        >
          <AlarmClockFace
            hour12={hour12}
            minute={minute}
            period={period}
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
// Alarm-clock face
// ─────────────────────────────────────────────────────────────

function AlarmClockFace({
  hour12, minute, period, onHour, onMinute, onPeriod, onDone,
}: {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
  onPeriod: (p: "AM" | "PM") => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-bold tabular-nums">{hour12}</span>
          <span className="text-2xl font-bold text-muted-foreground">:</span>
          <span className="text-2xl font-bold tabular-nums">{String(minute).padStart(2, "0")}</span>
          <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{period}</span>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold bg-primary text-primary-foreground shadow-sm hover:scale-[1.03] active:scale-95 transition-transform"
        >
          <Check className="size-3.5" />
          Done
        </button>
      </div>

      {/* Wheels */}
      <div className="flex gap-2 px-3 pb-1">
        <Wheel items={HOURS} selected={hour12} onSelect={onHour} ariaLabel="Hour" />
        <div className="flex items-center justify-center pb-2">
          <span className="text-2xl font-bold text-muted-foreground/30">:</span>
        </div>
        <Wheel
          items={MINUTES}
          selected={minute}
          onSelect={onMinute}
          formatItem={(m) => String(m).padStart(2, "0")}
          ariaLabel="Minute"
        />
      </div>

      {/* Selection highlight bars */}
      <div className="px-3 pb-2">
        <div className="relative h-12 rounded-xl bg-primary/8 border border-primary/15 pointer-events-none -mt-14 z-0" />
      </div>

      {/* AM / PM */}
      <div className="px-3 pb-3 -mt-1">
        <div className="glass-soft inline-flex w-full rounded-full p-1">
          {(["AM", "PM"] as const).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPeriod(p)}
                aria-pressed={active}
                className={cn(
                  "h-8 flex-1 rounded-full text-xs font-bold transition-all",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Wheel — scrollable list with CSS scroll-snap
// ─────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48; // px — bigger for easier touch targets

function Wheel({
  items,
  selected,
  onSelect,
  formatItem,
  ariaLabel,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  formatItem?: (v: number) => string;
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Scroll to selected when component mounts or selected changes
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(selected);
    if (idx >= 0) {
      // Direct set — no smooth scroll for initial positioning
      el.scrollTop = idx * ITEM_HEIGHT;
    }
  }, [selected, items]);

  // Handle scroll end → snap to nearest + fire onSelect
  const scrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const target = clamped * ITEM_HEIGHT;
      if (el.scrollTop !== target) {
        el.scrollTo({ top: target, behavior: "smooth" });
      }
      if (items[clamped] !== selected) {
        onSelect(items[clamped]);
      }
    }, 80);
  }, [items, selected, onSelect]);

  React.useEffect(() => {
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      className="flex-1 overflow-y-auto rounded-xl snap-y snap-mandatory"
      style={{
        height: ITEM_HEIGHT * 3, // show 3 items
        scrollPaddingTop: ITEM_HEIGHT,
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style>{`{::-webkit-scrollbar{display:none}}`}</style>
      <div ref={(el) => { if (el) el.style.setProperty('scrollbar-width', 'none'); }}>
        <div style={{ height: ITEM_HEIGHT }} /> {/* top pad */}
        {items.map((v) => {
          const active = v === selected;
          return (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onSelect(v);
                ref.current?.scrollTo({ top: items.indexOf(v) * ITEM_HEIGHT, behavior: "smooth" });
              }}
              className={cn(
                "w-full snap-center flex items-center justify-center transition-all duration-150 rounded-lg",
                active
                  ? "text-primary text-2xl font-bold scale-110"
                  : "text-muted-foreground/40 text-xl font-semibold hover:text-foreground"
              )}
              style={{ height: ITEM_HEIGHT }}
            >
              {formatItem ? formatItem(v) : v}
            </button>
          );
        })}
        <div style={{ height: ITEM_HEIGHT }} /> {/* bottom pad */}
      </div>
    </div>
  );
}

export default DigitalClockPicker;
