// ============================================================
// app/(app)/expenses/page.tsx — Ghar ka Hisab (Expense Tracker)
// Elderly-friendly, large tap targets, Indian currency format
// ============================================================
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  subscribeExpenses,
  addExpense,
  deleteExpense,
} from "@/lib/firestore";
import type { Expense, ExpenseCategory } from "@/lib/types";

const CATEGORIES: { label: ExpenseCategory; icon: string; name: string }[] = [
  { label: "Sabzi", icon: "🥦", name: "Sabzi / Phal" },
  { label: "Doodh", icon: "🥛", name: "Doodh" },
  { label: "Grocery", icon: "🛒", name: "Grocery / Ration" },
  { label: "Electricity", icon: "💡", name: "Bijli Bill" },
  { label: "Recharge", icon: "📱", name: "Mobile / Wi-Fi" },
  { label: "Petrol", icon: "⛽", name: "Petrol / Diesel" },
  { label: "Medical", icon: "💊", name: "Dawai / Doctor" },
  { label: "Repair", icon: "🔧", name: "Ghar ka Kaam" },
  { label: "Rent/EMI", icon: "🏠", name: "Kiraya / EMI" },
  { label: "Others", icon: "📦", name: "Anya (Others)" },
];

function formatRupees(amount: number): string {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`;
}

function getTodayDateInputValue(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatExpenseDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString("hi-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) {
    return `Aaj, ${timeStr}`;
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${timeStr}`;
}

