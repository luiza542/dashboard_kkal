import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* ----------------------------- Types & consts ----------------------------- */

const GOAL = 30800;
const IDEAL_KCAL_PER_DAY = 700; // ideal pace → 30,800 in 44 days

type Activity = {
  id: string;
  name: string;
  kcal: number;
  date: string; // YYYY-MM-DD
};

type DateRange = "all" | 7 | 14 | 30;
type SortKey = "date" | "name" | "kcal";
type SortDir = "asc" | "desc";

const STORAGE_KEY = "burndown.activities.v1";
const THEME_KEY = "burndown.theme";

const TYPE_COLORS: Record<string, string> = {
  Running: "#10b981",
  Walking: "#3b82f6",
  Cycling: "#f59e0b",
  Gym: "#8b5cf6",
  Swimming: "#06b6d4",
  Hiking: "#84cc16",
  Yoga: "#ec4899",
};
const FALLBACK_COLORS = ["#ef4444", "#14b8a6", "#f97316", "#6366f1", "#a3e635"];

/* ------------------------------ Date helpers ------------------------------ */

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = () => toISO(new Date());
const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const daysAgoISO = (n: number) => toISO(addDays(new Date(), -n));
const fmtShort = (iso: string) =>
  parseISO(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtLong = (iso: string) =>
  parseISO(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
const capitalize = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/* ------------------------------- Seed data -------------------------------- */

function buildSeedData(): Activity[] {
  // ~3 weeks of varied, realistic activity
  const plan: Array<[number, string, number]> = [
    [20, "Running", 480], [20, "Walking", 180],
    [19, "Gym", 420],
    [18, "Cycling", 560], [18, "Walking", 150],
    [17, "Running", 510],
    [16, "Gym", 390], [16, "Walking", 210],
    [15, "Swimming", 440],
    [14, "Running", 620], [14, "Walking", 130],
    [13, "Cycling", 480],
    [12, "Gym", 450],
    [11, "Running", 530], [11, "Walking", 170],
    [10, "Hiking", 760],
    [9, "Walking", 240],
    [8, "Gym", 410], [8, "Running", 350],
    [7, "Cycling", 610],
    [6, "Running", 540], [6, "Walking", 160],
    [5, "Swimming", 470],
    [4, "Gym", 430],
    [3, "Running", 580], [3, "Walking", 190],
    [2, "Cycling", 520],
    [1, "Gym", 440], [1, "Walking", 140],
    [0, "Running", 460],
  ];
  return plan.map(([ago, name, kcal], i) => ({
    id: `seed-${i}`,
    name,
    kcal,
    date: daysAgoISO(ago),
  }));
}

function loadActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return buildSeedData();
}

/* --------------------------- Animated number ------------------------------ */

function useAnimatedNumber(value: number, duration = 650) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}

/* ------------------------------ UI widgets -------------------------------- */

function ProgressRing({ pct }: { pct: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 170 170" className="h-40 w-40 sm:h-44 sm:w-44">
      <circle
        cx="85" cy="85" r={r} fill="none" strokeWidth="14"
        className="stroke-slate-200 dark:stroke-slate-700"
      />
      <circle
        cx="85" cy="85" r={r} fill="none" strokeWidth="14" strokeLinecap="round"
        stroke="url(#ringGrad)"
        strokeDasharray={c}
        strokeDashoffset={c - (clamped / 100) * c}
        transform="rotate(-90 85 85)"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
      />
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <text
        x="85" y="78" textAnchor="middle"
        className="fill-slate-900 dark:fill-white"
        style={{ fontSize: 30, fontWeight: 800 }}
      >
        {clamped.toFixed(1)}%
      </text>
      <text
        x="85" y="100" textAnchor="middle"
        className="fill-slate-500 dark:fill-slate-400"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        COMPLETE
      </text>
    </svg>
  );
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null)
    return <span className="text-xs font-medium text-slate-400">—</span>;
  const up = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700/60 dark:bg-slate-800/60">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {badge}
      </div>
      <p
        className={`mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight ${
          accent ?? "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700/60 dark:bg-slate-800/60 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700/60">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
            value === o.value
              ? "bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CustomTooltip({ active, payload, label, dark }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs shadow-lg ${
        dark
          ? "border-slate-700 bg-slate-900/95 text-slate-200"
          : "border-slate-200 bg-white/95 text-slate-700"
      }`}
    >
      <p className="mb-1 font-bold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color || p.payload?.fill }}
          />
          <span className="font-medium">{p.name}:</span>{" "}
          {Number(p.value).toLocaleString()} kcal
        </p>
      ))}
    </div>
  );
}

