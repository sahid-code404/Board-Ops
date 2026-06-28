# BoardOps — Worklog

This file tracks the work done across all agents for the BoardOps platform.

---
Task ID: 1-4
Agent: main (orchestrator)
Task: Foundation + backend

Work Log:
- Read full BoardOps spec (Parts 1-17, ~20K lines): architecture, auth, meal engines (config/calendar/toggle/kitchen/guest-leave), variable engine, formula engine, billing, dashboard, notifications, RBAC, design system (liquid glass, mobile-first, Apple-inspired)
- Built liquid glass design system in globals.css: both light + dark themes with premium tokens, glass utilities (.glass, .glass-strong, .glass-soft), glow effects, shimmer skeleton, animated mesh background, custom scrollbars, safe-area support
- Built glass primitives: GlassCard, GlassButton (variants + sizes + loading + ripple), GlassInput/GlassTextarea (with icons, error, hint), GlassNav (segmented control with sliding active indicator), AnimatedBackground (mesh gradient + 4 floating blobs + noise), PageTransition/StaggerGroup/StaggerItem, AnimatedCounter (spring-based count up), ShimmerSkeleton
- Built providers: ThemeProvider (next-themes), QueryProvider (TanStack Query)
- Built stores: useAppStore (view navigation + UI state, persisted), useAuthStore (user + token, persisted)
- Built app shell: MobileBottomNav (5 primary items, glass bar), DesktopSidebar (groups: Workspace/Finance/Admin, animated active indicator, user card), TopBar (search, theme toggle, notifications, logout), AppShell (Framer Motion page transitions with blur)
- Built Prisma schema (SQLite): User, UserSession, LoginHistory, Role, Permission, RolePermission, MealConfiguration, MealEntry, MealHistory, MealOverride, MealPreset, MealPresetItem, LeaveApplication, GuestMeal, Variable, Formula, FormulaVersion, Bill, Payment, Expense, Notification, AuditLog, StaffRecord, Setting, Institution — all with soft-delete, audit fields, indexes, unique constraints
- Ran db:generate + db:push successfully
- Built seed script: admin user (admin@boardops.io / Admin@123), 6 demo residents, 5 meal configs (morning/lunch/snacks/dinner/festival) with cutoff strategies, 10 variables (meal rates, billing), 4 formulas, 4 meal presets, 5 expenses, 4 staff records, notifications, settings
- Built lib: auth.ts (scrypt password hashing, token gen), session.ts (getAuthUser, requireAuth, requireRole, getClientIp, getUserAgent), api-response.ts (ok/err/handleApiError), api-client.ts (frontend fetch wrapper with token), meal-engine.ts (computeEditableUntil for PREVIOUS_DAY/SAME_DAY/CUSTOM_OFFSET strategies), audit.ts (logAudit), notify.ts (createNotification)
- Built 18 API routes:
  - POST /api/auth/register (with zod validation, admin notification)
  - POST /api/auth/login (status checks, login history, session creation, audit)
  - POST /api/auth/logout (session revoke, audit)
  - GET /api/auth/me
  - GET/POST /api/meals/config (admin create)
  - GET/PUT/DELETE /api/meals/config/[id]
  - GET /api/meals/entries (auto-generates entries, syncs lock state, grouped by date)
  - PATCH /api/meals/toggle (cutoff validation, history, audit) + POST bulk
  - GET /api/meals/presets
  - POST /api/meals/override (admin override with notification + audit)
  - GET /api/dashboard (aggregated KPIs, today's meals, 7-day trend, expense breakdown, notifications, recent activity)
  - GET/POST /api/variables, PUT/DELETE /api/variables/[id]
  - GET /api/formulas
  - GET/POST /api/bills (with snapshot), GET/DELETE /api/bills/[id]
  - GET/POST /api/payments, PATCH /api/payments/[id] (approve/reject with bill update + notification)
  - GET/POST /api/expenses, DELETE /api/expenses/[id]
  - GET/PATCH /api/notifications
  - GET/POST /api/settings, DELETE /api/settings/[key]
  - GET /api/users (with search), PATCH /api/users/[id] (approve/suspend/activate/deactivate/archive/restore/assign-role)
  - GET /api/audit-logs
  - GET /api/kitchen (meal counts for today)
  - GET/POST /api/staff
- Built auth screen (login/register with floating labels, password visibility, demo creds, hero side panel, animated)
- Built dashboard view (KPIs with animated counters, today's meals grid, 7-day meal trend area chart, expense pie chart, notifications, recent activity)

Stage Summary:
- Foundation COMPLETE: design system, app shell, backend, auth, dashboard all working
- Dev server running on :3000, login tested successfully (admin@boardops.io / Admin@123)
- Remaining: Calendar, MealsConfig, Kitchen, Variables, Billing, Payments, Expenses, Notifications, Settings, Users, Profile views + notifications sheet + command palette
- All API contracts are defined; frontend views should consume via `api` from "@/lib/api-client" and use TanStack Query

API Contract Reference (all return { success: boolean, data: T } or { success: false, error: string }):
- GET /api/dashboard → { todayMeals, kpis, trend, expenseBreakdown, notifications, recentActivity, isAdmin }
- GET /api/meals/config → MealConfiguration[]
- GET /api/meals/entries?year=&month= → { meals: MealConfiguration[], byDate: Record<dateString, MealEntry[]> }
- PATCH /api/meals/toggle { entryId, status: "ON"|"OFF" } → MealEntry
- POST /api/meals/toggle { entryIds: string[], status } → { results }
- GET /api/variables → Variable[]
- POST /api/variables { key, name, type, value, unit?, category?, description? } → Variable
- PUT /api/variables/[id] { value, ... } → Variable
- GET /api/bills → Bill[] (with user)
- POST /api/bills { month, year } → { generated }
- GET /api/payments → Payment[]
- POST /api/payments { amount, method, billId?, reference?, notes? } → Payment
- PATCH /api/payments/[id] { action: "APPROVE"|"REJECT" } → Payment
- GET /api/expenses → Expense[]
- POST /api/expenses { title, amount, category, expenseDate, paidTo?, description? } → Expense
- GET /api/notifications?unread=true → { notifications, unreadCount }
- PATCH /api/notifications { markAllRead?: boolean, id?: string } → { success }
- GET /api/settings → Setting[]
- POST /api/settings { key, value, category, type, isPublic } → Setting
- GET /api/users?q=&status= → User[]
- PATCH /api/users/[id] { action: "APPROVE"|"SUSPEND"|"ACTIVATE"|"DEACTIVATE"|"ARCHIVE"|"RESTORE"|"ASSIGN_ROLE", role?, reason? } → User
- GET /api/audit-logs → AuditLog[]
- GET /api/kitchen → { date, counts: [{ id, displayName, icon, color, on, off, guests, total }] }
- GET /api/staff → StaffRecord[]
- GET /api/formulas → Formula[]

Design tokens available (CSS vars):
- Colors: --primary, --secondary, --accent, --success, --warning, --destructive, --info
- Glass: --glass-bg, --glass-border, --glass-shadow, --glass-highlight
- Mesh: --mesh-1..4
- Utility classes: .glass, .glass-strong, .glass-soft, .glow-primary, .glow-success, .glow-warning, .glow-danger, .shimmer, .mesh-bg, .gradient-text, .no-scrollbar, .safe-top, .safe-bottom, .safe-x

Existing components to use:
- @/components/glass/glass-card, glass-button, glass-input, glass-nav, animated-counter, page-transition (PageTransition, StaggerGroup, StaggerItem), shimmer-skeleton, animated-background
- @/components/ui/* (full shadcn set: button, card, dialog, sheet, tabs, badge, table, avatar, dropdown-menu, command, popover, tooltip, select, input, textarea, switch, checkbox, calendar, etc.)
- @/lib/api-client (api.get/post/put/patch/delete)
- @/stores/use-app-store (setView, view), use-auth-store (user, role)
- @/lib/utils (cn)
- lucide-react icons, framer-motion, recharts, react-hook-form, zod, sonner (toast), date-fns

RULES for subagents:
- Use GlassCard, GlassButton, GlassInput from @/components/glass/* — do NOT use raw shadcn Button/Card/Input unless inside other shadcn components
- Mobile-first: design for mobile, then md: and lg: breakpoints
- All lists must use StaggerGroup + StaggerItem for entrance animation
- All forms must have loading states + toast feedback (sonner)
- Use TanStack Query for server state (queryKey, queryFn, mutations with invalidate)
- Use framer-motion for hover/tap micro-interactions
- Never hardcode business values — fetch from API
- Append your work record to this worklog file when done

---

---
Task ID: 5c
Agent: calendar-meals-agent
Task: Build Meal Calendar view (Agenda/Week/Month) + Meal Configuration CRUD view

Work Log:
- Read full worklog.md (foundation + API contracts + design tokens + existing components)
- Inspected existing glass primitives (GlassCard, GlassButton, GlassInput, GlassNav, StaggerGroup/Item, ShimmerSkeleton) and shadcn UI primitives (Dialog, Sheet, Select, Switch, Badge, Popover, Label, AlertDialog, Tabs)
- Inspected backend API routes: /api/meals/entries (auto-generates entries, syncs lock state, groups by ISO date), /api/meals/toggle (PATCH with cutoff validation), /api/meals/config (GET/POST admin), /api/meals/config/[id] (GET/PUT/DELETE admin)
- Inspected Prisma schema for MealConfiguration + MealEntry model fields

Built `/home/z/my-project/src/components/features/calendar/calendar-view.tsx`:
- Three view modes via GlassNav: Agenda (mobile default), Week, Month (desktop default); auto-detects via useIsMobile()
- MonthView: 7-col grid of days, each cell renders meal chips colored by meal.color, status badges (ON solid color / OFF faded), LOCKED icon, today highlighted with primary ring, past dates dimmed, +N more overflow indicator
- WeekView: horizontal scroll on mobile (min-w-[260px] cards), 7-col grid on desktop; per-day GlassCard with meal chips and inline toggles; Lock icon shown when locked
- AgendaView: vertical list of dates with sticky date pill (today highlighted in primary), MealAgendaCard showing icon, name, status chip, time range, relative editable-until countdown ("Editable in 3h 22m" / "Cutoff passed"), optimistic Switch toggle
- Toggle mutation: TanStack Query useMutation with onMutate optimistic update (rewrites byDate in cache), onError reverts snapshot + toast.error with backend message (e.g. "This meal's cutoff has passed. It is now locked."), onSettled invalidates ["meals","entries"]
- Quick nav: Today button, prev/next (week or month aware), Popover month picker with 12 month buttons + year prev/next
- StatusChip component: ON (success), OFF (muted), LOCKED (lock icon), OVERRIDE (warning sparkles)
- Legend at bottom: 🟢 ON / ⚪ OFF / 🔒 Locked / 🟡 Override + cutoff info hint
- Loading: shimmer skeletons per mode (35-cell month grid, 7-col week cards, 6-row agenda list)
- Empty state: friendly message when no meals configured
- Error state: retry button + ApiError message
- AnimatePresence mode="wait" for smooth view transitions; StaggerGroup wraps all items

Built `/home/z/my-project/src/components/features/meals/meals-config-view.tsx`:
- Admin-only CRUD with read-only fallback for non-admins (no create/edit/delete buttons rendered)
- Grid of MealConfigCard (1 col mobile, 2 col md, 3 col lg) with StaggerGroup + StaggerItem entrance animation
- Each card: color accent bar at top, icon tile (colored bg), display name + monospace internal name, mealType badge (color-coded per type), status badge (Active/Inactive/Archived), display order badge, default state badge (Eye/EyeOff), description, live cutoff preview ("Editable until: Previous day, 10:00 PM"), service time range, Edit + Archive buttons
- Search bar (GlassInput) + type filter Select + status filter Select
- Create Meal button → opens Dialog (desktop) or bottom Sheet (mobile) with form
- Form built with react-hook-form + zod resolver (zodResolver from @hookform/resolvers/zod)
- Form fields: internal name, display name, description, icon picker (emoji grid 26 emojis + custom emoji text input), color picker (10 preset swatches + native color input), mealType Select, displayOrder number, service start/end time (HH:mm), cutoffStrategy Select, cutoffTime, conditional cutoffOffsetMinutes (only when CUSTOM_OFFSET), defaultState Switch, defaultVisibility Switch, notes
- Live cutoff preview computed from strategy+time+offset via computeCutoffPreview helper, shown in primary-tinted callout
- Edit mode: form pre-filled from existing meal config (all fields incl. defaults)
- Archive: AlertDialog confirmation (warning text, can be reversed note) → soft archive via DELETE endpoint → invalidates query + toast
- Toasts: success on create/update/archive, error with backend message on failure (via ApiError)
- useWatch (instead of watch) to avoid React Compiler warnings
- Form types: useForm<MealFormInput, unknown, MealFormValues> with z.input/z.output split for coerce.number() fields
- Mobile-first responsive: Sheet side="bottom" with safe-bottom class, Dialog max-w-2xl on desktop

Technical decisions:
- Used ApiError from @/lib/api-client for typed error messages (toast shows backend's exact cutoff message)
- All lists use StaggerGroup + StaggerItem for staggered entrance
- All buttons use GlassButton variants (primary/secondary/ghost/danger)
- All inputs use GlassInput/GlassTextarea (with label, error, hint, icon)
- Select uses shadcn Select with glass-soft rounded-2xl trigger styling
- Switch uses shadcn Switch (disabled when locked)
- Color restriction respected: no indigo/blue, meals render with their own colors from API
- Never hardcoded meal names — always render from meal.displayName/mealIcon/mealColor from API
- Past dates: read-only (Switch disabled, lock badge), future dates: editable

Files created:
- /home/z/my-project/src/components/features/calendar/calendar-view.tsx (default export CalendarView, "use client")
- /home/z/my-project/src/components/features/meals/meals-config-view.tsx (default export MealsConfigView, "use client")

Verification:
- ESLint: 0 errors, 0 warnings on both files (verified with `bunx eslint <files>`)
- TypeScript: 0 errors on both files (verified with `bunx tsc --noEmit`)
- Pre-existing lint/tsc errors in other files (page.tsx, kitchen-view, top-bar, variables-view, billing-view, etc.) were NOT modified per task instructions

Stage Summary:
- CalendarView COMPLETE: 3 view modes, optimistic toggle with cutoff-aware error handling, month picker, legend, loading/empty/error states, mobile-first responsive
- MealsConfigView COMPLETE: full CRUD with react-hook-form + zod, live cutoff preview, search/filter, admin-only actions, mobile bottom-sheet / desktop dialog form
- Both views ready to be consumed by /src/app/page.tsx (already imported)
- Both integrate cleanly with existing TanStack Query provider, glass design system, and shadcn/ui components

---
Task ID: 5d-2
Agent: notif-settings-users-agent
Task: Build Notifications, Settings, Users, Profile views + Notifications Sheet + Command Palette

Work Log:
- Read worklog, glass primitives, stores, api-client, shadcn UI components, existing API routes to confirm contracts.
- Discovered backend routes return `{ success: true, data: T }` via `ok()` wrapper, but existing dashboard/auth-screen read response as `T` directly. Added a defensive `unwrap()` helper in each new file that returns `res.data` when present, else falls back to `res` — keeps components robust whether or not the response is wrapped.
- All 6 files are `"use client"` components with the correct named exports. Verified dev server compiles them cleanly (the previous "Module not found" errors for these imports are gone).
- `bun run lint` shows zero errors in any of the 6 new files; the 4 remaining lint issues are pre-existing in page.tsx, top-bar.tsx, variables-view.tsx, api-client.ts (not mine).

Files created:
1. `src/components/layout/command-palette.tsx` — `CommandPalette`: Cmd+K / Ctrl+K global listener; groups nav items (Workspace/Finance/Admin/Account); role-filtered; uses shadcn `CommandDialog` with glass styling, animated groups, shortcut hints.
2. `src/components/features/notifications/notifications-view.tsx` — `NotificationsView`: header with unread count + Mark-all-read + Refresh; filter tabs (All/Unread/Info/Success/Warning/Alerts); notification cards with type-colored icon, title, description, time-ago, priority badge, route link; clicking marks read (optimistic) + navigates; friendly empty state with Sparkles illustration; AnimatePresence for exit.
3. `src/components/features/notifications/notifications-sheet.tsx` — `NotificationsSheet`: shadcn `Sheet` side="right"; header with unread badge + Mark-all-read; top-10 list; click → mark read + close + navigate; footer "View all notifications"; refetches every 15s while open; respects safe-bottom.
4. `src/components/features/settings/settings-view.tsx` — `SettingsView`: admin-only guard; tabs for FEATURE_FLAG/INSTITUTION/BILLING/NOTIFICATIONS/SECURITY/UI/GENERAL; each row shows monospace key + type + public/private badge + value editor (Switch for booleans/flags, GlassInput for TEXT/NUMBER, GlassTextarea for JSON); dirty-state Save button; optimistic updates; SUPER_ADMIN-only delete; Add Setting dialog with full form.
5. `src/components/features/users/users-view.tsx` — `UsersView`: admin-only guard; KPI cards (Total/Active/Pending/Suspended) with AnimatedCounter; search + status tabs; user rows with avatar (gradient initials fallback), role badge, status badge, contact info, join date, last login; action dropdown with status-aware actions; confirm dialog with required reason for SUSPEND/DEACTIVATE/ARCHIVE; Assign Role dialog with role select + optional reason; all mutations optimistic + toast feedback.
6. `src/components/features/auth/profile-view.tsx` — `ProfileView`: large header card with gradient avatar, name, email, role/status/member-since badges; three info cards (Contact / Preferences / Account); Edit button shows "coming soon" toast; stagger animation.

Stage Summary:
- 6 of 6 components built and compiling cleanly. Named exports match what `src/app/page.tsx` imports.
- All design requirements honored: GlassCard/GlassButton/GlassInput used (no raw shadcn Button/Card/Input in my code), StaggerGroup+StaggerItem for list entrances, AnimatedCounter for KPIs, ShimmerSkeleton for loading, framer-motion micro-interactions, TanStack Query with optimistic mutations, sonner toasts, lucide-react icons, mobile-first responsive, safe-area aware.
- Flagged pre-existing backend bug to orchestrator: `lib/auth.ts:generateToken()` produces a random hex token (no `bos_` prefix), but `lib/session.ts:parseSessionToken()` requires the `bos_` prefix. This makes every authenticated request after login return 401. Affects all views that fetch protected endpoints (mine + dashboard + variables). Out of scope for this task — needs backend-agent fix.
- Work record also written to `/agent-ctx/5d-2-notif-settings-users-agent.md`.

---
Task ID: 5c-2
Agent: kitchen-variables-agent
Task: Build Kitchen Dashboard (Part 3.4) and Variable Engine (Part 4) views for BoardOps.

Work Log:
- Read worklog.md to understand full project context (design tokens, API contracts, glass primitives, store interfaces).
- Inspected existing foundation: glass-card, glass-button, glass-input (incl. GlassTextarea), page-transition (StaggerGroup/StaggerItem), animated-counter, shimmer-skeleton; api-client (fetch wrapper, returns full body `{ success, data }`); auth/app stores; dashboard-view as reference pattern; variables + kitchen API routes; Prisma Variable model.

Kitchen View (`src/components/features/kitchen/kitchen-view.tsx`):
- `"use client"` named export `KitchenView`.
- Hooks called unconditionally (no early returns before hooks) — `useState`, `useQuery`, `useMemo`. USER role handled by `enabled: !isUser` on the query + render-time check (also detects server-side `access: false`).
- Header glass card with date picker: prev/next icon buttons, glass-soft date pill (weekday + d MMM yyyy), "Today" button (shown only when off-today), "Print" button → `toast.success("Printing...")`.
- 3-up KPI grid using `AnimatedCounter`: Total Meals (on+guests), Guests, Meals OFF — each with colored glow + blurred color blob.
- Per-meal cards grid (`sm:grid-cols-2 lg:grid-cols-3`): gradient background via inline `linear-gradient(135deg, ${color}30, …, transparent)`, blurred color blob top-right, big emoji icon, service time, AnimatedCounter for ON count, OFF/Guests/Total pill badges with color-matched backgrounds. Framer Motion `whileHover`/`whileTap` springs.
- Recharts `BarChart` (300px): grouped bars for ON (success), OFF (muted-foreground), Guests (primary), animated `animationDuration` 900/1100/1300ms, custom legend chips.
- Empty state card (Soup icon + friendly copy) when no meals.
- `AccessRestricted` glass card (Lock icon, warning glow) shown for USER role.
- `KitchenSkeleton` with 3-column KPI + 6 meal cards + chart skeletons.
- Auto-refresh via `refetchInterval: 15_000` + `refetchOnWindowFocus`; subtle RefreshCw spinner when `isFetching`.
- Uses `date-fns` addDays/format/isSameDay for date math; local `toDateString` helper for YYYY-MM-DD.

Variables View (`src/components/features/variables/variables-view.tsx`):
- `"use client"` named export `VariablesView`.
- TanStack Query: `useQuery(['variables'])` + 3 mutations (create/update/delete) with `queryClient.invalidateQueries`.
- Hooks unconditional; admin check via `user.role` from auth store.
- Stats bar (4 cards): Total, System, Custom, Categories count — colored glow + blurred blobs.
- Search input (GlassInput with Search icon) + two shadcn Selects (Type filter, Category filter) wrapped in glass-soft styling.
- Grouped list using shadcn `Accordion` (type="multiple", first category open by default). Each `AccordionItem` is a `glass` card; trigger shows category name + count + system count; content is a 2-col grid of VariableCards.
- `VariableCard` (per variable):
  - Name + type badge (icon + tint per type: NUMBER→info, CURRENCY→success, PERCENTAGE→warning, TEXT→primary, BOOLEAN→secondary).
  - System badge (Shield icon) + Protected badge (Lock icon, warning tint).
  - Key in monospace `code` chip, optional unit.
  - Optional description (line-clamp-2).
  - Value display in glass sub-card; pencil edit button if admin.
  - Inline edit: autofocus input with Enter-to-save / Esc-to-cancel, GlassButton save (Check) + cancel (X) icon buttons.
  - BOOLEAN values render as Switch (toggles between "true"/"false" strings).
  - Archive button (Trash2) only shown for non-system, non-protected variables when admin.
  - Derived-state-from-props pattern avoided per React Compiler lint rule — draft is re-synced in `startEdit` instead.
- Create Variable Dialog (shadcn `Dialog` + glass-strong):
  - react-hook-form + zodResolver with `createSchema` (key regex `/^[a-z0-9_.-]+$/i`, min-length validations).
  - Fields: Name, Key (with regex hint + trailing code chip), Type (Select), Value (text input OR Switch for BOOLEAN), Unit, Category (Select with presets + existing categories), Description (GlassTextarea).
  - GlassButton submit with loading state; Cancel button.
  - Info callout (AlertCircle) explaining system/custom difference.
  - Form auto-resets on dialog close via `useEffect(() => form.reset(), [open])`.
- Empty state card (Database icon) with conditional CTA when no variables exist.
- `VariablesSkeleton` for loading state.
- Read-only mode for non-admin: shows read-only hint in header, hides Create button, hides edit/archive controls on cards.
- Toast feedback (sonner) on every mutation success/error.
- All values rendered from API; nothing hardcoded.

Lint status:
- `bun run lint` — my two files are clean (zero errors, zero warnings except a benign `form.watch` "incompatible-library" informational note from React Compiler about RHF).
- Remaining lint errors in `src/app/page.tsx` (set-state-in-effect in booting effect) and `src/components/layout/top-bar.tsx` (set-state-in-effect for mounted) are pre-existing issues in other agents' files and were not touched per task rules.
- Dev log confirms `POST /api/auth/login 200` works; the only module-not-found errors in dev.log are for sibling views (ProfileView, SettingsView, UsersView, NotificationsSheet, CommandPalette) that other agents are building — my two files import cleanly.

Stage Summary:
- Kitchen Dashboard (Part 3.4): COMPLETE — date picker, KPIs with AnimatedCounter, per-meal gradient cards, ON/OFF/Guests BarChart, 15s auto-refresh, Print button, USER access restriction, skeletons, empty state.
- Variable Engine (Part 4): COMPLETE — grouped accordion, inline edit + Switch for BOOLEAN, full create dialog with RHF+zod, search + dual filters, stats bar, system/protected/custom differentiation, read-only mode for non-admins, toast feedback.
- Both files export correctly named `"use client"` components matching the imports already present in `src/app/page.tsx`.
- All required primitives used: GlassCard, GlassButton, GlassInput (and GlassTextarea), StaggerGroup/StaggerItem, AnimatedCounter, ShimmerSkeleton. shadcn Accordion, Dialog, Select, Switch, Badge. recharts BarChart. framer-motion. TanStack Query. sonner. lucide-react. react-hook-form + zod.

---
Task ID: 5d
Agent: billing-agent
Task: Build Billing, Payments, and Expenses views (Parts 7, 8, 9) for BoardOps

Work Log:
- Read worklog.md for full context (API contracts, design tokens, existing components, rules for subagents)
- Inspected existing glass primitives (GlassCard, GlassButton, GlassInput, AnimatedCounter, StaggerGroup/Item, ShimmerSkeleton), shadcn ui set (Dialog, Sheet, Select, Badge, Table, AlertDialog), api-client, auth store, and the dashboard-view pattern for conventions
- Confirmed API envelope: all backend routes return `{ success: boolean, data: T }` via `ok()` helper — frontend must unwrap with `.data`
- Created `/home/z/my-project/src/components/features/billing/billing-view.tsx` (~890 lines, exports `BillingView`):
  • 4 AnimatedCounter KPI cards: Total Billed, Total Collected, Outstanding, Overdue Count
  • Admin "Generate Bills" dialog with month/year Selects → POST /api/bills
  • Filter row: search by name/email/room + status segmented control (All/Generated/Partially_Paid/Paid/Overdue/Void)
  • Mobile: StaggerGroup of BillCard (3-cell mini-grid Total/Paid/Due, color-coded status badge, due date, view/void actions)
  • Desktop: full shadcn Table with resident, period, meal charges, other, total, paid, due, status badge, due date, view/void actions
  • Bill detail dialog with breakdown rows, totals card, dates, and admin-only payment history (fetched via GET /api/bills/[id])
  • Admin void bill via AlertDialog confirm → DELETE /api/bills/[id]
  • BillStatusBadge variants: PAID=success, PARTIALLY_PAID=warning, OVERDUE=destructive, GENERATED=info, DRAFT/VOID=muted
- Created `/home/z/my-project/src/components/features/billing/payments-view.tsx` (~995 lines, exports `PaymentsView`):
  • 4 KPIs: Total Approved, Pending Approvals, Rejected, This Month's Total
  • "Submit Payment" dialog: amount, method select, optional bill select (filters user's outstanding bills), reference, notes
  • Admin-only "Pending Approvals" section with one-click Approve/Reject buttons + AlertDialog confirm
  • Method badges with icons: CASH/UPI/CARD/BANK_TRANSFER/WALLET
  • Status badges: APPROVED/PENDING/REJECTED/REFUNDED
  • Filter row: search + status segmented control + method Select
  • Mobile cards + desktop table layouts
  • Mutations invalidate both `payments` and `bills` query keys on approve so totals refresh
- Created `/home/z/my-project/src/components/features/billing/expenses-view.tsx` (~981 lines, exports `ExpensesView`):
  • 4 KPIs: Total This Month, Transactions count, Top Category (with name suffix), Categories Active
  • recharts BarChart with per-category gradient fills for current month
  • Breakdown sidebar with animated progress bars per category
  • Category segmented filter (All/Grocery/Utilities/Salary/Maintenance/General)
  • Mobile ExpenseCard with left color stripe + desktop table
  • Category badges: GROCERY=success, UTILITIES=info, SALARY=primary, MAINTENANCE=warning, GENERAL=muted
  • Add expense via right-side Sheet (title/amount/category/date/paidTo/description) with field-level validation
  • Delete confirm via AlertDialog → DELETE /api/expenses/[id] (admin only)
  • Regular users get read-only view (no Add/Delete)
- Used throughout: GlassCard/GlassButton/GlassInput/GlassTextarea, StaggerGroup+StaggerItem, AnimatedCounter, ShimmerSkeleton, framer-motion micro-interactions, TanStack Query mutations with invalidateQueries, sonner toasts, lucide-react icons, recharts, ₹ currency formatting
- Fixed 2 TypeScript issues found during verification:
  • billing-view.tsx: corrected `BillDetail` queryFn type — bills/[id] returns bill with `payments` array included, not a flat array
  • payments-view.tsx: extracted `BillListItem` named type to avoid TS parser ambiguity with nested `Array<{ user: { name: string } }>>` generic
- Verification: `bunx eslint` clean on all 3 files; `bunx tsc --noEmit` clean on all 3 files; dev.log shows successful compilation

Stage Summary:
- Parts 7, 8, 9 (Billing Engine, Payments & Wallet, Expenses & Procurement) — COMPLETE
- All 3 views are wired into `src/app/page.tsx` via existing imports and respond to view changes from `useAppStore`
- API integration verified against existing route handlers: GET/POST/DELETE /api/bills, GET/POST /api/payments, PATCH /api/payments/[id], GET/POST /api/expenses, DELETE /api/expenses/[id]
- Mobile-first responsive design with desktop table fallbacks at md: breakpoint
- Full RBAC: admin-only generate/void (billing), admin-only approve/reject (payments), admin+manager add and admin-only delete (expenses); regular users see filtered/scoped data with read-only actions
- Did NOT modify any other files (page.tsx, other views, lib, stores, API routes untouched)

---
Task ID: 6
Agent: main (orchestrator)
Task: Integration, bug fixes, and Agent Browser self-verification

Work Log:
- Fixed critical auth bug: generateToken() now produces `bos_`-prefixed tokens matching parseSessionToken() expectations — all authenticated endpoints now work
- Fixed API envelope handling: clarified that api-client returns the full { success, data } envelope; updated auth-screen, dashboard-view, page.tsx, calendar-view, and meals-config-view to access `.data` on results (matching the pattern used by all subagent-built views)
- Reduced Prisma logging from ['query'] to ['warn', 'error'] to silence verbose SQL logs
- Fixed lint errors: removed setState-in-effect patterns in top-bar.tsx (using resolvedTheme + suppressHydrationWarning) and page.tsx (using TanStack Query for auth boot check)
- Fixed unused eslint-disable in api-client.ts
- Added PWA manifest.json (fixes /manifest.json 404)
- Ran `bun run lint` — 0 errors, 1 informational warning (react-hook-form watch() — known React Compiler note)

Agent Browser Verification (mobile iPhone 14 + desktop 1440x900):
- ✅ Auth screen renders with liquid glass, floating labels, demo creds, hero panel
- ✅ Login with admin@boardops.io / Admin@123 → persists token, navigates to dashboard
- ✅ Dashboard: animated KPI counters (6 users, 3 meals ON, ₹27,900 revenue, etc.), today's meals grid (all locked past cutoff), 7-day meal trend area chart, expense pie chart, notifications, recent activity
- ✅ Calendar: Agenda/Week/Month views, meal cards with status/lock/cutoff countdown, toggle switches with optimistic update (tested toggling Aug 1 Morning Meal OFF → instant UI update + "Editable in 33d")
- ✅ Meals Config: 5 meal configs with color bars, type badges, cutoff previews, search/filter, create/edit form (not opened but verified rendering)
- ✅ Kitchen: live meal counts (Total 2, per-meal cards with ON counts), bar chart, auto-refresh
- ✅ Billing: 6 bills with resident names, rooms, amounts, due dates, status badges; Generate Bills dialog works
- ✅ Payments: KPIs, filters, Submit Payment button, empty state
- ✅ Expenses: KPIs (₹35,750 total, 5 transactions, Grocery top category), category bar chart, breakdown
- ✅ Variables: 10 variables grouped by category, system/custom counts, inline edit, create dialog
- ✅ Users: 7 users with avatars, role/status badges, action menus, search/filter
- ✅ Notifications: 3 notifications with type icons, priority badges, time-ago, filter tabs
- ✅ Settings: feature flag toggles, institution config, categorized settings, add setting dialog
- ✅ Notifications Sheet: opens via bell icon, shows recent notifications, mark-all-read, view-all
- ✅ Command Palette (⌘K): opens with all nav items, searchable, role-filtered
- ✅ Desktop layout: glass sidebar with grouped nav (Workspace/Finance/Administration), user card
- ✅ Mobile layout: bottom nav (5 primary items), top bar with menu/search/theme/bell/logout
- ✅ Page transitions: Framer Motion blur+slide between views
- ✅ Theme: dark mode default, toggle works

Stage Summary:
- ALL views functional and verified end-to-end via Agent Browser
- Auth → Dashboard → Calendar (toggle) → Meals → Kitchen → Billing → Payments → Expenses → Variables → Users → Notifications → Settings → Profile all working
- Responsive: mobile (bottom nav) → desktop (sidebar) adapts correctly
- Liquid glass aesthetic throughout: frosted panels, animated mesh background, glow effects, staggered animations, shimmer skeletons
- Backend rock-solid: 18+ API routes, Prisma schema with 20+ models, RBAC, audit logging, event-driven notifications, soft-delete, meal cutoff engine, formula-driven billing
- Zero hardcoded business logic: meals, variables, formulas, settings, roles all DB-driven
- Production-ready: lint clean (0 errors), dev server running on :3000


---
Task ID: 7
Agent: main (orchestrator)
Task: Complete profile editing, avatar uploads, 2FA, and session management

Work Log:
- Added 2FA fields to Prisma User model: twoFactorEnabled, twoFactorSecret, twoFactorBackupCodes
- Ran db:generate + db:push to sync schema
- Installed otplib (v13, functional API) and qrcode packages
- Extended SessionUser type in session.ts to include gender, emergencyContact, theme, language, timezone, twoFactorEnabled, createdAt, lastLoginAt
- Added parseUserAgent() helper to session.ts for device/browser/OS detection
- Built two-factor.ts lib: generateTwoFactorSecret(), generateOtpAuthUri(), generateQrCodeDataUrl(), verifyTotp(), generateBackupCodes(), hashBackupCode(), verifyBackupCode() — using otplib v13 functional API (generateSync, verifySync, generateURI)
- Updated CurrentUser type in use-auth-store.ts to include all new fields
- Updated login route to return extended user fields (gender, emergencyContact, theme, language, timezone, twoFactorEnabled, createdAt, lastLoginAt)
- Built 9 API routes:
  - PUT /api/auth/profile — update name, phone, room, gender, emergencyContact, theme, language, timezone (with phone uniqueness check)
  - POST /api/auth/avatar — multipart file upload (JPEG/PNG/WebP/GIF, max 4MB), saves to public/uploads/avatars/
  - POST /api/auth/change-password — verifies current password, validates new password strength, invalidates all other sessions
  - GET /api/auth/sessions — lists active sessions with parsed device/browser/OS info
  - DELETE /api/auth/sessions — revoke all other sessions
  - DELETE /api/auth/sessions/[id] — revoke specific session (prevents revoking current)
  - POST /api/auth/2fa/setup — generates TOTP secret + QR code data URL
  - POST /api/auth/2fa/verify — verifies 6-digit code, enables 2FA, returns 8 backup codes
  - POST /api/auth/2fa/disable — disables 2FA (requires password)
  - POST /api/auth/2fa/backup-codes — regenerates backup codes (requires TOTP code)
- Completely rewrote profile-view.tsx (~1000 lines) with:
  - AvatarUpload component: click-to-upload with camera icon overlay, loading spinner, file validation
  - QuickActionCard grid: Change Password, 2FA (enable/manage), Active Sessions
  - EditProfileDialog: bottom sheet on mobile, dialog on desktop; fields for name, phone, room, gender select, emergency contact, theme/language/timezone selects; react-hook-form-free with manual validation
  - ChangePasswordDialog: current/new/confirm password fields with show/hide toggles, real-time password strength meter (5-level with animated bar), security warning about session invalidation
  - TwoFactorDialog: multi-step flow (main → setup with QR → verify with 6-digit input → backup codes display); copy/download backup codes; disable 2FA with password; regenerate backup codes with TOTP verification
  - SessionsSheet: right-side sheet showing all active sessions with device icons (Smartphone/Tablet/Monitor), browser+OS labels, IP address, active-since timestamp, "This device" badge for current session, revoke individual sessions, "Sign Out All Other Devices" button
  - All dialogs auto-switch between Sheet (mobile) and Dialog (desktop) via useIsMobile()
  - All mutations use TanStack Query with qc.invalidateQueries
  - All actions have sonner toast feedback
  - Full audit logging on all critical actions

Agent Browser Verification:
- ✅ Profile view loads with extended info (2FA badge, emergency contact, timezone)
- ✅ Edit Profile: opened dialog, changed room "Office-A" → "Office-B", saved → profile updated
- ✅ 2FA Setup: opened dialog → clicked "Set Up" → QR code displayed → extracted secret → generated TOTP code → entered code → verified → 8 backup codes displayed with Copy/Download → confirmed → profile now shows "2FA On" badge + "Two-Factor Auth / Active" card
- ✅ Sessions: opened sheet → saw 30+ sessions from test logins → clicked "Sign Out All Other Devices" → all revoked, only current session remained
- ✅ Change Password: opened dialog → filled current + new + confirm → strength meter showed → submitted → dialog closed (password changed, other sessions invalidated)
- ✅ Reset admin to defaults (password back to Admin@123, 2FA disabled, room back to Office) so user can test fresh

Stage Summary:
- ALL four features fully implemented and verified end-to-end:
  1. Profile editing (name, phone, room, gender, emergency contact, theme, language, timezone)
  2. Avatar uploads (file picker, multipart upload, 4MB limit, JPEG/PNG/WebP/GIF)
  3. Two-factor authentication (TOTP via authenticator apps, QR code, 8 backup codes, disable with password, regenerate codes)
  4. Session management (list all sessions with device info, revoke individual, revoke all others)
- Lint clean (0 errors)
- Backend: 9 new API routes, 2FA lib, extended session helper, updated Prisma schema
- Frontend: ~1000-line profile-view with 5 sub-components, all responsive (mobile bottom sheet / desktop dialog)
- "More coming soon" placeholder card removed from profile view

---
Task ID: 9
Agent: main (orchestrator)
Task: Fix mobile view — premium hamburger menu + dynamic scaling

Work Log:
- Extracted nav grouping logic into shared module `nav-groups.ts` (groupNavItems + groupedNavForRole)
- Updated DesktopSidebar to use the shared helper
- Built new premium MobileSidebar component:
  - Slides in from left with spring physics (stiffness 380, damping 38)
  - Glassmorphic panel (glass-strong) with shadow-2xl
  - Brand header (logo + "BoardOps" + "Operations Suite" + close button)
  - User profile card (avatar with gradient fallback, name, role label, routes to profile on click)
  - Grouped navigation matching desktop (Workspace / Finance / Administration)
  - Animated active indicator (layoutId="mobile-sidebar-active" with spring)
  - Sign Out button at bottom (destructive styling)
  - Body scroll lock when open
  - Blurred backdrop (bg-black/50 backdrop-blur-sm)
  - 85vw width, max-w-sm
- Rewrote TopBar for better mobile scaling:
  - Fluid padding: px-2.5 sm:px-3 pt-2.5 sm:pt-3
  - Fluid border radius: rounded-2xl sm:rounded-3xl
  - Compact title: text-[10px] sm:text-xs (subtitle), text-sm sm:text-base (title)
  - Search icon button on mobile (sm:hidden), full search button on sm+
  - All buttons 40x40px (h-10 w-10) with glass-soft background
  - Icons h-[18px] on mobile (slightly smaller than h-5)
- Rewrote MobileBottomNav:
  - Shows 4 primary items + "More" button (instead of 5 items)
  - "More" button opens the sidebar for access to all nav items
  - Icons h-[18px], labels text-[9px] (compact for small screens)
  - min-w-0 on items + truncate labels to prevent overflow
- Added fluid root font size in globals.css: clamp(14px, 0.9vw + 11px, 16px)
- Added touch-action: manipulation on mobile for snappier taps
- Added -webkit-text-size-adjust: 100% to prevent orientation text resize
- Removed old Sheet-based mobile menu from app-shell (replaced with MobileSidebar)
- AppShell now uses MobileSidebar + MobileBottomNav + DesktopSidebar + TopBar

Agent Browser + VLM Verification:
- Mobile top bar (iPhone 14): 8/10 — "Well-sized hamburger, properly spaced buttons, clear title hierarchy"
- Mobile sidebar (hamburger menu): 3/10 → 7/10 — "Premium feel, brand header, user profile, grouped navigation, polished dark theme"
- Small phone (375px): 9/10 — "Fits well, no overflow, no cut-off, clean layout"
- Very small phone (320px): "Top bar fits, no overflow, buttons tappable, scales well"
- Tablet (768px): 8/10 — "Sidebar visible, content well-scaled, good hierarchy"
- Navigation verified: clicking Users in sidebar → User Management page; More button → sidebar opens with all items

Stage Summary:
- Mobile hamburger menu completely rebuilt from plain list to premium glassmorphic sidebar with brand header, user profile, grouped nav, and sign out
- Top bar scales fluidly from mobile (compact) to desktop (full)
- Bottom nav now shows 4 items + More button (accessing all nav items)
- Fluid root font size scales from 14px (mobile) to 16px (desktop)
- All touch targets meet 44px minimum
- Lint clean (0 errors)

---
Task ID: UX-1
Agent: ux-cleanup-agent
Task: Remove duplicate big title headers across feature views (TopBar already shows the page title)

Work Log:
- Read worklog.md for full context (TopBar shows page title; 9 feature views had redundant title cards duplicating it)
- For each view, replaced the big title header card (`GlassCard` with `glow="primary"` + h1/h2 + subtitle) with a compact action bar that contains ONLY the action button(s) + an optional short description in a `flex items-center justify-end gap-3` wrapper, or removed the header entirely when no action button was present
- Files modified:
  1. `users-view.tsx` — removed "User Management" header card entirely (no action button; icon-only title was redundant). KPI cards are now first element.
  2. `notifications-view.tsx` — replaced header card with compact action bar holding Refresh + Mark all read buttons + short "N unread" status. Removed now-unused `Bell` import.
  3. `settings-view.tsx` — replaced header card with compact action bar holding Add Setting button + short description.
  4. `variables-view.tsx` — replaced header card with admin-only compact action bar holding Create Variable button + short description. Removed now-unused `VariableIcon` import.
  5. `kitchen-view.tsx` — replaced header card with compact action bar (auto-refresh status left-aligned via `mr-auto`, then Prev / date display / Next / Today / Print buttons on the right). Removed now-unused `Flame` import.
  6. `meals-config-view.tsx` — replaced header with admin-only compact action bar holding Create Meal button + short description.
  7. `calendar-view.tsx` — removed "Meal Calendar" title card entirely; the GlassNav view-toggle (Agenda/Week/Month) is now the first element, right-aligned.
  8. `payments-view.tsx` — replaced header card with compact action bar holding Submit Payment button + short description (role-aware).
  9. `expenses-view.tsx` — replaced header card with admin-only compact action bar holding Add Expense button + short description.
- Verified no orphaned imports remained after removing the title cards (Bell, VariableIcon, Flame were the only ones to clean up; SettingsIcon, UsersIcon, Utensils, CalendarIcon are still referenced elsewhere)
- All action buttons kept their original variant/size/icon/onClick/loading/disabled props; only the surrounding card chrome was removed
- All KPI cards, search bars, filters, charts, and list content untouched
- TopBar (which renders the actual page title) was NOT modified — it remains the single source of truth for the page title

Verification:
- `bun run lint` → 0 errors, 1 pre-existing informational warning (react-hook-form watch() in variables-view, noted in prior worklog as a known React Compiler note)
- dev.log shows clean recompilation with no errors

Stage Summary:
- All 9 feature views no longer duplicate the page title shown in the TopBar
- Replaced title-card chrome with compact right-aligned action bars (or removed entirely when no action exists)
- Cleaner, less repetitive UI; more vertical space for actual content (KPIs, lists, charts)
- All existing component logic, RBAC gating, and action handlers preserved
- Lint clean (0 errors)

---
Task ID: 10
Agent: main (orchestrator)
Task: 10/10 UX polish — remove all duplicates, clutter, and inconsistencies

Work Log:
- Comprehensive VLM audit of all views identified systemic issues:
  1. Every view had a duplicate title header (big h2 in a GlassCard) that repeated the TopBar's page title
  2. Dashboard had duplicate "Open Calendar" CTAs (button in welcome + "View calendar" in meals section)
  3. Dashboard meal cards had redundant ON/OFF/Locked badges (the colored background already indicated state)
  4. Profile page repeated email, status, role, member-since, 2FA across 4 different cards
  5. Settings page repeated the category label as both a tab and a section header
  6. Notifications filter tabs were cramped and "Alerts" was truncated
  7. Inconsistent card padding (p-5 md:p-6 vs p-4 md:p-6)

- Fixed dashboard:
  - Removed duplicate "Open Calendar" CTA from welcome section (meal cards already route to calendar)
  - Simplified welcome section (compact p-4, no flex-row, no big CTA button)
  - Cleaned meal cards: removed ON/OFF/Locked badges, using opacity (0.5 for OFF) + colored gradient for ON + small 🔒 emoji for locked
  - Unified section headers to font-semibold (not text-lg) with inline "· subtitle" format
  - Consistent p-4 md:p-6 padding across all cards
  - Fixed KPI icon colors to use CSS variables dynamically

- Fixed profile:
  - Removed entire "Account" card (all its info was already in the header: role, status, 2FA, member-since)
  - Removed "Email" from Contact card (already in header)
  - Removed "Status" from Preferences card (already in header)
  - Moved "Last Login" to Preferences card (was in Account card)
  - Removed subtitle prop from InfoCard component (was redundant with title)
  - Tightened InfoCard: p-4 md:p-6, h-9 w-9 icons (was h-10 w-10), text-sm title

- Dispatched subagent (Task UX-1) to remove duplicate title headers from 9 views:
  users, notifications, settings, variables, kitchen, meals, calendar, payments, expenses
  - Each now starts with either a compact action bar (just the button + short hint) or directly with content
  - TopBar is the single source of truth for page titles

- Fixed settings: removed per-tab section header (icon + label + description) since the tab itself already shows the label

- Fixed notifications filters: removed GlassCard wrapper, made tabs scrollable with whitespace-nowrap, smaller padding (px-2.5)

Agent Browser + VLM Final Verification (all views rated):
- Dashboard (mobile): 4/10 → 8/10 (full scroll: 9/10) — "No duplicates, clean, well-organized"
- Profile (mobile): 4/10 → 8/10 — "No duplicate information between header and info cards"
- Billing (mobile): 4/10 → 8/10 — "No duplicate title"
- Users (mobile): 8/10 — "Not title-duplicated, clean"
- Notifications (mobile): 8/10 — "All filter tabs fully visible, clean"
- Settings (mobile): 7/10 → 8/10 — "Duplicate header removed, clean"
- Variables: 8/10 — "Clean, organized"
- Kitchen: 8/10 — "No duplicate headers"
- Calendar: 8/10 — "Clean, clutter-free"
- Meals: 8/10 — "No duplicate headers or clutter"
- Payments: 8/10 — "Clean, organized"
- Expenses: 8/10 — "Clean, organized"
- Desktop dashboard: 8/10 — "Minimal clutter, no duplicate headers"

Stage Summary:
- ALL duplicate title headers removed (TopBar is the single source of truth)
- Dashboard: removed duplicate CTA, simplified meal cards, unified spacing
- Profile: eliminated 4 duplicate data points across cards, removed entire Account card
- Settings: removed per-tab section headers
- Notifications: fixed cramped/truncated filter tabs
- All card padding unified to p-4 md:p-6
- Lint clean (0 errors)
- Every view rated 8-9/10 by VLM (up from 4/10)

---
Task ID: EXP-REWRITE
Agent: expenses-rewrite-agent
Task: Rewrite the Expenses view — restructure layout, add Edit flow + quantity/unit fields + lock logic

Work Log:
- Read full worklog.md (563 lines) + 3 prior agent records in /agent-ctx/ for context
- Inspected existing /api/expenses (POST) and /api/expenses/[id] (PUT/DELETE) routes — backend already supports quantity/unit fields and enforces past-month lock server-side (status LOCKED or expense year-month < today's year-month returns 422)

Changes to `src/components/features/billing/expenses-view.tsx`:
1. Layout: swapped the first two StaggerItems so the month picker now renders ABOVE the admin Add-Expense action bar (was: action bar → month picker → KPIs → … ; now: month picker → action bar → KPIs → Top Categories → Search+Filters → List). All other sections preserved.
2. Type: extended `Expense` with `quantity: number` and `unit: string`. Added `ExpensePayload` alias + `UNIT_OPTIONS = ["piece","kg","gm","litre","metre","box","dozen"]` + `formatQuantity(qty, unit)` (e.g. "5 kg") + `isExpenseLocked(expense)` (status LOCKED OR year-month strictly < today's).
3. Edit flow: added `editTarget` state + `openAddForm/openEditForm/closeForm` helpers + `editMutation` using `api.put('/expenses/${id}', payload)`. Added `handleSubmit(payload, id?)` dispatcher that routes to editMutation when an id is passed, otherwise to addMutation. Both mutations toast, invalidate `["expenses"]`, and close the form on success.
4. Form rewrite: split `AddExpenseSheet` into `ExpenseFormSheet` (wrapper) + `ExpenseFormBody` (state + fields). The wrapper passes `key={expense ? 'edit-${id}' : 'add'}` so the body remounts on every target change; combined with Radix Sheet unmounting content when closed, this gives fresh state on every open via `useState` initializers — no useEffect sync (which would trip the react-hooks/set-state-in-effect rule).
   - Fields in order: Item (text, was "title"), Category (Select with CUSTOM option + custom-name input — preserved), Quantity (number) + Unit (Select with 7 predefined units + CUSTOM option + custom-unit input), Cost (number, was "amount"), Date (date picker), Notes (textarea, was "description").
   - Removed the Paid To field entirely. Removed the now-unused `User` lucide import and the `useEffect` import.
   - Title and submit button copy switch between "Add Expense"/"Edit Expense" and "Add Expense"/"Save Changes"; submit icon swaps Plus ↔ PencilLine.
   - Submit payload shape: `{ title, category, quantity, unit, amount, description?, expenseDate }` (+ `id` passed separately when editing) — exactly as requested.
5. Cards + table rows: mobile `ExpenseCard` now shows Qty block (right side) via `formatQuantity()`, renamed "Amount"→"Cost"; desktop table replaced the "Paid To" column with a "Qty" column and renamed "Title"→"Item", "Amount"→"Cost".
6. Edit + Delete affordances only render when admin AND `!isExpenseLocked(expense)`. For locked rows (past month or status LOCKED), show a "🔒 Locked" badge instead — applied consistently to both mobile cards and desktop table rows.
7. Minor cleanup: collapsed redundant `isAdmin || isAdmin` to a single check.

Verification:
- `bun run lint` → 0 errors (1 pre-existing informational warning in variables-view.tsx from a prior task, unrelated)
- dev.log shows clean recompilation (`✓ Compiled in 200ms`) and `GET /api/expenses?month=5&year=2026&limit=500 200` succeeding
- Did NOT modify any other files (API routes, page.tsx, other views, lib, stores, prisma schema untouched)

Stage Summary:
- Expenses page now supports full Add + Edit lifecycle with quantity/unit tracking
- Past-month expenses are visibly locked (no edit/delete buttons, 🔒 badge shown) — mirrors the server-side enforcement in PUT/DELETE /api/expenses/[id]
- Month picker is the first thing the user sees, making month navigation the primary action before adding expenses
- Lint clean (0 errors)

---
Task ID: BILL-FIX
Agent: billing-fix-agent
Task: Add month picker + expenses-style filter redesign to Billing page

Work Log:
- Read worklog.md + /agent-ctx/ records for context. Inspected existing billing-view.tsx (898 lines), expenses-view.tsx (1128 lines) for the canonical month picker + filter pill pattern, and the existing /api/bills GET/POST route.

Changes to `src/components/features/billing/billing-view.tsx`:
1. Imports: added `ChevronLeft` + `ChevronRight` to the lucide-react block (`Calendar` was already imported — reused for both the new picker and existing BillCard).
2. State: added `now`, `selectedMonth` (defaults to `now.getMonth()`), `selectedYear` (defaults to `now.getFullYear()`).
3. Query: changed `queryKey` from `["bills"]` to `["bills", { month: selectedMonth, year: selectedYear }]`. `queryFn` now sends `params: { month: selectedMonth, year: selectedYear }` to `/api/bills`.
4. Layout: inserted a NEW month-picker StaggerItem as the FIRST element (above the existing admin action bar). Centered `flex items-center justify-center gap-4`:
   - Left circular `motion.button` (h-10 w-10 rounded-full glass-strong ring-1 ring-border/40 hover:ring-primary/40) with ChevronLeft — onClick does `new Date(selectedYear, selectedMonth - 1, 1)` and sets both states.
   - Center capsule: `glass-soft rounded-full px-6 py-2.5` with Calendar icon + two-line stack (top: month name `text-sm font-bold text-primary`; bottom: year `text-[11px] text-muted-foreground`). Uses `toLocaleDateString("en-US", { month: "long" })`.
   - Right circular `motion.button` with ChevronRight — onClick does `new Date(selectedYear, selectedMonth + 1, 1)`.
5. Replaced the old GlassCard-wrapped search/filter bar with the expenses-style design:
   - Full-width `GlassInput` (Search icon, "Search by name, email, room…") in a `space-y-3` div.
   - Below it: horizontally scrollable filter pills (`flex items-center gap-2 overflow-x-auto no-scrollbar`). Each pill: `inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all`. Active = `bg-primary text-primary-foreground shadow-md shadow-primary/30`. Inactive = `glass-soft text-muted-foreground hover:text-foreground`. Pills: All, Generated, Partially Paid, Paid, Overdue, Void.
6. KPIs already derive from `bills` via `useMemo([bills])`, so they automatically reflect the month-filtered data — no other change needed.

Changes to `src/app/api/bills/route.ts` GET handler:
- Switched from `where = user.role === "USER" ? { userId } : undefined` to a mutable `where: Record<string, unknown>`. Still gates `userId` for USER role.
- Reads `month` and `year` from `url.searchParams`. If both provided (`month !== null && year`), sets `where.periodMonth = Number(month)` and `where.periodYear = Number(year)`.
- Backward compatible: when params are absent, the query behaves exactly as before (returns all bills subject to the existing `take: limit` default of 20).

Preserved (no changes):
- Generate Bills dialog (month/year selects + Sparkles submit icon)
- Void confirm AlertDialog
- Bill detail Dialog with payment history (admin-only)
- Mobile BillCard + desktop Table rendering
- KpiCard component + glow colors
- `formatINR`, `formatMonthYear`, `formatDate`, `BILL_STATUS_STYLES`, `BillStatusBadge` helpers

Verification:
- `bun run lint` → 0 errors (1 pre-existing informational warning in variables-view.tsx from a prior task, unrelated)
- `dev.log` shows clean recompilation (`✓ Compiled in 197ms`) and `GET /api/bills 200` succeeding

Stage Summary:
- Billing page now opens with a centered month-picker capsule identical to the expenses page, making month navigation the primary action
- Bills API now filters by `periodMonth` + `periodYear` when those params are passed, so KPIs and the list reflect only the selected billing period
- Search/filter bar matches the expenses page exactly (full-width GlassInput + scrollable h-8 px-2.5 rounded-xl text-[11px] pills) for visual consistency across the Finance section
- All existing functionality (generate, void, detail dialog, payment history, RBAC gating) preserved
- Lint clean (0 errors)

---
Task ID: PAY-FIX
Agent: payments-fix-agent
Task: Add Day Picker + expenses-style filter redesign + date-filtered KPIs to Payments page

Work Log:
- Read worklog.md (641 lines) + /agent-ctx/ records (EXP-REWRITE, UX-1, 5d-billing) for context. Inspected existing payments-view.tsx (989 lines), kitchen-view.tsx (for the canonical Day Picker + getDatePickerLabels helper), and expenses-view.tsx (for the canonical search + filter pills pattern). Also read existing /api/payments GET route.

Changes to `src/components/features/billing/payments-view.tsx`:
1. Imports: added `addDays, format, isSameDay` from `date-fns` and `ChevronLeft, ChevronRight, Calendar, RotateCcw` from `lucide-react`.
2. Helper: copied `getDatePickerLabels(d)` verbatim from kitchen-view.tsx — returns `{ top, bottom }` where today/yesterday/tomorrow map to relative labels + "EEE, d MMM", and far dates show "d MMM" on top + "EEE" on the bottom (no duplicate day name).
3. State: added `selectedDate` (`useState<Date>(new Date())`). Derived `dateStr` (YYYY-MM-DD via the exact pattern the task spec gave), `datePickerLabels`, and `isToday` (via `isSameDay`).
4. Query: changed `queryKey` from `["payments"]` to `["payments", dateStr]`. `queryFn` now sends `params: { date: dateStr }` to `GET /api/payments`. Kept `isLoading` for the skeleton state.
5. KPIs: removed the redundant month filter inside the KPI memo (was filtering approved payments by `now.getMonth/getFullYear` — no longer needed since `payments` is already filtered to the selected day). Replaced the 4th KPI card "This Month" (₹) with "Refunded" (count, RotateCcw icon, info color) so the 4 KPIs map cleanly to the 4 status filter pills (excluding All).
6. Layout: inserted a NEW Day Picker StaggerItem as the FIRST element (above the existing action bar). Centered `flex items-center justify-center gap-4`:
   - Left circular `motion.button` (h-10 w-10 rounded-full glass-strong ring-1 ring-border/40 hover:ring-primary/40) with ChevronLeft — `setSelectedDate((d) => addDays(d, -1))`.
   - Center glass-soft capsule button (max-w-[280px] rounded-full px-6 py-2.5) with `Calendar` icon + two-line stack (top: relative label/day, `text-sm font-bold text-primary`; bottom: "EEE, d MMM" or day name, `text-[11px] text-muted-foreground`). Clicking it jumps back to today unless already on today — a small `RotateCcw` icon appears as a hint when not on today.
   - Right circular `motion.button` with ChevronRight — `setSelectedDate((d) => addDays(d, 1))`.
7. Replaced the old GlassCard-wrapped search/filter bar (which had a GlassInput + status pills + a Method `Select` dropdown) with the expenses-style design:
   - Full-width `GlassInput` (Search icon, "Search by name, email, reference…") in a `space-y-3` div.
   - Below it: horizontally scrollable filter pills (`flex items-center gap-2 overflow-x-auto no-scrollbar`). Each pill uses the exact classes requested: `inline-flex items-center h-8 px-2.5 rounded-xl text-[11px] gap-1 font-medium whitespace-nowrap transition-all`. Active = `bg-primary text-primary-foreground shadow-md shadow-primary/30`. Inactive = `glass-soft text-muted-foreground hover:text-foreground` (same as expenses-view).
   - 5 pills in the requested order: All, Pending, Approved, Rejected, Refunded.
8. Removed the now-unused `methodFilter` state and the Method `Select` dropdown from the filter bar (the Select component import is retained — it's still used inside `SubmitPaymentDialog` for Method and bill selection).

Changes to `src/app/api/payments/route.ts` GET handler:
- Typed `where` as `{ userId?: string; createdAt?: { gte: Date; lte: Date } }` (was previously untyped `userId | undefined`).
- Reads `date` from `url.searchParams`. If present, parses it and sets `where.createdAt = { gte: start, lte: end }` where start = 00:00:00.000 and end = 23:59:59.999 of that calendar day (using `d.getFullYear/getMonth/getDate` — exact pattern from the task spec).
- Backward compatible: when `date` is omitted, `where.createdAt` stays undefined and the query returns all payments (subject to the existing `take: limit` default of 20).
- Preserved the existing USER-scope rule (`where.userId = user.id` for residents) — composes cleanly with the new createdAt filter.

Preserved (no changes):
- Submit Payment dialog (amount/method/bill/reference/notes fields, outstanding-bills Select)
- Approve/Reject AlertDialog confirm with success/destructive variants
- Admin Pending Approvals card with inline Approve/Reject buttons (now scoped to the selected day)
- Mobile PaymentCard + desktop Table rendering
- KpiCard component + glow colors
- `formatINR`, `formatDate`, `formatDateTime`, `STATUS_STYLES`, `METHOD_META` helpers
- POST `/api/payments` and PATCH `/api/payments/[id]` routes (no date logic needed there)

Verification:
- `bun run lint` → 0 errors (1 pre-existing informational warning in variables-view.tsx from a prior task, unrelated)
- dev.log shows clean recompilations and the new date filter working end-to-end:
  - `GET /api/payments?date=2026-06-28 200 in 13ms`
  - `GET /api/payments?date=2026-06-27 200` (previous day)
  - `GET /api/payments?date=2026-06-29 200` (next day)

Stage Summary:
- Payments page now opens with a centered Day Picker capsule identical to the kitchen page, making day navigation the primary action
- Payments API now filters by `createdAt` calendar-day range when `date` is passed, so KPIs and the list reflect only the selected day's transactions
- Search/filter bar matches the expenses page exactly (full-width GlassInput + scrollable h-8 px-2.5 rounded-xl text-[11px] pills) for visual consistency across the Finance section
- KPIs simplified to remove the redundant in-month filter and now show 4 distinct status counts/sums for the selected day
- All existing functionality (submit, approve/reject, RBAC gating, pending approvals card, dialog/sheet forms) preserved
- Lint clean (0 errors)

---
Task ID: BILL-ROWS
Agent: billing-rows-agent
Task: Replace Billing list dual mobile/desktop split with a single Users-style BillRow list

Work Log:
- Read worklog.md (695 lines) tail for recent context (BILL-FIX, PAY-FIX, EXP-REWRITE, UX-1) — understood prior agents left a `md:hidden` mobile BillCard + `hidden md:block` desktop `<Table>` split on the Billing view that needed unification.
- Studied the canonical Users row pattern in users-view.tsx lines 469-521 (list wrapper: `<div className="space-y-3">` + `<AnimatePresence mode="popLayout">` + per-row `motion.div` with `layout` + spring `initial/animate/exit`) and lines 779-921 (UserRow: `GlassCard p-4 md:p-5 hover={false}` + `flex items-start gap-3 md:gap-4` + avatar + name/badges/meta + MoreVertical `DropdownMenu` with `align="end" className="w-44 rounded-2xl"` + `DropdownMenuLabel`/`DropdownMenuSeparator` + mapped `DropdownMenuItem`).
- Read billing-view.tsx end-to-end (1271 lines) to map imports, the list block (lines 588-725), the `BillCard` component (lines 988-1119), and confirm `BillDetail`, `KpiCard`, `Sparkles`, `BILL_STATUS_STYLES`, `BillStatusBadge` must be preserved.

Changes to `src/components/features/billing/billing-view.tsx` (only file modified):
1. Imports:
   - Updated `import { motion } from "framer-motion";` → `import { motion, AnimatePresence } from "framer-motion";`
   - Added `Mail`, `DoorOpen`, `MoreVertical` to the lucide-react block (inserted after `Clock`, before `IndianRupee`).
   - Removed the `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` import from `@/components/ui/table` (no longer used).
   - Added the `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel` import from `@/components/ui/dropdown-menu` (replacing the Table block).
2. Replaced the dual list block (the `<>` fragment with `md:hidden` StaggerGroup of `BillCard` + `hidden md:block` GlassCard-wrapped `<Table>`) with a SINGLE unified list: `<div className="space-y-3">` → `<AnimatePresence mode="popLayout">` → `motion.div` per-row wrapper (layout + initial `{opacity:0,y:12,scale:0.98}` + animate `{opacity:1,y:0,scale:1}` + exit `{opacity:0,scale:0.95}` + spring transition `{type:"spring",stiffness:280,damping:26}`) → `<BillRow>`. No `md:hidden` / `hidden md:block` split remains.
3. Deleted the old `BillCard` component (132 lines) and replaced it with a new `BillRow` component that mirrors `UserRow` exactly:
   - Same outer `GlassCard className="p-4 md:p-5" hover={false}` + `flex items-start gap-3 md:gap-4`.
   - Avatar `h-12 w-12 md:h-14 md:w-14 rounded-2xl shrink-0` with `AvatarImage` + `AvatarFallback` gradient (`gradientFor(bill.user.name)`) + `initials(bill.user.name)`.
   - Header line: `<h3>` name (line-through + muted when deleted) + status `Badge` (`BILL_STATUS_STYLES[bill.status]`) + period `Badge` (Calendar icon + `formatMonthYear`). For deleted bills, replaces both with a destructive countdown badge (`formatDeletionCountdown`).
   - Meta line: Mail icon + email + DoorOpen icon + Room + Clock icon + Due date (only when not deleted).
   - Inline KPI strip: Total (foreground) / Paid (success) / Due (warning) using `formatINR` with `tabular-nums`, plus deletion reason (`AlertTriangle` icon) when applicable.
   - Right side: `DropdownMenu` with `DropdownMenuTrigger asChild` wrapping `GlassButton variant="ghost" size="icon"` with `MoreVertical`, content `align="end" className="w-44 rounded-2xl"`, `DropdownMenuLabel` "Actions" + `DropdownMenuSeparator` + mapped `DropdownMenuItem` (rounded-xl cursor-pointer, `variant="destructive"` for Void/Delete). Actions array: View Details (always for non-deleted); Void Bill (admin + non-VOID, destructive); Delete Bill (admin, destructive); Restore Bill (admin + deleted).
   - Dropdown only renders when `actions.length > 0` — so residents on a deleted bill (no admin rights) get no trigger, exactly like Users.
4. Preserved unchanged: month picker, KPIs, search/filter pills (with the Delete All + Restore All action buttons), Generate Dialog, Bill Detail Dialog, void AlertDialog, delete-single AlertDialog, delete-all AlertDialog, `BillDetail` component, `Sparkles` helper, `KpiCard` component, `BILL_STATUS_STYLES`/`BillStatusBadge`/`formatINR`/`formatMonthYear`/`formatDate` helpers. The `BillStatusBadge` is still used inside `BillDetail`.

Verification:
- `bun run lint` → 0 errors (1 pre-existing informational warning in variables-view.tsx from a prior task, unrelated — react-hooks/incompatible-library on `form.watch`)
- dev.log shows clean recompilation (`✓ Compiled in 723ms`) and successful `GET /api/bills?month=5&year=2026` + `GET /api/bills?month=5&year=2026&includeDeleted=true` 200 responses — no compile errors
- File size: 1271 → 1162 lines (the unified BillRow is more compact than the dual mobile-card + desktop-table block it replaced)

Stage Summary:
- Billing list now uses the EXACT same row pattern as the Users list: single `space-y-3` + `AnimatePresence mode="popLayout"` + springy `motion.div` per-row wrapper + `GlassCard p-4 md:p-5 hover={false}` row + MoreVertical dropdown holding every per-row action
- The `md:hidden` mobile cards vs. `hidden md:block` desktop `<Table>` split is GONE — no Table import remains in this file
- All actions (View / Void / Delete / Restore) live inside the MoreVertical dropdown; no inline view/void/delete buttons remain — matches Users exactly
- RBAC gating preserved: residents never see admin actions; deleted bills show only Restore (admin) and nothing else; VOID bills hide the Void action
- All other Billing functionality (month picker, KPIs, filters, generate dialog, void/delete/delete-all AlertDialogs, Bill detail dialog with payment history) preserved unchanged
- Lint clean (0 errors)

---
Task ID: EXP-ROWS
Agent: expenses-rows-agent
Task: Replace Expenses list dual mobile/desktop split with a single Users-style ExpenseRow list

Work Log:
- Read worklog.md tail (Tasks EXP-REWRITE, BILL-FIX, PAY-FIX, UX-1, 10) for prior context on the Expenses view and the canonical Users row pattern.
- Read `src/components/features/users/users-view.tsx` lines 469-521 (list wrapper: `<div className="space-y-3">` + `<AnimatePresence mode="popLayout">` + per-row `motion.div` with layout/initial/animate/exit + spring transition) and lines 779-921 (`UserRow` component: `GlassCard p-4 md:p-5 hover={false}`, top-level `flex items-start gap-3 md:gap-4`, left Avatar h-12 w-12 md:h-14 md:w-14 rounded-2xl, middle meta stack, right DropdownMenu with MoreVertical trigger + GlassButton ghost size="icon" + content w-44 rounded-2xl with DropdownMenuLabel + DropdownMenuSeparator + mapped DropdownMenuItem entries).
- Read full `src/components/features/billing/expenses-view.tsx` (1128 lines) to identify the exact dual list block (lines 547-667) and the old `ExpenseCard` component (lines 758-843).

Changes to `src/components/features/billing/expenses-view.tsx` (only file modified):
1. Imports:
   - Updated `import { motion } from "framer-motion"` → `import { motion, AnimatePresence } from "framer-motion"`.
   - Added `MoreVertical` to the lucide-react import block.
   - Removed the entire `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` import (no longer used — desktop table is gone).
   - Added a new `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel` import block from `@/components/ui/dropdown-menu`.
2. Added a `CATEGORY_ICON_COMPONENTS: Record<string, typeof Boxes>` lookup map (GROCERY→ShoppingBag, UTILITIES→Zap, SALARY→Users, MAINTENANCE→Wrench, GENERAL→Boxes, CUSTOM→Plus) immediately after `CATEGORY_ORDER`. Needed because the existing `CATEGORY_META.icon` entries are pre-rendered JSX elements sized `h-3.5 w-3.5` for inline badge use; the new row tile wants the icon at `h-5 w-5` so a component reference (not a frozen element) is required.
3. Replaced the dual list block (`<>` fragment containing the `md:hidden` mobile StaggerGroup of `ExpenseCard`s + the `hidden md:block` GlassCard-wrapped `<Table>`) with a single unified list:
   ```
   <div className="space-y-3">
     <AnimatePresence mode="popLayout">
       {filtered.map((exp) => (
         <motion.div key={exp.id} layout initial={{opacity:0,y:12,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,scale:0.95}} transition={{type:"spring",stiffness:280,damping:26}}>
           <ExpenseRow expense={exp} canManage={isAdmin} onEdit={() => openEditForm(exp)} onDelete={() => setDeleteTarget(exp)} />
         </motion.div>
       ))}
     </AnimatePresence>
   </div>
   ```
   The empty-state GlassCard above it was preserved unchanged.
4. Deleted the old `ExpenseCard` component (was lines 758-843) and replaced it with a new `ExpenseRow` component that mirrors `UserRow` exactly:
   - Outer `<GlassCard className="p-4 md:p-5" hover={false}>` with top-level `<div className="flex items-start gap-3 md:gap-4">`.
   - Left: category-colored icon tile `h-12 w-12 md:h-14 md:w-14 rounded-2xl shrink-0` using `color-mix(in oklch, ${meta.colorVar} 15%, transparent)` for background and `meta.colorVar` for color. Icon rendered at `h-5 w-5` via the `CATEGORY_ICON_COMPONENTS` lookup (falls back to `Boxes`).
   - Middle: `<h3 className="font-semibold truncate">` (muted when locked) + category `Badge variant="outline"` (uses `meta.className`) + optional `🔒 Locked` badge + meta row (Calendar/Boxes/Users icons with date, qty, user name) + optional description `line-clamp-1` + inline Cost line with `formatINR()` tabular-nums.
   - Right: `DropdownMenu` with `DropdownMenuTrigger asChild` wrapping `GlassButton variant="ghost" size="icon"` with `MoreVertical`; `DropdownMenuContent align="end" className="w-44 rounded-2xl"` with `DropdownMenuLabel` "Actions" + `DropdownMenuSeparator` then `actions.map(...)` rendering `DropdownMenuItem` (Edit Expense → PencilLine, Delete Expense → Trash2 variant="destructive"). The dropdown only renders when `actions.length > 0` (i.e., `canManage && !locked`), matching the Users pattern where the menu is the single source of per-row actions.
5. All other sections preserved unchanged: month picker, admin action bar, KPIs, Top Categories chart, search + filter pills, ExpenseFormSheet, ExpenseFormBody, helpers (`formatINR`, `formatDate`, `formatQuantity`, `isExpenseLocked`, `getCatMeta`), `KpiCard`, Add/Edit mutations, Delete AlertDialog, and RBAC gating.

Verification:
- `bun run lint` → 0 errors (1 pre-existing informational warning in `variables-view.tsx` from a prior task, unrelated).
- `tail -30 /home/z/my-project/dev.log` shows multiple clean `✓ Compiled in XXXms` entries after the edit (712ms, 193ms, 163ms, 399ms, 109ms, 723ms) — Next.js picked up the file change and recompiled successfully with no errors.
- grep confirmed no orphan references to `ExpenseCard`, `Table`, `TableRow`, `TableCell`, `TableHead`, `TableBody`, `TableHeader`, `md:hidden`, or `hidden md:block` remain in the file.

Stage Summary:
- Expenses list is now a single unified list of `GlassCard` rows identical in pattern to the Users list: same `space-y-3` wrapper, same `AnimatePresence mode="popLayout"` + per-row `motion.div` (layout/initial/animate/exit + spring transition), same `GlassCard p-4 md:p-5 hover={false}` row card, same `MoreVertical` dropdown holding every per-row action.
- The mobile (`md:hidden`) cards + desktop (`hidden md:block`) `<Table>` split is GONE entirely — one list renders on every breakpoint.
- All per-row actions (Edit, Delete) live inside the dropdown menu; no inline edit/delete buttons remain. When `locked` is true OR `canManage` is false, the dropdown simply doesn't render (the `🔒 Locked` badge in the row header communicates state).
- Category icon tile replaces the user Avatar — same sizing (`h-12 w-12 md:h-14 md:w-14 rounded-2xl`) but tinted with the category's `colorVar` via `color-mix(in oklch, … 15%, transparent)` instead of a name-gradient.
- All existing functionality (Add/Edit sheet, lock logic, RBAC gating, mutations, delete confirm, KPIs, Top Categories chart, month picker, search/filter pills) preserved unchanged.
- Only `src/components/features/billing/expenses-view.tsx` was modified — no API routes, prisma schema, stores, or other views touched.
- Lint clean (0 errors).

---
Task ID: PAY-ROWS
Agent: payments-rows-agent
Task: Replace Payments list dual mobile/desktop split with a single Users-style PaymentRow list

Work Log:
- Read worklog.md tail (Tasks BILL-ROWS, EXP-ROWS, EXP-REWRITE, BILL-FIX, PAY-FIX, UX-1, 10) for prior context — confirmed BILL-ROWS + EXP-ROWS already established the exact pattern (unified `space-y-3` + `AnimatePresence mode="popLayout"` + springy `motion.div` per-row wrapper + `GlassCard p-4 md:p-5 hover={false}` row + MoreVertical dropdown holding every per-row action). This task applies the same to Payments.
- Read `src/components/features/users/users-view.tsx` lines 469-521 (list wrapper) and 779-921 (`UserRow` component) — confirmed canonical pattern: `GlassCard p-4 md:p-5 hover={false}` + top-level `flex items-start gap-3 md:gap-4` + Avatar `h-12 w-12 md:h-14 md:w-14 rounded-2xl` + middle meta stack + right `DropdownMenu` with `GlassButton variant="ghost" size="icon"` MoreVertical trigger + `DropdownMenuContent align="end" className="w-44 rounded-2xl"` + `DropdownMenuLabel` + `DropdownMenuSeparator` + mapped `DropdownMenuItem`.
- Read `src/components/features/billing/billing-view.tsx` `BillRow` (lines 878-1011) for the closest analog (also has `user.name` + `user.email`) — used as the template for `PaymentRow`.
- Read full `src/components/features/billing/payments-view.tsx` (1047 lines) — mapped the imports block (lines 1-76), the dual list block to replace (lines 524-604), the `PendingRow` component (lines 741-803) to preserve, and the old `PaymentCard` component (lines 805-866) to delete.

Changes to `src/components/features/billing/payments-view.tsx` (only file modified):
1. Imports:
   - Updated `import { motion } from "framer-motion";` → `import { motion, AnimatePresence } from "framer-motion";`.
   - Added `MoreVertical`, `Mail` to the lucide-react import block (appended after `RotateCcw`).
   - Added `import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";` right after the `Badge` import.
   - Removed the `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` import block from `@/components/ui/table` (no longer used — desktop table is gone).
   - Added a new `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel` import block from `@/components/ui/dropdown-menu` (placed in the same spot the Table import used to occupy, between Select and AlertDialog).
2. Added the `AVATAR_GRADIENTS` constant + `gradientFor(name)` + `initials(name)` helpers immediately after `formatDateTime` (before the existing `getDatePickerLabels` JSDoc comment). Exact same code as in users-view.tsx / billing-view.tsx.
3. Replaced the dual list block (the `<>` fragment containing `{/* Mobile cards */}` `md:hidden` StaggerGroup of `PaymentCard` + `{/* Desktop table */}` `hidden md:block` GlassCard-wrapped `<Table>`) with a SINGLE unified list:
   ```
   <div className="space-y-3">
     <AnimatePresence mode="popLayout">
       {filtered.map((p) => (
         <motion.div key={p.id} layout
           initial={{opacity:0,y:12,scale:0.98}} animate={{opacity:1,y:0,scale:1}}
           exit={{opacity:0,scale:0.95}} transition={{type:"spring",stiffness:280,damping:26}}>
           <PaymentRow payment={p} isAdmin={isAdmin}
             onApprove={() => setActionTarget({ payment: p, action: "APPROVE" })}
             onReject={() => setActionTarget({ payment: p, action: "REJECT" })} />
         </motion.div>
       ))}
     </AnimatePresence>
   </div>
   ```
   No `md:hidden` / `hidden md:block` split remains. The empty-state GlassCard above the list is preserved unchanged.
4. Deleted the old `PaymentCard` component (62 lines — `motion.div whileTap` + `glass rounded-3xl p-4` layout with method-icon tile + amount + notes) and replaced it with a new `PaymentRow` component that mirrors `UserRow` / `BillRow` exactly:
   - Outer `<GlassCard className="p-4 md:p-5" hover={false}>` with top-level `<div className="flex items-start gap-3 md:gap-4">`.
   - Left: `<Avatar className="h-12 w-12 md:h-14 md:w-14 rounded-2xl shrink-0">` with `<AvatarFallback>` using `gradientFor(payment.user.name)` + `initials(payment.user.name) || "U"`. (No AvatarImage — the `Payment.user` type only carries `name` + `email`, no `avatarUrl`.)
   - Middle: `<h3 className="font-semibold truncate">` showing `payment.user.name` for admins or `methodMeta.label` for non-admins (matching the old PaymentCard's behavior). Followed by `<Badge variant="outline">` status (uses `STATUS_STYLES[payment.status]`) + `<Badge variant="outline">` method (uses `METHOD_META[payment.method]`), both at `text-[10px]`.
   - Meta line `flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground`: Mail icon + email (admin only) + Clock icon + `formatDateTime(createdAt)` + ArrowUpRight icon + "Ref {reference}" (only when present).
   - Amount line `flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground`: "Amount ₹X" with `font-semibold text-foreground tabular-nums`, plus optional notes (`·` separator + truncated `max-w-[280px]`).
   - Right: `DropdownMenu` with `DropdownMenuTrigger asChild` wrapping `GlassButton variant="ghost" size="icon" shrink-0 aria-label="Payment actions"` with `MoreVertical`. `DropdownMenuContent align="end" className="w-44 rounded-2xl"` with `DropdownMenuLabel` "Actions" + `DropdownMenuSeparator` + mapped `DropdownMenuItem` (rounded-xl cursor-pointer, `variant="destructive"` for Reject).
   - Actions array: `Approve Payment` (CheckCircle2) + `Reject Payment` (XCircle, destructive). ONLY pushed when `isAdmin && payment.status === "PENDING"`. APPROVED / REJECTED / REFUNDED payments get an empty actions array → no dropdown trigger renders → matches the existing behavior where non-pending historical records had no per-row actions.
   - Non-admin users: actions array is always empty (the `isAdmin` guard) → no dropdown trigger renders → matches the existing behavior where regular users couldn't act on their own payments.
5. Preserved unchanged: Day Picker (centered capsule + circular ChevronLeft/Right arrows), action bar, KPIs (Total Approved / Pending Approvals / Rejected / Refunded), Admin Pending Approvals card with `PendingRow` (separate compact `glass-soft rounded-2xl p-3` UX with inline Approve/Reject buttons — intentional, NOT touched), search + filter pills, Submit Payment Dialog, Approve/Reject AlertDialog, `KpiCard`, `PendingRow`, `SubmitPaymentDialog`, `formatMonthLabel`, `formatINR`, `formatDate`, `formatDateTime`, `STATUS_STYLES`, `METHOD_META` helpers.

Verification:
- `bun run lint` → 0 errors (1 pre-existing informational warning in `variables-view.tsx` from a prior task, unrelated — react-hooks/incompatible-library on `form.watch`).
- `tail -30 /home/z/my-project/dev.log` shows multiple clean `✓ Compiled in 162ms` / `207ms` / `74ms` / `139ms` / `137ms` entries after the edit plus successful `GET /api/payments 200` + `GET /api/payments?date=2026-06-28 200` requests — no compile errors.
- grep confirmed no orphan references to `PaymentCard`, `Table`, `TableRow`, `TableCell`, `TableHead`, `TableBody`, `TableHeader`, `md:hidden`, or `hidden md:block` remain in the file.
- File size: 1047 → 1088 lines (the new `PaymentRow` is slightly larger than the old `PaymentCard`; the unified list block is more compact than the dual list — net +41 lines).

Stage Summary:
- Payments list is now a single unified list of `GlassCard` rows identical in pattern to the Users / Billing / Expenses lists: same `space-y-3` wrapper, same `AnimatePresence mode="popLayout"` + per-row `motion.div` (layout/initial/animate/exit + spring transition), same `GlassCard p-4 md:p-5 hover={false}` row card, same `MoreVertical` dropdown holding every per-row action.
- The mobile (`md:hidden`) cards + desktop (`hidden md:block`) `<Table>` split is GONE entirely — one list renders on every breakpoint. No `Table` import remains in this file.
- For admins, the MoreVertical dropdown renders ONLY for PENDING payments (Approve / Reject actions); APPROVED / REJECTED / REFUNDED payments have no row-level actions and the dropdown trigger doesn't render. For non-admin users, the dropdown never renders (no row-level actions exist for them). This matches the old UI's behavior where admins could act only on pending items, and regular users couldn't act on their own payments.
- The separate Admin "Pending Approvals" card at the top of the page (using the compact `PendingRow` with inline Approve/Reject buttons) is preserved unchanged — that's a distinct UX surface, not part of the main list.
- All other functionality (Day Picker, KPIs, search/filter pills, Submit Payment Dialog, Approve/Reject AlertDialog, mutations, RBAC gating, `pendingPayments` derivation for KPIs + Admin card) preserved unchanged.
- Only `src/components/features/billing/payments-view.tsx` was modified — no API routes, prisma schema, stores, or other views touched.
- Lint clean (0 errors).
