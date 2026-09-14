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
    <div className="px-4 pt-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-[#1c1917] flex items-center gap-2">
            💰 Ghar ka Hisab
          </h1>
          {todayTotal > 0 && (
            <span className="bg-green-100 text-green-900 border border-green-300 text-sm font-extrabold px-3 py-1 rounded-full shadow-sm">
              Aaj: {formatRupees(todayTotal)}
            </span>
          )}
        </div>
        {family && (
          <p className="text-[#f97316] font-semibold text-base mt-1">
            👨‍👩‍👧‍👦 {family.name}
          </p>
        )}
      </div>

      {/* ─── 1. This Month Summary Card ────────────────────── */}
      <div className="card mb-6 bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-orange-100 text-sm font-bold uppercase tracking-wider">
              📅 Is Mahine ka Kharcha ({now.toLocaleString("hi-IN", { month: "long" })})
            </p>
            <h2 className="text-4xl font-extrabold mt-1 tracking-tight">
              {formatRupees(thisMonthTotal)}
            </h2>
          </div>
          <span className="text-3xl">💵</span>
        </div>

        {/* Month Comparison */}
        {lastMonthTotal > 0 && (
          <div className="mt-3 pt-3 border-t border-orange-400/50 text-xs font-semibold flex items-center gap-1.5 text-orange-50">
            {diffFromLastMonth > 0 ? (
              <>
                <span className="bg-red-500/80 px-1.5 py-0.5 rounded text-[11px] font-bold">
                  ▲ Zyada
                </span>
                <span>Pichle mahine se {formatRupees(diffFromLastMonth)} zyada kharcha hua</span>
              </>
            ) : diffFromLastMonth < 0 ? (
              <>
                <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[11px] font-bold">
                  ▼ Kam
                </span>
                <span>Pichle mahine se {formatRupees(Math.abs(diffFromLastMonth))} kam kharcha hua</span>
              </>
            ) : (
              <span>Pichle mahine ke barabar kharcha hua ({formatRupees(lastMonthTotal)})</span>
            )}
          </div>
        )}

        {/* Category Breakdown (Simple Text List) */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-4 pt-3 border-t border-orange-400/40">
            <p className="text-xs font-bold text-orange-200 uppercase tracking-wider mb-2">
              Kaha kitna kharch hua:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {categoryBreakdown.map(([cat, amt]) => {
                const catInfo = CATEGORIES.find((c) => c.label === cat);
                return (
                  <div
                    key={cat}
                    className="bg-black/15 backdrop-blur-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between"
                  >
                    <span className="truncate font-medium">
                      {catInfo?.icon} {cat}
                    </span>
                    <span className="font-extrabold ml-1">{formatRupees(amt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. Quick Add Expense Card ─────────────────────── */}
      <div className="card mb-6 border-2 border-stone-200 shadow-md">
        <h3 className="text-lg font-bold text-[#1c1917] mb-3 flex items-center gap-1.5">
          <span>➕</span> Naya Kharcha Jodein
        </h3>

        <form onSubmit={handleAddExpense} className="space-y-4">
          {/* Amount input — Large keypad friendly */}
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Rupaye (Amount) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-stone-500">
                ₹
              </span>
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
                className="input-field pl-10 font-extrabold text-2xl text-[#1c1917]"
                style={{ minHeight: "56px" }}
              />
            </div>
          </div>

          {/* Category Picker — Large Tappable Chips */}
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1.5">
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
                        ? "border-[#f97316] bg-orange-50 text-[#f97316] shadow-xs"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note input (Optional) */}
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Kaha kharch hua? (Optional description)
            </label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Jaise Mother Dairy, Bijli bill, Doctor fees..."
              className="input-field text-base"
              style={{ minHeight: "48px" }}
            />
          </div>

          {/* Date Picker (Defaults to today) */}
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Taarikh (Date)
            </label>
            <input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="input-field text-base font-semibold"
              style={{ minHeight: "48px" }}
            />
          </div>

          {/* Submit Button */}
          <button
            id="expense-submit-btn"
            type="submit"
            disabled={adding || !amount || parseFloat(amount) <= 0}
            className="btn-primary w-full text-white font-extrabold text-lg shadow-md disabled:opacity-50"
            style={{
              background: "#f97316",
              minHeight: "54px",
            }}
          >
            {adding ? "⏳ Jod rahe hain..." : "➕ Kharcha Jodo"}
          </button>
        </form>
      </div>

      {/* ─── 3. Expenses List & Segment Tabs ────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-[#1c1917]">
            📋 Kharche ki List
          </h3>

          {/* Toggle Tab */}
          <div className="flex bg-stone-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewFilter("today")}
              className={`px-3 py-1 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                viewFilter === "today"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Aaj ({todayExpenses.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("month")}
              className={`px-3 py-1 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                viewFilter === "month"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
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
            <p className="text-[#78716c] text-base font-medium">
              Hisab load ho raha hai...
            </p>
          </div>
        ) : displayedList.length === 0 ? (
          /* Empty state */
          <div className="card text-center py-10 px-4 border-dashed border-2 border-stone-200">
            <div className="text-5xl mb-2">🧾</div>
            <p className="text-lg font-bold text-stone-800">
              {viewFilter === "today" ? "Aaj koi kharcha nahi likha!" : "Is mahine koi kharcha nahi!"}
            </p>
            <p className="text-sm text-stone-500 mt-1">
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
                  className="card border-l-4 border-l-[#f97316] p-4 transition-all hover:shadow-md flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-2xl shrink-0">
                      {catInfo?.icon || "💵"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-lg font-extrabold text-[#1c1917] truncate">
                          {exp.category}
                        </h4>
                        {exp.note && (
                          <span className="text-xs text-stone-600 truncate font-medium">
                            • {exp.note}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#78716c] font-semibold mt-0.5">
                        👤 {exp.addedBy} • {formatExpenseDate(exp.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-black text-stone-900">
                      {formatRupees(exp.amount)}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id, exp.category, exp.amount)}
                      disabled={isDeleting}
                      className="text-stone-400 hover:text-red-500 p-2 rounded-xl text-base transition cursor-pointer"
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
