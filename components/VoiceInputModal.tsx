// ============================================================
// components/VoiceInputModal.tsx — Elderly-friendly Voice Assistant
// Browser Web Speech API (hi-IN) + Rule-based Intent Dispatcher
// ============================================================
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { parseVoiceInput, type ParsedVoiceResult } from "@/lib/voiceParser";
import { addExpense, addShoppingItem, addMedicine } from "@/lib/firestore";
import type { ExpenseCategory } from "@/lib/types";

// Type definition for Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export default function VoiceInputModal() {
  const { user, profile } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedVoiceResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"permission" | "unsupported" | "general" | null>(null);
  const [saving, setSaving] = useState(false);

  // Fallback Manual Edit State
  const [manualMode, setManualMode] = useState<"none" | "expense" | "shopping">("none");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<ExpenseCategory>("Sabzi");
  const [manualItemName, setManualItemName] = useState("");
  const [manualQty, setManualQty] = useState("");

  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorType(null);
      setStatusMessage("Sun raha hoon... Boliye (jaise: 'Sabzi 180 rupaye' ya 'Aata aur doodh lana hai')");
    };

    recognition.onresult = (event: any) => {
      let currentInterim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          currentInterim += item[0].transcript;
        }
      }

      if (currentInterim) setInterimText(currentInterim);
      if (finalTranscript) {
        setTranscript(finalTranscript);
        setInterimText("");
        handleProcessSpeech(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("[VoiceInput] Speech error:", event.error);
      setIsListening(false);

      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setErrorType("permission");
        setStatusMessage("Microphone permission band hai. Kripya browser settings me mic allow karein.");
      } else if (event.error === "no-speech") {
        setStatusMessage("Koi awaaz nahi sunai di. Dobara mic button dabakar boliye.");
      } else {
        setErrorType("general");
        setStatusMessage("Awaaz samajh nahi aayi. Kripya dobara koshish karein.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch (_) {}
    };
  }, []);

  // Start Voice Listening
  function startListening() {
    const win = typeof window !== "undefined" ? (window as any) : {};
    const hasSupport = !!(win.SpeechRecognition || win.webkitSpeechRecognition);

    if (!hasSupport) {
      setErrorType("unsupported");
      setIsOpen(true);
      setStatusMessage("Aapke browser me voice input support nahi hai. Kripya Google Chrome ya Edge use karein.");
      return;
    }

    setIsOpen(true);
    setTranscript("");
    setInterimText("");
    setParsedResult(null);
    setErrorType(null);
    setManualMode("none");

    try {
      recognitionRef.current?.start();
    } catch (e) {
      // If already started, restart
      try {
        recognitionRef.current?.stop();
        setTimeout(() => recognitionRef.current?.start(), 150);
      } catch (_) {}
    }
  }

  // Stop Listening
  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    setIsListening(false);
  }

  // Process and Route Speech Result
  function handleProcessSpeech(text: string) {
    if (!text.trim()) return;
    const result = parseVoiceInput(text);
    setParsedResult(result);

    // If high-confidence match, we can either prompt quick confirmation or auto-save
    if (result.type === "unknown") {
      setManualItemName(text);
      setManualAmount("");
    }
  }

  // Confirm and Save Parsed Action to Firestore
  async function handleExecuteAction(resultToSave?: ParsedVoiceResult) {
    const target = resultToSave || parsedResult;
    if (!target || !profile?.familyId || !user || saving) return;

    setSaving(true);
    const familyId = profile.familyId;
    const userName = profile.displayName || user.displayName || "Family Member";

    try {
      if (target.type === "expense") {
        await addExpense({
          familyId,
          amount: target.amount,
          category: target.category,
          note: target.note,
          addedBy: userName,
          addedByUid: user.uid,
          date: new Date(),
        });
        showToast(`✅ ${target.category} ₹${target.amount} hisab me add ho gaya!`);
      } else if (target.type === "shopping") {
        for (const item of target.items) {
          await addShoppingItem({
            familyId,
            itemName: item.itemName,
            quantity: item.quantity,
            addedBy: userName,
            addedByUid: user.uid,
            isBought: false,
          });
        }
        const itemNames = target.items.map((i) => i.itemName).join(", ");
        showToast(`✅ ${itemNames} shopping list me add ho gaya!`);
      } else if (target.type === "medicine") {
        await addMedicine({
          familyId,
          name: target.name,
          time: target.time,
          frequency: "daily",
          days: [0, 1, 2, 3, 4, 5, 6],
          takenAfterFood: target.takenAfterFood,
          assignedTo: userName,
          assignedToUid: user.uid,
          durationDays: null,
          startDate: new Date(),
          createdBy: user.uid,
          active: true,
        });
        showToast(`✅ ${target.name} (${target.time}) dawai reminder add ho gaya!`);
      }

      // Close modal
      setIsOpen(false);
      setParsedResult(null);
      setTranscript("");
    } catch (err) {
      console.error("[VoiceInput] Error saving action:", err);
      setStatusMessage("Save karne me error aaya. Kripya dobara koshish karein.");
    } finally {
      setSaving(false);
    }
  }

  // Fallback: Save manual expense
  async function handleSaveManualExpense() {
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0 || !profile?.familyId || !user || saving) return;

    setSaving(true);
    try {
      await addExpense({
        familyId: profile.familyId,
        amount: amt,
        category: manualCategory,
        note: transcript.trim() || undefined,
        addedBy: profile.displayName || user.displayName || "Family Member",
        addedByUid: user.uid,
        date: new Date(),
      });
      showToast(`✅ ${manualCategory} ₹${amt} hisab me add ho gaya!`);
      setIsOpen(false);
      setManualMode("none");
    } catch (err) {
      console.error("Error saving expense:", err);
    } finally {
      setSaving(false);
    }
  }

  // Fallback: Save manual shopping item
  async function handleSaveManualShopping() {
    if (!manualItemName.trim() || !profile?.familyId || !user || saving) return;

    setSaving(true);
    try {
      await addShoppingItem({
        familyId: profile.familyId,
        itemName: manualItemName.trim(),
        quantity: manualQty.trim() || undefined,
        addedBy: profile.displayName || user.displayName || "Family Member",
        addedByUid: user.uid,
        isBought: false,
      });
      showToast(`✅ ${manualItemName.trim()} shopping list me add ho gaya!`);
      setIsOpen(false);
      setManualMode("none");
    } catch (err) {
      console.error("Error saving shopping item:", err);
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }

  return (
    <>
      {/* ─── 1. Success Toast Notification ─────────────────────── */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white font-extrabold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-base border-2 border-orange-400 animate-bounce"
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 2. Floating Microphone Button ─────────────────────── */}
      <div className="fixed bottom-24 right-5 z-40 flex flex-col items-center">
        <button
          id="floating-voice-mic-btn"
          type="button"
          onClick={startListening}
          aria-label="Awaaz se jodein (Voice input)"
          title="Awaaz se jodein"
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer border-3 border-white focus:outline-none"
        >
          <svg
            className="w-8 h-8 text-white shrink-0 drop-shadow-xs"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>
        <span className="mt-1 bg-stone-900/80 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs">
          🎙️ Bol kar jodein
        </span>
      </div>

      {/* ─── 3. Voice Assistant Modal / Bottom Sheet ────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => {
            stopListening();
            setIsOpen(false);
          }}
        >
          <div
            className="bg-[#fff7ed] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border-t-4 sm:border-2 border-[#ea580c] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎙️</span>
                <h2 className="text-xl font-extrabold text-[#1c1917]">
                  Awaaz se Jodein (Voice Assistant)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setIsOpen(false);
                }}
                className="text-stone-400 hover:text-stone-800 p-2 text-xl font-black rounded-full cursor-pointer"
                title="Band karein (Close)"
              >
                ✕
              </button>
            </div>

            {/* ─── State A: Listening Animation & Real-time Transcript ─── */}
            {isListening && (
              <div className="text-center py-6">
                {/* Pulsing Mic Circle */}
                <div className="relative inline-flex items-center justify-center mb-4">
                  <div className="absolute w-24 h-24 rounded-full bg-orange-400 opacity-40 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-[#ea580c] text-white flex items-center justify-center shadow-lg">
                    <svg
                      className="w-10 h-10 animate-pulse"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-[#ea580c]">
                  Sun raha hoon...
                </h3>
                <p className="text-xs text-stone-600 font-bold mt-1 max-w-xs mx-auto">
                  Hindi ya Hinglish me boliye (jaise: &quot;Aaj sabzi 180 ki&quot; ya &quot;Aata aur doodh lana hai&quot;)
                </p>

                {/* Interim Live Speech Bubble */}
                <div className="mt-4 bg-white border-2 border-orange-200 rounded-2xl p-4 min-h-[60px] flex items-center justify-center shadow-inner">
                  <p className="text-lg font-extrabold text-[#1c1917] italic">
                    {interimText || transcript || "..."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={stopListening}
                  className="mt-4 bg-stone-800 hover:bg-stone-900 text-white font-bold text-sm px-6 py-2.5 rounded-full shadow-md cursor-pointer"
                >
                  🛑 Bolna band karein (Done)
                </button>
              </div>
            )}

            {/* ─── State B: Permission Denied or Error ─── */}
            {!isListening && errorType && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center my-4">
                <div className="text-3xl mb-1">⚠️</div>
                <p className="text-sm font-bold text-red-800 mb-3">
                  {statusMessage}
                </p>
                <button
                  type="button"
                  onClick={startListening}
                  className="bg-[#ea580c] text-white font-extrabold text-sm px-5 py-2.5 rounded-xl shadow-md cursor-pointer hover:bg-orange-700"
                >
                  🔄 Dobara Koshish Karein
                </button>
              </div>
            )}

            {/* ─── State C: Successfully Parsed Voice Intent ─── */}
            {!isListening && parsedResult && parsedResult.type !== "unknown" && (
              <div className="my-3 space-y-4">
                {/* Spoken Text summary */}
                <div className="bg-orange-100/70 border border-orange-200 px-3.5 py-2 rounded-xl text-xs text-stone-700 font-semibold">
                  Aapne bola: <span className="font-bold text-stone-950">&quot;{parsedResult.rawText}&quot;</span>
                </div>

                {/* Match Result Card */}
                {parsedResult.type === "expense" && (
                  <div className="bg-white border-2 border-orange-300 rounded-2xl p-4 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-2xl shrink-0">
                        💰
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#ea580c] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                          Ghar ka Hisab (Expense)
                        </span>
                        <h4 className="text-2xl font-black text-stone-900 mt-1">
                          ₹{parsedResult.amount}
                        </h4>
                        <p className="text-sm font-bold text-stone-600">
                          Category: <span className="text-stone-900">{parsedResult.category}</span>
                          {parsedResult.note && ` • Note: ${parsedResult.note}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {parsedResult.type === "shopping" && (
                  <div className="bg-white border-2 border-orange-300 rounded-2xl p-4 shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-2xl shrink-0">
                        🛒
                      </div>
                      <div className="flex-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Shopping List
                        </span>
                        <div className="mt-2 space-y-1.5">
                          {parsedResult.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-base font-extrabold text-stone-900 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200"
                            >
                              <span>• {item.itemName}</span>
                              {item.quantity && (
                                <span className="text-xs font-bold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-md">
                                  {item.quantity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {parsedResult.type === "medicine" && (
                  <div className="bg-white border-2 border-orange-300 rounded-2xl p-4 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-2xl shrink-0">
                        💊
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Dawai Reminder
                        </span>
                        <h4 className="text-xl font-black text-stone-900 mt-0.5">
                          {parsedResult.name}
                        </h4>
                        <p className="text-xs font-bold text-stone-600 mt-0.5">
                          ⏰ Samay: {parsedResult.time} • {parsedResult.takenAfterFood ? "Khane ke baad" : "Khali pet"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirmation Button */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleExecuteAction()}
                    className="btn-primary w-full text-white font-extrabold text-lg shadow-md transition cursor-pointer"
                    style={{ background: "#ea580c", minHeight: "52px" }}
                  >
                    {saving ? "⏳ Jod rahe hain..." : "✅ Sahi hai — Jodein (Save)"}
                  </button>

                  <button
                    type="button"
                    onClick={startListening}
                    className="text-stone-600 hover:text-stone-900 font-bold text-xs py-2 text-center cursor-pointer"
                  >
                    🔄 Dobara bole (Try again)
                  </button>
                </div>
              </div>
            )}

            {/* ─── State D: Unknown Intent Fallback ─── */}
            {!isListening && parsedResult && parsedResult.type === "unknown" && (
              <div className="my-2 space-y-3">
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 text-center">
                  <p className="text-2xl mb-0.5">🤔</p>
                  <h4 className="text-base sm:text-lg font-black text-stone-900">
                    Samajh nahi aaya, kya karna hai?
                  </h4>
                  <p className="text-xs text-stone-600 font-bold mt-1 break-words">
                    Aapne bola: <span className="text-stone-950 font-black">&quot;{parsedResult.rawText}&quot;</span>
                  </p>
                </div>

                {manualMode === "none" ? (
                  <div className="flex flex-col gap-2.5 w-full">
                    {/* 1. Shopping List Option */}
                    <button
                      type="button"
                      onClick={() => setManualMode("shopping")}
                      className="w-full py-3 px-4 rounded-xl border-2 border-amber-300 bg-white hover:bg-amber-50 active:bg-amber-100 text-stone-900 font-extrabold text-sm sm:text-base flex items-center justify-between shadow-xs cursor-pointer transition"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-lg shrink-0">🛒</span>
                        <span className="truncate">Shopping List me jodein</span>
                      </span>
                      <span className="text-amber-700 font-bold ml-2 shrink-0">➔</span>
                    </button>

                    {/* 2. Expense Option */}
                    <button
                      type="button"
                      onClick={() => setManualMode("expense")}
                      className="w-full py-3 px-4 rounded-xl border-2 border-orange-300 bg-white hover:bg-orange-50 active:bg-orange-100 text-stone-900 font-extrabold text-sm sm:text-base flex items-center justify-between shadow-xs cursor-pointer transition"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-lg shrink-0">💰</span>
                        <span className="truncate">Expense (Hisab) me jodein</span>
                      </span>
                      <span className="text-[#ea580c] font-bold ml-2 shrink-0">➔</span>
                    </button>

                    {/* 3. Cancel Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setParsedResult(null);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 font-bold text-xs sm:text-sm text-center cursor-pointer transition"
                    >
                      ❌ Cancel
                    </button>

                    {/* Retry Link */}
                    <button
                      type="button"
                      onClick={startListening}
                      className="text-stone-500 hover:text-stone-900 font-bold text-xs text-center pt-1 cursor-pointer"
                    >
                      🎙️ Dobara bole (Try again)
                    </button>
                  </div>
                ) : manualMode === "shopping" ? (
                  /* Pre-filled quick shopping confirmation */
                  <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 space-y-3">
                    <h5 className="font-extrabold text-sm text-stone-800 flex items-center gap-1.5">
                      <span>🛒</span> Shopping Item Confirm Karein
                    </h5>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                        Item ka Naam
                      </label>
                      <input
                        type="text"
                        value={manualItemName}
                        onChange={(e) => setManualItemName(e.target.value)}
                        className="input-field text-base text-stone-900 font-bold"
                        style={{ minHeight: "44px" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                        Quantity (Jaise 2 kilo / 1 packet)
                      </label>
                      <input
                        type="text"
                        value={manualQty}
                        onChange={(e) => setManualQty(e.target.value)}
                        placeholder="Optional"
                        className="input-field text-base text-stone-900"
                        style={{ minHeight: "44px" }}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setManualMode("none")}
                        className="w-1/3 py-2.5 rounded-xl border border-stone-300 bg-stone-100 text-stone-800 font-bold text-xs cursor-pointer"
                      >
                        Wapas
                      </button>
                      <button
                        type="button"
                        disabled={saving || !manualItemName.trim()}
                        onClick={handleSaveManualShopping}
                        className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "⏳..." : "🛒 Add Karo"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Pre-filled quick expense confirmation */
                  <div className="bg-white border-2 border-orange-200 rounded-2xl p-4 space-y-3">
                    <h5 className="font-extrabold text-sm text-stone-800 flex items-center gap-1.5">
                      <span>💰</span> Expense Confirm Karein
                    </h5>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                        Kitne Rupaye (Amount) *
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder="100"
                        className="input-field text-xl text-stone-900 font-extrabold"
                        style={{ minHeight: "44px" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                        Category
                      </label>
                      <select
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value as ExpenseCategory)}
                        className="input-field text-sm font-bold text-stone-900"
                        style={{ minHeight: "44px" }}
                      >
                        <option value="Sabzi">🥦 Sabzi / Phal</option>
                        <option value="Doodh">🥛 Doodh</option>
                        <option value="Grocery">🛒 Grocery / Ration</option>
                        <option value="Electricity">💡 Bijli Bill</option>
                        <option value="Recharge">📱 Mobile / Recharge</option>
                        <option value="Petrol">⛽ Petrol</option>
                        <option value="Medical">💊 Dawai / Doctor</option>
                        <option value="Repair">🔧 Repair</option>
                        <option value="Rent/EMI">🏠 Rent / EMI</option>
                        <option value="Others">📦 Others</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setManualMode("none")}
                        className="w-1/3 py-2.5 rounded-xl border border-stone-300 bg-stone-100 text-stone-800 font-bold text-xs cursor-pointer"
                      >
                        Wapas
                      </button>
                      <button
                        type="button"
                        disabled={saving || !manualAmount || parseFloat(manualAmount) <= 0}
                        onClick={handleSaveManualExpense}
                        className="flex-1 py-2.5 rounded-xl bg-[#ea580c] text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "⏳..." : "💰 Kharcha Jodo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