export default function ExpensesPage() {
  const { user, profile, family, loading: authLoading } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Add Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Sabzi");
  const [note, setNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDateInputValue());
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // View filter: "today" vs "month"
  const [viewFilter, setViewFilter] = useState<"today" | "month">("today");

  // Subscribe to real-time expenses
  useEffect(() => {
    if (!profile?.familyId) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeExpenses(profile.familyId, (list) => {
      setExpenses(list);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.familyId, authLoading]);

  // Current Month calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonth = prevMonthDate.getMonth();
  const prevMonthYear = prevMonthDate.getFullYear();

  // Filter this month & last month
  const thisMonthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [expenses, currentMonth, currentYear]);

  const lastMonthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
    });
  }, [expenses, prevMonth, prevMonthYear]);

  // Today's expenses
  const todayExpenses = useMemo(() => {
    const todayStr = getTodayDateInputValue();
    return expenses.filter((e) => {
      const d = new Date(e.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}` === todayStr;
    });
  }, [expenses]);

  // Totals
  const thisMonthTotal = useMemo(
    () => thisMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [thisMonthExpenses]
  );

  const lastMonthTotal = useMemo(
    () => lastMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [lastMonthExpenses]
  );

  const todayTotal = useMemo(
    () => todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [todayExpenses]
  );

  // Month-over-month comparison
  const diffFromLastMonth = thisMonthTotal - lastMonthTotal;

  // Category breakdown for this month
  const categoryBreakdown = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const exp of thisMonthExpenses) {
      const prev = map.get(exp.category) || 0;
      map.set(exp.category, prev + exp.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [thisMonthExpenses]);

  // Handle Add Expense
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !user || !profile?.familyId || adding) {
      return;
    }

    setAdding(true);
    try {
      // Parse chosen date
      const [y, m, d] = expenseDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const currentTime = new Date();
      dateObj.setHours(
        currentTime.getHours(),
        currentTime.getMinutes(),
        currentTime.getSeconds()
      );

      await addExpense({
        familyId: profile.familyId,
        amount: numAmount,
        category,
        note: note.trim() || undefined,
        addedBy: profile.displayName || user.displayName || "Family Member",
        addedByUid: user.uid,
        date: dateObj,
      });

      setAmount("");
      setNote("");
    } catch (err) {
      console.error("Error adding expense:", err);
    } finally {
      setAdding(false);
    }
  }

  // Handle Delete Expense
  async function handleDelete(expenseId: string, expName: string, expAmount: number) {
    if (deletingId) return;
    const confirmed = window.confirm(
      `Kya aap ${formatRupees(expAmount)} (${expName}) ka hisab hatana chahte hain?`
    );
    if (!confirmed) return;

    setDeletingId(expenseId);
    try {
      await deleteExpense(expenseId);
    } catch (err) {
      console.error("Error deleting expense:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const displayedList = viewFilter === "today" ? todayExpenses : thisMonthExpenses;

  return (
    <div className="px-4 pt-6 max-w-xl mx-auto pb-10">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-extrabold text-[#1c1917] flex items-center gap-2">
            💰 Ghar ka Hisab
          </h1>
          {todayTotal > 0 && (
            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-sm font-extrabold px-3 py-1 rounded-full shadow-xs shrink-0">
              Aaj: {formatRupees(todayTotal)}
            </span>
          )}
        </div>
        {family && (
          <p className="text-[#ea580c] font-bold text-sm mt-1">
            👨‍👩‍👧‍👦 {family.name}
          </p>
        )}
      </div>

      {/* ─── 1. This Month Summary Card ────────────────────── */}
      <div className="card mb-6 bg-white border-2 border-orange-200/90 shadow-md p-5 rounded-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
              <span>📅</span>
              <span>Is Mahine ka Kharcha</span>
              <span className="text-stone-500 font-semibold normal-case">
                ({now.toLocaleString("hi-IN", { month: "long" })})
              </span>
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1c1917] mt-1.5 tracking-tight">
              {formatRupees(thisMonthTotal)}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center text-2xl shrink-0 shadow-xs">
            💵
          </div>
        </div>

        {/* Month Comparison */}
        {lastMonthTotal > 0 && (
          <div className="mt-3.5 pt-3.5 border-t border-stone-100 text-xs font-bold flex items-center gap-2 flex-wrap text-stone-700">
            {diffFromLastMonth > 0 ? (
              <>
                <span className="bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-md text-[11px] font-extrabold shrink-0">
                  ▲ Zyada
                </span>
                <span>Pichle mahine se {formatRupees(diffFromLastMonth)} zyada kharcha hua</span>
              </>
            ) : diffFromLastMonth < 0 ? (
              <>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-extrabold shrink-0">
                  ▼ Kam
                </span>
                <span>Pichle mahine se {formatRupees(Math.abs(diffFromLastMonth))} kam kharcha hua</span>
              </>
            ) : (
              <span className="text-stone-600">Pichle mahine ke barabar kharcha hua ({formatRupees(lastMonthTotal)})</span>
            )}
          </div>
        )}

        {/* Category Breakdown (Simple Grid) */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-stone-100">
            <p className="text-xs font-extrabold text-stone-600 uppercase tracking-wider mb-2.5">
              Kaha kitna kharch hua:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {categoryBreakdown.map(([cat, amt]) => {
                const catInfo = CATEGORIES.find((c) => c.label === cat);
                return (
                  <div
                    key={cat}
                    className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl flex items-center justify-between text-stone-900 shadow-2xs"
                  >
                    <span className="truncate font-bold text-stone-700">
                      {catInfo?.icon} {cat}
                    </span>
                    <span className="font-black text-stone-950 ml-1 shrink-0">{formatRupees(amt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. Quick Add Expense Card ─────────────────────── */}
      <div className="card mb-6 border-2 border-stone-200 shadow-md rounded-2xl">
        <h3 className="text-lg font-extrabold text-[#1c1917] mb-3.5 flex items-center gap-2">
          <span>➕</span> Naya Kharcha Jodein
        </h3>

        <form onSubmit={handleAddExpense} className="space-y-4">
          {/* Amount input — Large keypad friendly */}
          <div>
            <label htmlFor="expense-amount" className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Rupaye (Amount) *
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-stone-700 z-10">
                <svg
                  className="w-6 h-6 text-stone-700 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 3h12" />
                  <path d="M6 8h12" />
                  <path d="M6 13l8.5 8" />
                  <path d="M6 13h3" />
                  <path d="M9 13a4 4 0 0 0 0-8" />
                </svg>
              </div>
              <input
                id="expense-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="input-field font-extrabold text-2xl text-[#1c1917] w-full tracking-wide"
                style={{ minHeight: "56px", paddingLeft: "3.25rem" }}
              />
            </div>
          </div>

          {/* Category Picker — Large Tappable Chips */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5">
              Category Chunein *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`py-2.5 px-3 rounded-xl font-bold text-sm flex items-center gap-2 transition cursor-pointer border-2 text-left ${
                      isSelected
                        ? "border-[#ea580c] bg-orange-50 text-[#c2410c] shadow-xs"
                        : "border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xl shrink-0">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note input (Optional) */}
          <div>
            <label htmlFor="expense-note" className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Kaha kharch hua? (Optional description)
            </label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Jaise Mother Dairy, Bijli bill, Doctor fees..."
              className="input-field text-base text-stone-900 font-medium"
              style={{ minHeight: "48px" }}
            />
          </div>

          {/* Date Picker (Defaults to today) */}
          <div>
            <label htmlFor="expense-date" className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Taarikh (Date)
            </label>
            <input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="input-field text-base font-semibold text-stone-900"
              style={{ minHeight: "48px" }}
            />
          </div>

          {/* Submit Button */}
          <button
            id="expense-submit-btn"
            type="submit"
            disabled={adding || !amount || parseFloat(amount) <= 0}
            className="btn-primary w-full text-white font-extrabold text-lg shadow-md disabled:opacity-50 transition cursor-pointer"
            style={{
              background: "#ea580c",
              minHeight: "54px",
            }}
          >
            {adding ? "⏳ Jod rahe hain..." : "➕ Kharcha Jodo"}
          </button>
        </form>
      </div>

      {/* ─── 3. Expenses List & Segment Tabs ────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="text-xl font-extrabold text-[#1c1917]">
            📋 Kharche ki List
          </h3>

          {/* Toggle Tab */}
          <div className="flex bg-stone-200/90 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewFilter("today")}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                viewFilter === "today"
                  ? "bg-white text-stone-950 shadow-xs"
                  : "text-stone-600 hover:text-stone-950"
              }`}
            >
              Aaj ({todayExpenses.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("month")}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                viewFilter === "month"
                  ? "bg-white text-stone-950 shadow-xs"
                  : "text-stone-600 hover:text-stone-950"
              }`}
            >
              Is Mahine ({thisMonthExpenses.length})
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-5xl mb-3 animate-spin">⏳</div>
            <p className="text-stone-600 text-base font-semibold">
              Hisab load ho raha hai...
            </p>
          </div>
        ) : displayedList.length === 0 ? (
          /* Empty state */
          <div className="card text-center py-10 px-4 border-dashed border-2 border-stone-200 bg-white">
            <div className="text-5xl mb-2">🧾</div>
            <p className="text-lg font-bold text-stone-800">
              {viewFilter === "today" ? "Aaj koi kharcha nahi likha!" : "Is mahine koi kharcha nahi!"}
            </p>
            <p className="text-sm text-stone-500 font-medium mt-1">
              Upar diye form se naya kharcha jodein.
            </p>
          </div>
        ) : (
          /* Expense Cards */
          <div className="space-y-3">
            {displayedList.map((exp) => {
              const catInfo = CATEGORIES.find((c) => c.label === exp.category);
              const isDeleting = deletingId === exp.id;

              return (
                <div
                  key={exp.id}
                  className="card border-l-4 border-l-[#ea580c] p-4 transition-all hover:shadow-md flex items-center justify-between gap-3 bg-white"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                      {catInfo?.icon || "💵"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h4 className="text-lg font-extrabold text-[#1c1917] truncate">
                          {exp.category}
                        </h4>
                        {exp.note && (
                          <span className="text-xs text-stone-600 truncate font-semibold">
                            • {exp.note}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-500 font-bold mt-0.5">
                        👤 {exp.addedBy} • {formatExpenseDate(exp.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-black text-stone-950">
                      {formatRupees(exp.amount)}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id, exp.category, exp.amount)}
                      disabled={isDeleting}
                      className="text-stone-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl text-base transition cursor-pointer"
                      title="Hatao (Delete)"
                    >
                      {isDeleting ? "⏳" : "🗑️"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
