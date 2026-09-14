// ============================================================
// app/(app)/shopping/page.tsx — Family Shopping List
// Elderly-friendly, large tap targets, real-time live sync
// ============================================================
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  subscribeShoppingItems,
  addShoppingItem,
  toggleShoppingItemBought,
  deleteShoppingItem,
  clearBoughtShoppingItems,
} from "@/lib/firestore";
import type { ShoppingItem } from "@/lib/types";

function formatItemTime(date: Date | null | undefined): string {
  if (!date) return "";
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
    return `Aaj ${timeStr}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1} ${timeStr}`;
}

export default function ShoppingPage() {
  const { user, profile, family, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // Collapsible bought section (open by default if bought items exist)
  const [showBought, setShowBought] = useState(true);

  // Real-time subscription to family's shopping items
  useEffect(() => {
    if (!profile?.familyId) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeShoppingItems(profile.familyId, (newItems) => {
      setItems(newItems);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.familyId, authLoading]);

  // Separate pending vs bought items
  const pendingItems = useMemo(
    () => items.filter((item) => !item.isBought),
    [items]
  );
  const boughtItems = useMemo(
    () => items.filter((item) => item.isBought),
    [items]
  );

  // Quick Add Item Handler
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = itemName.trim();
    if (!trimmedName || !user || !profile?.familyId || adding) return;

    setAdding(true);
    try {
      await addShoppingItem({
        familyId: profile.familyId,
        itemName: trimmedName,
        quantity: quantity.trim() || undefined,
        addedBy: profile.displayName || user.displayName || "Family Member",
        addedByUid: user.uid,
        isBought: false,
      });
      setItemName("");
      setQuantity("");
    } catch (err) {
      console.error("Error adding shopping item:", err);
    } finally {
      setAdding(false);
    }
  }

  // Toggle item status (mark bought or undo)
  async function handleToggleBought(item: ShoppingItem) {
    if (!user || !profile || actionLoadingId) return;
    setActionLoadingId(item.id);
    try {
      await toggleShoppingItemBought(
        item.id,
        !item.isBought,
        user.uid,
        profile.displayName || user.displayName || "Family Member"
      );
    } catch (err) {
      console.error("Error toggling shopping item:", err);
    } finally {
      setActionLoadingId(null);
    }
  }

  // Delete single item
  async function handleDeleteItem(itemId: string) {
    if (actionLoadingId) return;
    setActionLoadingId(itemId);
    try {
      await deleteShoppingItem(itemId);
    } catch (err) {
      console.error("Error deleting shopping item:", err);
    } finally {
      setActionLoadingId(null);
    }
  }

  // Clear all bought items
  async function handleClearBought() {
    if (boughtItems.length === 0 || clearing) return;
    const confirmed = window.confirm(
      `Kya aap sabhi ${boughtItems.length} khareede huye samaan hatana chahte hain?`
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      const ids = boughtItems.map((item) => item.id);
      await clearBoughtShoppingItems(ids);
    } catch (err) {
      console.error("Error clearing bought items:", err);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="px-4 pt-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-[#1c1917] flex items-center gap-2">
            🛒 Samaan ki List
          </h1>
          {pendingItems.length > 0 && (
            <span className="bg-[#f97316] text-white text-sm font-extrabold px-3 py-1 rounded-full shadow-sm">
              {pendingItems.length} baaki
            </span>
          )}
        </div>
        {family && (
          <p className="text-[#f97316] font-semibold text-base mt-1">
            👨‍👩‍👧‍👦 {family.name}
          </p>
        )}
      </div>

      {/* Quick Add Form Card */}
      <div className="card mb-6 border-2 border-orange-200 bg-white/95 shadow-md">
        <h2 className="text-lg font-bold text-[#1c1917] mb-3 flex items-center gap-1.5">
          <span>➕</span> Naya Samaan Jodein
        </h2>

        <form onSubmit={handleAddItem} className="space-y-3">
          <div>
            <input
              id="shopping-item-name"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Samaan ka naam (jaise Dudh, Cheeni, Sabzi)..."
              required
              className="input-field text-lg font-medium"
              style={{ minHeight: "54px" }}
            />
          </div>

          <div className="flex gap-2">
            <input
              id="shopping-item-quantity"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Kitna? (optional, jaise 2 kilo, 1 pkt)"
              className="input-field flex-1 text-base"
              style={{ minHeight: "52px" }}
            />

            <button
              id="shopping-add-btn"
              type="submit"
              disabled={adding || !itemName.trim()}
              className="btn-primary flex-none px-6 font-extrabold text-lg text-white disabled:opacity-50"
              style={{
                background: "#f97316",
                minHeight: "52px",
                width: "auto",
              }}
            >
              {adding ? "⏳..." : "➕ Jodo"}
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-5xl mb-4 animate-spin">⏳</div>
          <p className="text-[#78716c] text-lg font-medium">
            Samaan ki list load ho rahi hai...
          </p>
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="card text-center py-12 px-4 mb-6 border-dashed border-2 border-stone-200">
          <div className="text-6xl mb-3">🧺</div>
          <h3 className="text-2xl font-bold text-[#1c1917] mb-2">
            List abhi khaali hai!
          </h3>
          <p className="text-[#78716c] text-base">
            Ghar ke liye jo bhi samaan chahiye, upar likh kar <b>Jodo</b> button dabayein.
          </p>
        </div>
      ) : (
        <>
          {/* ─── Pending Items Section ──────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-[#f97316]" />
              <h2 className="text-xl font-bold text-[#1c1917]">
                Khareedna hai ({pendingItems.length})
              </h2>
            </div>

            {pendingItems.length === 0 ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center mb-4">
                <p className="text-3xl mb-1">🎉</p>
                <p className="text-lg font-bold text-green-800">
                  Sabhi samaan khareed liya gaya hai!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingItems.map((item) => {
                  const isItemLoading = actionLoadingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="card border-l-4 border-l-[#f97316] transition-all hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h3 className="text-2xl font-extrabold text-[#1c1917] leading-snug">
                            {item.itemName}
                          </h3>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {item.quantity && (
                              <span className="bg-orange-100 text-orange-900 font-bold px-3 py-0.5 rounded-full text-sm">
                                📦 {item.quantity}
                              </span>
                            )}
                            <span className="text-[#78716c] text-xs font-semibold">
                              👤 {item.addedBy} • {formatItemTime(item.addedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Quick Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isItemLoading}
                          className="text-stone-400 hover:text-red-500 p-2 rounded-xl transition cursor-pointer text-lg leading-none"
                          title="Hatao (Delete)"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Large Action Button — Elderly friendly min-height 52px */}
                      <button
                        type="button"
                        id={`bought-btn-${item.id}`}
                        onClick={() => handleToggleBought(item)}
                        disabled={isItemLoading}
                        className="btn-primary w-full text-lg font-bold text-white shadow-sm"
                        style={{
                          background: isItemLoading ? "#d6d3d1" : "#16a34a",
                          minHeight: "52px",
                        }}
                      >
                        {isItemLoading ? "⏳..." : "✅ Le liya ✓"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Bought Items Section ───────────────────────── */}
          {boughtItems.length > 0 && (
            <div className="mt-8 pt-4 border-t-2 border-stone-200">
              {/* Collapsible Header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setShowBought((prev) => !prev)}
                  className="flex items-center gap-2 text-left font-bold text-stone-700 hover:text-stone-900 text-lg cursor-pointer"
                >
                  <span className="w-3 h-3 rounded-full bg-[#16a34a]" />
                  <span>
                    Khareed liya ({boughtItems.length})
                  </span>
                  <span className="text-stone-500 text-sm font-semibold">
                    {showBought ? "▲ Chhupayein" : "▼ Dikhayein"}
                  </span>
                </button>

                {/* Clear Bought Button */}
                <button
                  type="button"
                  id="clear-bought-btn"
                  onClick={handleClearBought}
                  disabled={clearing}
                  className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  {clearing ? "⏳ Hata rahe hain..." : "🗑️ Clear bought items"}
                </button>
              </div>

              {showBought && (
                <div className="space-y-2.5">
                  {boughtItems.map((item) => {
                    const isItemLoading = actionLoadingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="card bg-stone-50/80 border border-stone-200/80 p-4 transition-all opacity-85 hover:opacity-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 text-lg font-bold">✓</span>
                              <h4 className="text-xl font-bold text-stone-600 line-through truncate">
                                {item.itemName}
                              </h4>
                              {item.quantity && (
                                <span className="bg-stone-200 text-stone-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                  {item.quantity}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-stone-500 mt-1">
                              ✅ {item.boughtBy ?? "Kisi ne"} ne liya{" "}
                              {item.boughtAt && `• ${formatItemTime(item.boughtAt)}`}
                            </p>
                          </div>

                          {/* Undo / Wapas Button */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleBought(item)}
                              disabled={isItemLoading}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 shadow-sm cursor-pointer transition"
                              title="Wapas list mein dalein"
                            >
                              {isItemLoading ? "⏳" : "↺ Wapas jodo"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={isItemLoading}
                              className="text-stone-400 hover:text-red-500 p-2 rounded-xl text-base leading-none transition cursor-pointer"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
