// ============================================================
// app/(app)/expenses/page.tsx — Ghar ka Hisab (Expense Tracker)
// Elderly-friendly, large tap targets, Indian household palette
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

const CATEGORY_STYLES: Record<
  ExpenseCategory,
  { bg: string; text: string; border: string; activeBg: string }
> = {
  Sabzi: { bg: "bg-[#E8F4EC]", text: "text-[#2D5A38]", border: "border-[#CFE8D7]", activeBg: "bg-[#2D5A38]" },
  Doodh: { bg: "bg-[#EDF5F8]", text: "text-[#1E5266]", border: "border-[#D1E6ED]", activeBg: "bg-[#1E5266]" },
  Grocery: { bg: "bg-[#FAF4E5]", text: "text-[#6E541C]", border: "border-[#F2E5C5]", activeBg: "bg-[#6E541C]" },
  Electricity: { bg: "bg-[#FDF4E6]", text: "text-[#7A4E11]", border: "border-[#F8E3C3]", activeBg: "bg-[#7A4E11]" },
  Recharge: { bg: "bg-[#F1EEF8]", text: "text-[#483B75]", border: "border-[#DED7F0]", activeBg: "bg-[#483B75]" },
  Petrol: { bg: "bg-[#FAECE8]", text: "text-[#823223]", border: "border-[#F3D3CB]", activeBg: "bg-[#823223]" },
  Medical: { bg: "bg-[#FAEBEE]", text: "text-[#852C3D]", border: "border-[#F4D1D8]", activeBg: "bg-[#852C3D]" },
  Repair: { bg: "bg-[#F4EEF7]", text: "text-[#5C326E]", border: "border-[#E5D7EC]", activeBg: "bg-[#5C326E]" },
  "Rent/EMI": { bg: "bg-[#EEF2F6]", text: "text-[#2B4663]", border: "border-[#D4DFEC]", activeBg: "bg-[#2B4663]" },
  Others: { bg: "bg-[#F3EFEA]", text: "text-[#554E46]", border: "border-[#E2DBD1]", activeBg: "bg-[#554E46]" },
};

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
    if (authLoading) return;
    if (!profile?.familyId) {
      setLoading(false);
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
      const [y, m, d] = expenseDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const currentTime = new Date();
      dateObj.setHours(
        currentTime.getHours(),
        currentTime.getMinutes(),
        currentTime.getSeconds()
      );

      const userNickname = profile.nickname || profile.displayName || "Family Member";

      await addExpense({
        familyId: profile.familyId,
        amount: numAmount,
        category,
        note: note.trim() || undefined,
        addedBy: userNickname,
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
    <div className="px-4 pt-5 max-w-lg mx-auto pb-24">
      {/* ─── Header ─── */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F4B4C] flex items-center gap-2">
            <span>💰</span>
            <span>Ghar ka Hisab</span>
          </h1>
          {todayTotal > 0 && (
            <span className="bg-[#EBF3F3] text-[#1F4B4C] border border-[#CFE0E0] text-xs sm:text-sm font-bold px-3 py-1 rounded-full shrink-0">
              Aaj: {formatRupees(todayTotal)}
            </span>
          )}
        </div>
        {family && (
          <p className="text-[#6E675F] font-semibold text-xs sm:text-sm mt-0.5">
            👨‍👩‍👧‍👦 {family.name}
          </p>
        )}
      </div>

      {/* ─── 1. This Month Summary Card ────────────────────── */}
      <div className="card mb-5 bg-white border border-[#E5DFD5] p-5 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-[#6E675F] flex items-center gap-1.5 flex-wrap">
              <span>📅</span>
              <span>Is mahine ka kharcha</span>
              <span className="text-[#9E978E] font-medium">
                ({now.toLocaleString("hi-IN", { month: "long" })})
              </span>
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#2A2622] mt-1 tracking-tight">
              {formatRupees(thisMonthTotal)}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#EBF3F3] border border-[#CFE0E0] text-[#1F4B4C] flex items-center justify-center text-2xl shrink-0">
            ₹
          </div>
        </div>

        {/* Month Comparison */}
        {lastMonthTotal > 0 && (
          <div className="mt-3.5 pt-3.5 border-t border-[#E5DFD5] text-xs font-semibold flex items-center gap-2 flex-wrap text-[#423C36]">
            {diffFromLastMonth > 0 ? (
              <>
                <span className="bg-[#FBECE9] text-[#8F3324] border border-[#F3D3CB] px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0">
                  ▲ Zyada
                </span>
                <span>Pichle mahine se {formatRupees(diffFromLastMonth)} zyada kharcha hua</span>
              </>
            ) : diffFromLastMonth < 0 ? (
              <>
                <span className="bg-[#E8F0EA] text-[#346141] border border-[#C4DCCB] px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0">
                  ▼ Kam
                </span>
                <span>Pichle mahine se {formatRupees(Math.abs(diffFromLastMonth))} kam kharcha hua</span>
              </>
            ) : (
              <span className="text-[#6E675F]">Pichle mahine ke barabar kharcha hua ({formatRupees(lastMonthTotal)})</span>
            )}
          </div>
        )}

        {/* Category Breakdown (Tinted mini chips) */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-[#E5DFD5]">
            <p className="text-xs font-bold text-[#6E675F] mb-2">
              Kaha kitna kharch hua:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {categoryBreakdown.map(([cat, amt]) => {
                const catInfo = CATEGORIES.find((c) => c.label === cat);
                const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES.Others;
                return (
                  <div
                    key={cat}
                    className={`${style.bg} ${style.border} border px-2.5 py-1.5 rounded-lg flex items-center justify-between shadow-2xs`}
                  >
                    <span className={`truncate font-semibold ${style.text}`}>
                      {catInfo?.icon} {cat}
                    </span>
                    <span className="font-extrabold text-[#2A2622] ml-1 shrink-0">{formatRupees(amt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. Quick Add Expense Card ─────────────────────── */}
      <div className="card mb-5 bg-white border border-[#E5DFD5] p-5 rounded-2xl shadow-xs">
        <h3 className="text-lg font-bold text-[#2A2622] mb-3.5 flex items-center gap-2">
          <span>➕</span>
          <span>Naya kharcha jodein</span>
        </h3>

        <form onSubmit={handleAddExpense} className="space-y-4">
          {/* Amount input */}
          <div>
            <label htmlFor="expense-amount" className="block text-xs font-bold text-[#6E675F] mb-1">
              Rupaye (Amount) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#6E675F] pointer-events-none select-none z-10">
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
                className="input-field pl-9 text-2xl font-extrabold text-[#2A2622]"
                style={{ height: "56px" }}
              />
            </div>
          </div>

          {/* Category Picker (Individual Soft Tinted Chips) */}
          <div>
            <label className="block text-xs font-bold text-[#6E675F] mb-2">
              Category chunein *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.label;
                const style = CATEGORY_STYLES[cat.label] || CATEGORY_STYLES.Others;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1F4B4C] text-white border-[#1F4B4C] shadow-xs"
                        : `${style.bg} ${style.text} ${style.border} hover:opacity-90`
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note & Date Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="expense-note" className="block text-xs font-bold text-[#6E675F] mb-1">
                Kiska kharcha (Note / Description)
              </label>
              <input
                id="expense-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="jaise: Mother Dairy doodh"
                className="input-field text-sm"
              />
            </div>

            <div>
              <label htmlFor="expense-date" className="block text-xs font-bold text-[#6E675F] mb-1">
                Tarikh (Date)
              </label>
              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="input-field text-sm font-semibold"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={adding || !amount || parseFloat(amount) <= 0}
            className="btn-primary min-h-[52px] bg-[#1F4B4C] hover:bg-[#163738] text-white font-bold text-base shadow-xs disabled:opacity-50"
          >
            {adding ? "⏳ Jod rahe hain..." : "💰 Kharcha Jodein →"}
          </button>
        </form>
      </div>

      {/* ─── 3. Expenses List Section ──────────────────────── */}
      <div className="mb-4">
        {/* Toggle view: Today vs Month */}
        <div className="flex items-center justify-between gap-2 mb-3 bg-[#EFEAE1] p-1 rounded-xl border border-[#E5DFD5]">
          <button
            type="button"
            onClick={() => setViewFilter("today")}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer ${
              viewFilter === "today"
                ? "bg-white text-[#1F4B4C] shadow-xs"
                : "text-[#6E675F] hover:text-[#2A2622]"
            }`}
          >
            Aaj ke Kharche ({todayExpenses.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("month")}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer ${
              viewFilter === "month"
                ? "bg-white text-[#1F4B4C] shadow-xs"
                : "text-[#6E675F] hover:text-[#2A2622]"
            }`}
          >
            Is Mahine ke ({thisMonthExpenses.length})
          </button>
        </div>

        {/* List items */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-3xl mb-2 animate-spin">⏳</div>
            <p className="text-[#6E675F] text-sm">Kharche load ho rahe hain...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="bg-white border border-[#E5DFD5] rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">🧾</div>
            <h4 className="text-base font-bold text-[#2A2622] mb-1">
              {viewFilter === "today" ? "Aaj koi kharcha nahi joda" : "Is mahine koi kharcha nahi"}
            </h4>
            <p className="text-xs text-[#6E675F]">
              Upar diye form se naya kharcha add karein ya voice se bole.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedList.map((exp) => {
              const catInfo = CATEGORIES.find((c) => c.label === exp.category);
              const style = CATEGORY_STYLES[exp.category] || CATEGORY_STYLES.Others;
              return (
                <div
                  key={exp.id}
                  className="bg-white border border-[#E5DFD5] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs hover:border-[#CFE0E0] transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-lg ${style.bg} ${style.border} border flex items-center justify-center text-xl shrink-0`}>
                      {catInfo?.icon || "📦"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#2A2622] truncate">
                          {exp.category}
                        </span>
                        {exp.note && (
                          <span className="text-xs font-medium text-[#6E675F] truncate">
                            • {exp.note}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-[#9E978E] mt-0.5">
                        {formatExpenseDate(exp.date)} • {exp.addedBy}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base sm:text-lg font-extrabold text-[#2A2622]">
                      {formatRupees(exp.amount)}
                    </span>
                    <button
                      type="button"
                      disabled={deletingId === exp.id}
                      onClick={() => handleDelete(exp.id, exp.category, exp.amount)}
                      title="Hatayein (Delete)"
                      className="p-1.5 text-[#9E978E] hover:text-[#B84A39] rounded-md transition cursor-pointer text-xs"
                    >
                      {deletingId === exp.id ? "⏳" : "🗑️"}
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