/* --------------------------------- App ------------------------------------ */

export default function App() {
  const [activities, setActivities] = useState<Activity[]>(loadActivities);
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [barWindow, setBarWindow] = useState<7 | 14 | 30>(14);

  // Form
  const [formName, setFormName] = useState("");
  const [formKcal, setFormKcal] = useState("");
  const [formDate, setFormDate] = useState(todayISO());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  // Table
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  // Hero pulse animation trigger
  const [pulse, setPulse] = useState(0);

  /* Persistence */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  /* ------------------------------ Derived data ----------------------------- */

  const allTypes = useMemo(
    () => Array.from(new Set(activities.map((a) => a.name))).sort(),
    [activities]
  );

  const colorFor = (name: string, i: number) =>
    TYPE_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];

  // Global totals — the 30,800 anchor is always all-time
  const totalBurned = useMemo(
    () => activities.reduce((s, a) => s + a.kcal, 0),
    [activities]
  );
  const remaining = Math.max(0, GOAL - totalBurned);
  const pctComplete = Math.min(100, (totalBurned / GOAL) * 100);

  const animatedRemaining = useAnimatedNumber(remaining);
  const animatedBurned = useAnimatedNumber(totalBurned);

  // Filtered set (date range + type) powers charts/table/KPIs
  const rangeStartISO = useMemo(
    () => (dateRange === "all" ? null : daysAgoISO(dateRange - 1)),
    [dateRange]
  );

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (rangeStartISO && a.date < rangeStartISO) return false;
      if (typeFilter !== "all" && a.name !== typeFilter) return false;
      return true;
    });
  }, [activities, rangeStartISO, typeFilter]);

  const filteredBurned = filtered.reduce((s, a) => s + a.kcal, 0);

  // Trend: current window vs previous equal window (default 7d when "all")
  const trendDelta = useMemo(() => {
    const win = dateRange === "all" ? 7 : dateRange;
    const curStart = daysAgoISO(win - 1);
    const prevStart = daysAgoISO(2 * win - 1);
    const match = (a: Activity) =>
      typeFilter === "all" || a.name === typeFilter;
    const cur = activities
      .filter((a) => match(a) && a.date >= curStart)
      .reduce((s, a) => s + a.kcal, 0);
    const prev = activities
      .filter((a) => match(a) && a.date >= prevStart && a.date < curStart)
      .reduce((s, a) => s + a.kcal, 0);
    if (prev === 0) return cur > 0 ? 100 : null;
    return ((cur - prev) / prev) * 100;
  }, [activities, dateRange, typeFilter]);

  // Avg kcal/day over filtered active span
  const avgPerDay = useMemo(() => {
    if (!filtered.length) return 0;
    const dates = filtered.map((a) => a.date).sort();
    const span =
      Math.round(
        (parseISO(dates[dates.length - 1]).getTime() -
          parseISO(dates[0]).getTime()) /
          86400000
      ) + 1;
    return filteredBurned / Math.max(1, span);
  }, [filtered, filteredBurned]);

  // Streak (all-time): consecutive days with any activity ending today/yesterday
  const streak = useMemo(() => {
    const days = new Set(activities.map((a) => a.date));
    let cursor = new Date();
    if (!days.has(toISO(cursor))) cursor = addDays(cursor, -1);
    let count = 0;
    while (days.has(toISO(cursor))) {
      count++;
      cursor = addDays(cursor, -1);
    }
    return count;
  }, [activities]);

  // Projected finish date based on all-time average pace
  const projectedFinish = useMemo(() => {
    if (remaining <= 0) return "Goal reached! 🎉";
    if (!activities.length) return "—";
    const dates = activities.map((a) => a.date).sort();
    const span =
      Math.round(
        (new Date().getTime() - parseISO(dates[0]).getTime()) / 86400000
      ) + 1;
    const pace = totalBurned / Math.max(1, span);
    if (pace <= 0) return "—";
    const daysLeft = Math.ceil(remaining / pace);
    return addDays(new Date(), daysLeft).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [activities, remaining, totalBurned]);

  /* ------------------------------- Chart data ------------------------------ */

  const cumulativeData = useMemo(() => {
    if (!filtered.length) return [];
    const byDay = new Map<string, number>();
    filtered.forEach((a) => byDay.set(a.date, (byDay.get(a.date) ?? 0) + a.kcal));
    const sorted = [...byDay.keys()].sort();
    const start = parseISO(sorted[0]);
    const end = new Date();
    const out: { label: string; cumulative: number; ideal: number }[] = [];
    let cum = 0;
    let d = start;
    let i = 0;
    while (toISO(d) <= toISO(end)) {
      const iso = toISO(d);
      cum += byDay.get(iso) ?? 0;
      out.push({
        label: fmtShort(iso),
        cumulative: cum,
        ideal: Math.min(GOAL, (i + 1) * IDEAL_KCAL_PER_DAY),
      });
      d = addDays(d, 1);
      i++;
    }
    return out;
  }, [filtered]);

  const barData = useMemo(() => {
    const out: { label: string; kcal: number }[] = [];
    for (let i = barWindow - 1; i >= 0; i--) {
      const iso = daysAgoISO(i);
      const kcal = activities
        .filter(
          (a) =>
            a.date === iso && (typeFilter === "all" || a.name === typeFilter)
        )
        .reduce((s, a) => s + a.kcal, 0);
      out.push({ label: fmtShort(iso), kcal });
    }
    return out;
  }, [activities, barWindow, typeFilter]);

  const donutData = useMemo(() => {
    const byType = new Map<string, number>();
    filtered.forEach((a) =>
      byType.set(a.name, (byType.get(a.name) ?? 0) + a.kcal)
    );
    return [...byType.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  /* --------------------------------- Table --------------------------------- */

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = filtered.filter(
      (a) => !q || a.name.toLowerCase().includes(q)
    );
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      if (sortKey === "kcal") cmp = a.kcal - b.kcal;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filtered, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  };

  /* -------------------------------- Actions -------------------------------- */

  const resetForm = () => {
    setFormName("");
    setFormKcal("");
    setFormDate(todayISO());
    setEditingId(null);
    setFormError("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = capitalize(formName);
    const kcal = Math.round(Number(formKcal));
    if (!name) return setFormError("Please enter an activity name.");
    if (!kcal || kcal <= 0)
      return setFormError("Calories must be a positive number.");
    if (!formDate) return setFormError("Please pick a date.");

    if (editingId) {
      setActivities((prev) =>
        prev.map((a) =>
          a.id === editingId ? { ...a, name, kcal, date: formDate } : a
        )
      );
    } else {
      setActivities((prev) => [
        ...prev,
        { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, kcal, date: formDate },
      ]);
    }
    setPulse((p) => p + 1);
    resetForm();
  };

  const startEdit = (a: Activity) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormKcal(String(a.kcal));
    setFormDate(a.date);
    setFormError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const deleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) resetForm();
    setPulse((p) => p + 1);
  };

  const resetDemo = () => {
    if (confirm("Reset all data back to the sample dataset?")) {
      setActivities(buildSeedData());
      resetForm();
    }
  };

  /* --------------------------------- Render -------------------------------- */

  const gridStroke = dark ? "#334155" : "#e2e8f0";
  const axisTick = { fill: dark ? "#94a3b8" : "#64748b", fontSize: 11 };

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-white">
      {/* ------------------------------- Header ------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 text-lg shadow-md">
              🔥
            </div>
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight sm:text-lg">
                BurnDown
              </h1>
              <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                Personal calorie-deficit dashboard
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={[
                { label: "7d", value: 7 as DateRange },
                { label: "14d", value: 14 as DateRange },
                { label: "30d", value: 30 as DateRange },
                { label: "All", value: "all" as DateRange },
              ]}
              value={dateRange}
              onChange={setDateRange}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All activities</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle dark mode"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm shadow-sm transition hover:scale-105 dark:border-slate-700 dark:bg-slate-800"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* ----------------------------- Hero / Goal ---------------------------- */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50 p-6 shadow-sm dark:border-slate-700/60 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/40 sm:p-8">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-center lg:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                🎯 Total burn goal
              </p>
              <p className="mt-1 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
                {GOAL.toLocaleString()}{" "}
                <span className="text-xl font-bold text-slate-400 dark:text-slate-500">
                  kcal
                </span>
              </p>
              <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                ≈ 4 kg of body fat. Every activity you log chips away at the
                remaining number — keep the streak alive.
              </p>
            </div>

            {/* Remaining — the hero element */}
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Remaining to goal
              </p>
              <p
                key={pulse}
                className={`mt-1 bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-6xl font-black tabular-nums tracking-tight text-transparent sm:text-7xl ${
                  pulse > 0 ? "animate-pop-glow" : ""
                }`}
              >
                {animatedRemaining.toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                kcal left ·{" "}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {animatedBurned.toLocaleString()} burned
                </span>
              </p>
              {/* Linear progress bar */}
              <div className="mx-auto mt-3 h-2.5 w-64 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 sm:w-80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                  style={{
                    width: `${pctComplete}%`,
                    transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>
            </div>

            <ProgressRing pct={pctComplete} />
          </div>
        </section>

        {/* ------------------------------ KPI cards ----------------------------- */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Goal"
            value={`${GOAL.toLocaleString()}`}
            sub="kcal · fixed target"
          />
          <KpiCard
            label={`Burned (${dateRange === "all" ? "all time" : `${dateRange}d`})`}
            value={filteredBurned.toLocaleString()}
            sub="kcal in selected view"
            accent="text-emerald-600 dark:text-emerald-400"
            badge={<TrendBadge delta={trendDelta} />}
          />
          <KpiCard
            label="Remaining"
            value={remaining.toLocaleString()}
            sub={`${pctComplete.toFixed(1)}% complete`}
            accent="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            label="Avg / day"
            value={Math.round(avgPerDay).toLocaleString()}
            sub={`ideal pace ${IDEAL_KCAL_PER_DAY}/day`}
          />
          <KpiCard
            label="Streak"
            value={`${streak} 🔥`}
            sub={streak > 0 ? "days with activity" : "log today to start!"}
            accent="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            label="Projected finish"
            value={projectedFinish}
            sub="at your current pace"
          />
        </section>

        {/* --------------------------- Form + Line chart ------------------------- */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Add / edit activity */}
          <div
            ref={formRef}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60"
          >
            <h3 className="text-sm font-bold">
              {editingId ? "✏️ Edit activity" : "➕ Add activity"}
            </h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              {editingId
                ? "Update the entry — totals recalculate instantly."
                : "Log a workout and watch the remaining number drop."}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Activity name
                </label>
                <input
                  list="activity-suggestions"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Running"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                />
                <datalist id="activity-suggestions">
                  {["Running", "Walking", "Cycling", "Gym", "Swimming", "Hiking", "Yoga"].map(
                    (t) => (
                      <option key={t} value={t} />
                    )
                  )}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Calories burned
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formKcal}
                    onChange={(e) => setFormKcal(e.target.value)}
                    placeholder="e.g. 90"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    max={todayISO()}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
              </div>
              {formError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  {formError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg hover:brightness-105 active:scale-[0.98]"
                >
                  {editingId ? "Update activity" : "Log activity"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/40"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
            <button
              onClick={resetDemo}
              className="mt-4 w-full text-center text-[11px] font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
              ↺ Reset to sample data
            </button>
          </div>

          {/* Cumulative line chart */}
          <div className="lg:col-span-2">
            <ChartCard
              title="Cumulative burn vs. ideal pace"
              subtitle={`Target line = ${IDEAL_KCAL_PER_DAY} kcal/day toward ${GOAL.toLocaleString()}`}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip dark={dark} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone" dataKey="ideal" name="Ideal pace"
                      stroke={dark ? "#64748b" : "#94a3b8"} strokeWidth={2}
                      strokeDasharray="6 4" dot={false}
                      animationDuration={700}
                    />
                    <Line
                      type="monotone" dataKey="cumulative" name="Burned (cumulative)"
                      stroke="#10b981" strokeWidth={3} dot={false}
                      activeDot={{ r: 5 }}
                      animationDuration={700}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </section>

        {/* ---------------------------- Bar + Donut ----------------------------- */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard
              title="Kcal burned per day"
              subtitle="Daily totals in the selected window"
              action={
                <SegmentedControl
                  options={[
                    { label: "7d", value: 7 },
                    { label: "14d", value: 14 },
                    { label: "30d", value: 30 },
                  ]}
                  value={barWindow}
                  onChange={(v) => setBarWindow(v as 7 | 14 | 30)}
                />
              }
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<CustomTooltip dark={dark} />} cursor={{ fill: dark ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.08)" }} />
                    <Bar dataKey="kcal" name="Burned" radius={[6, 6, 0, 0]} animationDuration={600}>
                      {barData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.kcal >= IDEAL_KCAL_PER_DAY ? "#10b981" : "#3b82f6"}
                          opacity={d.kcal === 0 ? 0.25 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> ≥ {IDEAL_KCAL_PER_DAY} kcal (on pace)</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> below pace</span>
              </p>
            </ChartCard>
          </div>

          <ChartCard title="Burn by activity" subtitle="Share of calories in current view">
            {donutData.length ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData} dataKey="value" nameKey="name"
                        innerRadius="62%" outerRadius="90%" paddingAngle={3}
                        strokeWidth={0} animationDuration={600}
                      >
                        {donutData.map((d, i) => (
                          <Cell key={d.name} fill={colorFor(d.name, i)} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip dark={dark} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {donutData.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(d.name, i) }} />
                      <span className="font-semibold">{d.name}</span>
                      <span className="ml-auto tabular-nums text-slate-500 dark:text-slate-400">
                        {d.value.toLocaleString()} kcal ·{" "}
                        {((d.value / Math.max(1, filteredBurned)) * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="flex h-52 items-center justify-center text-sm text-slate-400">
                No activities in this view
              </p>
            )}
          </ChartCard>
        </section>

        {/* -------------------------------- Table -------------------------------- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-700/60 sm:px-5">
            <div>
              <h3 className="text-sm font-bold">Activity log</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tableRows.length} {tableRows.length === 1 ? "entry" : "entries"} ·{" "}
                {tableRows.reduce((s, a) => s + a.kcal, 0).toLocaleString()} kcal shown
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Search activity…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 dark:border-slate-700 dark:bg-slate-900/60 sm:w-56"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
                  <th className="cursor-pointer select-none px-4 py-3 font-bold transition hover:text-slate-600 dark:hover:text-slate-300 sm:px-5" onClick={() => toggleSort("date")}>
                    Date{sortArrow("date")}
                  </th>
                  <th className="cursor-pointer select-none px-4 py-3 font-bold transition hover:text-slate-600 dark:hover:text-slate-300" onClick={() => toggleSort("name")}>
                    Activity{sortArrow("name")}
                  </th>
                  <th className="cursor-pointer select-none px-4 py-3 text-right font-bold transition hover:text-slate-600 dark:hover:text-slate-300" onClick={() => toggleSort("kcal")}>
                    Kcal{sortArrow("kcal")}
                  </th>
                  <th className="px-4 py-3 text-right font-bold sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((a, i) => (
                  <tr
                    key={a.id}
                    className="animate-fade-in border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/80 dark:border-slate-700/40 dark:hover:bg-slate-700/20"
                    style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300 sm:px-5">
                      {fmtLong(a.date)}
                      {a.date === todayISO() && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                          TODAY
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: colorFor(a.name, allTypes.indexOf(a.name)) }}
                        />
                        {a.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {a.kcal.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right sm:px-5">
                      <button
                        onClick={() => startEdit(a)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteActivity(a.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!tableRows.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                      No activities match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pb-6 pt-2 text-center text-xs text-slate-400 dark:text-slate-500">
          BurnDown · {totalBurned.toLocaleString()} / {GOAL.toLocaleString()} kcal
          burned · data saved locally in your browser
        </footer>
      </main>
    </div>
  );
}
