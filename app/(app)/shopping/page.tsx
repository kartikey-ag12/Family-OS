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
    if (authLoading) return;
    if (!profile?.familyId) {
      setLoading(false);
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
      const userNickname = profile.nickname || profile.displayName || "Family Member";
      await addShoppingItem({
        familyId: profile.familyId,
        itemName: trimmedName,
        quantity: quantity.trim() || undefined,
        addedBy: userNickname,
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
      const userNickname = profile.nickname || profile.displayName || "Family Member";
      await toggleShoppingItemBought(
        item.id,
        !item.isBought,
        user.uid,
        userNickname
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
    <div className="px-4 pt-5 max-w-lg mx-auto pb-24">
      {/* ─── Header ─── */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F4B4C] flex items-center gap-2">
            <span>🛒</span>
            <span>Shopping List</span>
          </h1>
          {pendingItems.length > 0 && (
            <span className="bg-[#FAF4E5] text-[#6E541C] border border-[#F2E5C5] text-xs sm:text-sm font-bold px-3 py-1 rounded-full">
              {pendingItems.length} lana hai
            </span>
          )}
        </div>
        {family && (
          <p className="text-[#6E675F] font-semibold text-xs sm:text-sm mt-0.5">
            👨‍👩‍👧‍👦 {family.name}
          </p>
        )}
      </div>

      {/* ─── Quick Add Form Card ─── */}
      <div className="card mb-5 bg-white border border-[#E5DFD5] p-5 rounded-2xl shadow-xs">
        <h3 className="text-base sm:text-lg font-bold text-[#2A2622] mb-3 flex items-center gap-2">
          <span>➕</span>
          <span>Samaan Jodein (Quick Add)</span>
        </h3>

        <form onSubmit={handleAddItem} className="space-y-3">
          <div>
            <label htmlFor="shopping-item-name" className="block text-xs font-bold text-[#6E675F] mb-1">
              Samaan ka Naam *
            </label>
            <input
              id="shopping-item-name"
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="jaise: Aata, Tel, Cheeni, Doodh..."
              className="input-field text-base font-semibold"
            />
          </div>

          <div>
            <label htmlFor="shopping-item-quantity" className="block text-xs font-bold text-[#6E675F] mb-1">
              Kitna chahiye (Quantity, optional)
            </label>
            <input
              id="shopping-item-quantity"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="jaise: 2 kilo, 1 packet, 500 gram..."
              className="input-field text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={adding || !itemName.trim()}
            className="btn-primary min-h-[48px] bg-[#1F4B4C] hover:bg-[#163738] text-white font-bold text-base shadow-xs disabled:opacity-50"
          >
            {adding ? "⏳ Jod rahe hain..." : "🛒 List Me Jodein →"}
          </button>
        </form>
      </div>

      {/* ─── Pending Items (To Buy) ─── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-lg font-bold text-[#2A2622] flex items-center gap-2">
            <span>📋</span>
            <span>Khareedna Hai ({pendingItems.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="text-3xl mb-2 animate-spin">⏳</div>
            <p className="text-[#6E675F] text-sm">List load ho rahi hai...</p>
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="bg-white border border-[#E5DFD5] rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h4 className="text-base font-bold text-[#2A2622] mb-1">
              Koi samaan baaki nahi hai!
            </h4>
            <p className="text-xs text-[#6E675F]">
              Naya samaan jodne ke liye upar form use karein ya bol kar batayein.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-[#E5DFD5] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs hover:border-[#CFE0E0] transition"
              >
                {/* Large Checkbox Tap Target */}
                <button
                  type="button"
                  disabled={actionLoadingId === item.id}
                  onClick={() => handleToggleBought(item)}
                  className="w-8 h-8 rounded-lg border-2 border-[#1F4B4C] hover:bg-[#EBF3F3] flex items-center justify-center shrink-0 cursor-pointer transition"
                  title="Mark as Bought"
                >
                  {actionLoadingId === item.id ? (
                    <span className="text-xs animate-spin">⏳</span>
                  ) : (
                    <span className="opacity-0 hover:opacity-50 text-[#1F4B4C] text-sm font-bold">✓</span>
                  )}
                </button>

                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-[#2A2622] truncate">
                      {item.itemName}
                    </span>
                    {item.quantity && (
                      <span className="text-xs font-bold text-[#483B75] bg-[#F1EEF8] border border-[#DED7F0] px-2 py-0.5 rounded-md">
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-[#9E978E] mt-0.5">
                    {formatItemTime(item.addedAt)} • {item.addedBy}
                  </p>
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  disabled={actionLoadingId === item.id}
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 text-[#9E978E] hover:text-[#B84A39] rounded-md transition cursor-pointer text-xs shrink-0"
                  title="Hatayein"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Bought Items (Purchased) ─── */}
      {boughtItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={() => setShowBought((prev) => !prev)}
              className="text-sm font-bold text-[#6E675F] hover:text-[#2A2622] flex items-center gap-1.5 cursor-pointer"
            >
              <span>{showBought ? "▼" : "▶"}</span>
              <span>Khareed Liya ({boughtItems.length})</span>
            </button>

            <button
              type="button"
              disabled={clearing}
              onClick={handleClearBought}
              className="text-xs font-bold text-[#B84A39] hover:underline cursor-pointer disabled:opacity-50"
            >
              {clearing ? "⏳..." : "Sabhi Saaf Karein"}
            </button>
          </div>

          {showBought && (
            <div className="space-y-2">
              {boughtItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#F4F9F5] border border-[#C4DCCB] rounded-xl p-3 flex items-center justify-between gap-3 opacity-80"
                >
                  {/* Checked button (Undo) */}
                  <button
                    type="button"
                    disabled={actionLoadingId === item.id}
                    onClick={() => handleToggleBought(item)}
                    className="w-7 h-7 rounded-lg bg-[#4A7C59] text-white flex items-center justify-center shrink-0 cursor-pointer text-xs font-black shadow-2xs"
                    title="Undo (Wapas list me dalein)"
                  >
                    {actionLoadingId === item.id ? "⏳" : "✓"}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold line-through text-[#6E675F] truncate block">
                      {item.itemName} {item.quantity ? `(${item.quantity})` : ""}
                    </span>
                    {item.boughtBy && (
                      <span className="text-[10px] text-[#4A7C59] font-bold">
                        ✓ {item.boughtBy} ne khareeda
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={actionLoadingId === item.id}
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-[#9E978E] hover:text-[#B84A39] text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
