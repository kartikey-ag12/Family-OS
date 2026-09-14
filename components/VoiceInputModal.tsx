// ============================================================
// components/VoiceInputModal.tsx — Continuous Hands-free Voice Assistant
// Browser Web Speech API (hi-IN) + Voice Confirmation + Continuous Listening
// ============================================================
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  parseVoiceInput,
  isVoiceStopPhrase,
  isVoiceConfirmationYes,
  isVoiceConfirmationNo,
  getVoiceConfirmationPrompt,
  type ParsedVoiceResult,
} from "@/lib/voiceParser";
import { addExpense, addShoppingItem, addMedicine } from "@/lib/firestore";
import type { ExpenseCategory } from "@/lib/types";

// Type definition for Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

type SessionMode = "LISTENING_COMMAND" | "AWAITING_CONFIRMATION" | "MANUAL_FALLBACK";

interface AddedSessionItem {
  id: string;
  summary: string;
  type: "expense" | "shopping" | "medicine";
  timestamp: Date;
}

export default function VoiceInputModal() {
  const { user, profile } = useAuth();

  // Modal & Session State
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>("LISTENING_COMMAND");

  // Transcripts & Prompts
  const [interimText, setInterimText] = useState("");
  const [latestTranscript, setLatestTranscript] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState(
    "Hindi ya Hinglish me boliye (jaise: 'Aaj sabzi 180 ki' ya 'Aata aur doodh lana hai')"
  );

  // Active pending parsed result
  const [pendingResult, setPendingResult] = useState<ParsedVoiceResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"permission" | "unsupported" | "general" | null>(null);
  const [saving, setSaving] = useState(false);

  // Recent items saved in current continuous session
  const [sessionHistory, setSessionHistory] = useState<AddedSessionItem[]>([]);

  // Manual fallback inputs (when intent is ambiguous)
  const [manualMode, setManualMode] = useState<"none" | "expense" | "shopping">("none");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<ExpenseCategory>("Sabzi");
  const [manualItemName, setManualItemName] = useState("");
  const [manualQty, setManualQty] = useState("");

  // Refs for speech recognition & continuous loops
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef<boolean>(false);
  const sessionModeRef = useRef<SessionMode>("LISTENING_COMMAND");
  const pendingResultRef = useRef<ParsedVoiceResult | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    sessionModeRef.current = sessionMode;
  }, [sessionMode]);

  useEffect(() => {
    pendingResultRef.current = pendingResult;
  }, [pendingResult]);

  // Reset 30-second silence timer
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (!isSessionActiveRef.current) return;

    silenceTimeoutRef.current = setTimeout(() => {
      console.log("[VoiceAssistant] 30s silence timeout reached. Ending session.");
      stopContinuousSession();
      showToast("⏳ 30 seconds tak koi awaaz nahi aayi, voice session band ho gaya.");
    }, 30000);
  }, []);

  // Show floating toast
  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }

  // Save parsed result to Firestore
  const executeSaveAction = useCallback(
    async (target: ParsedVoiceResult) => {
      console.log("[VoiceAssistant:Save] executeSaveAction called with target:", JSON.stringify(target, null, 2));
      if (!profile?.familyId || !user) {
        console.warn("[VoiceAssistant:Save] Save blocked: missing profile.familyId or user", {
          hasFamilyId: !!profile?.familyId,
          hasUser: !!user,
        });
        return;
      }
      if (saving) {
        console.warn("[VoiceAssistant:Save] Save blocked: already in saving state");
        return;
      }

      setSaving(true);
      const familyId = profile.familyId;
      const userName = profile.displayName || user.displayName || "Family Member";

      try {
        let summary = "";
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
          summary = `💰 ${target.category} ₹${target.amount}`;
        } else if (target.type === "shopping") {
          console.log("[VoiceAssistant:Save:Shopping] Target items to save:", target.items);
          const rawItems = Array.isArray(target.items) ? target.items : [target.items];
          for (const rawItem of rawItems) {
            const itemObj = typeof rawItem === "string" ? { itemName: rawItem, quantity: undefined } : rawItem;
            const finalName = (itemObj.itemName || (itemObj as any).name || (itemObj as any).item || "").trim();
            if (!finalName) {
              console.warn("[VoiceAssistant:Save:Shopping] Skipping item with empty name:", rawItem);
              continue;
            }
            const finalQty = typeof itemObj.quantity === "string" ? itemObj.quantity.trim() : undefined;

            await addShoppingItem({
              familyId,
              itemName: finalName,
              quantity: finalQty,
              addedBy: userName,
              addedByUid: user.uid,
              isBought: false,
            });
            console.log(`[VoiceAssistant:Save:Shopping] Successfully saved "${finalName}" (qty: ${finalQty || "none"}) to Firestore.`);
          }
          const itemNames = rawItems
            .map((i: any) => {
              const n = typeof i === "string" ? i : (i.itemName || i.name || "Item");
              const q = typeof i === "object" && i.quantity ? ` (${i.quantity})` : "";
              return n + q;
            })
            .join(", ");
          summary = `🛒 ${itemNames || "Items"}`;
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
          summary = `💊 ${target.name} (${target.time})`;
        }

        // Add to recent items in session
        setSessionHistory((prev) => [
          {
            id: Math.random().toString(36).slice(2),
            summary,
            type: target.type as "expense" | "shopping" | "medicine",
            timestamp: new Date(),
          },
          ...prev,
        ]);

        showToast(`✅ ${summary} add ho gaya!`);

        // Transition back to listening for the NEXT command in continuous session
        setPendingResult(null);
        pendingResultRef.current = null;
        setSessionMode("LISTENING_COMMAND");
        setAssistantPrompt("✅ Add ho gaya! Agla command boliye, ya 'Band karo' boliye.");
      } catch (err) {
        console.error("[VoiceAssistant] Error saving action:", err);
        setAssistantPrompt("⚠️ Save karne me error aaya. Kripya dobara koshish karein.");
      } finally {
        setSaving(false);
      }
    },
    [profile?.familyId, user, saving]
  );

  // Stop the entire continuous voice session
  const stopContinuousSession = useCallback(() => {
    isSessionActiveRef.current = false;
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

    try {
      recognitionRef.current?.stop();
    } catch (_) {}

    setIsListening(false);
    setInterimText("");
  }, []);

  // Parse voice input using Gemini API with local rule-based fallback
  const parseVoiceWithAI = useCallback(async (transcript: string): Promise<ParsedVoiceResult> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        console.log("[VoiceAssistant:AI] Raw Gemini parser API response:", JSON.stringify(data, null, 2));

        if (data.type === "expense" && typeof data.amount === "number") {
          return {
            type: "expense",
            amount: data.amount,
            category: (data.category as ExpenseCategory) || "Others",
            note: data.note,
            confidence: "high",
            rawText: transcript,
          };
        }

        if (data.type === "shopping") {
          const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
          let extractedItems: { itemName: string; name?: string; quantity?: string }[] = [];

          if (Array.isArray(data.items) && data.items.length > 0) {
            extractedItems = data.items.map((item: any) => {
              if (typeof item === "string") {
                const n = capitalize(item.trim());
                return { itemName: n, name: n, quantity: undefined };
              }
              const rawName = (item.name || item.itemName || item.item || "Item").trim();
              const name = capitalize(rawName);
              const quantity = item.quantity || item.qty || undefined;
              return {
                itemName: name,
                name: name,
                quantity: quantity ? String(quantity).trim() : undefined,
              };
            });
          } else if (data.item || data.name || data.itemName) {
            const rawName = (data.name || data.itemName || data.item || "Item").trim();
            const name = capitalize(rawName);
            const quantity = data.quantity || data.qty || undefined;
            extractedItems = [{
              itemName: name,
              name: name,
              quantity: quantity ? String(quantity).trim() : undefined,
            }];
          }

          if (extractedItems.length > 0) {
            return {
              type: "shopping",
              items: extractedItems,
              confidence: "high",
              rawText: transcript,
            };
          }
        }

        if (data.type === "medicine" && data.name) {
          return {
            type: "medicine",
            name: data.name,
            time: data.time || "08:00",
            takenAfterFood: data.takenAfterFood !== undefined ? !!data.takenAfterFood : true,
            confidence: "high",
            rawText: transcript,
          };
        }

        return {
          type: "unknown",
          rawText: transcript,
          suggestedName: transcript.slice(0, 50),
        };
      }
    } catch (err) {
      console.warn("[VoiceAssistant] Gemini API fetch failed or timed out, falling back to local parser:", err);
    }

    // Graceful fallback to rule-based parser
    try {
      return parseVoiceInput(transcript);
    } catch (_) {
      return {
        type: "unknown",
        rawText: transcript,
        suggestedName: transcript.slice(0, 50),
      };
    }
  }, []);

  // Process incoming speech text based on current state machine mode
  const handleSpeechResult = useCallback(
    async (spokenText: string) => {
      const text = spokenText.trim();
      if (!text) return;

      resetSilenceTimer();
      setLatestTranscript(text);
      setInterimText("");

      // Check for global STOP command
      if (isVoiceStopPhrase(text)) {
        stopContinuousSession();
        setIsOpen(false);
        showToast("🛑 Voice session band ho gaya.");
        return;
      }

      const currentMode = sessionModeRef.current;
      const currentPending = pendingResultRef.current;

      // ─── Mode 1: Awaiting Confirmation ("Haan" / "Cancel") ───
      if (currentMode === "AWAITING_CONFIRMATION" && currentPending) {
        if (isVoiceConfirmationYes(text)) {
          // Voice confirmed: YES
          executeSaveAction(currentPending);
          return;
        }

        if (isVoiceConfirmationNo(text)) {
          // Voice confirmed: CANCEL
          setPendingResult(null);
          pendingResultRef.current = null;
          setSessionMode("LISTENING_COMMAND");
          setAssistantPrompt("❌ Cancel ho gaya. Agla command boliye, ya 'Band karo' boliye.");
          return;
        }

        // If not yes/no, user might be speaking a NEW command instead
        setAssistantPrompt("AI samajh raha hai...");
        const newResult = await parseVoiceWithAI(text);
        if (newResult.type !== "unknown") {
          setPendingResult(newResult);
          pendingResultRef.current = newResult;
          setAssistantPrompt(getVoiceConfirmationPrompt(newResult));
          return;
        }

        // Fallback prompt repetition
        setAssistantPrompt(
          `Samajh nahi aaya. '${getVoiceConfirmationPrompt(currentPending)}' — 'Haan' ya 'Cancel' boliye.`
        );
        return;
      }

      // ─── Mode 2: Listening for a Command ───
      setAssistantPrompt("AI samajh raha hai...");
      const result = await parseVoiceWithAI(text);

      if (result.type !== "unknown") {
        setPendingResult(result);
        pendingResultRef.current = result;
        setSessionMode("AWAITING_CONFIRMATION");
        setAssistantPrompt(getVoiceConfirmationPrompt(result));
      } else {
        // Unknown intent -> show fallback UI with 3 clear options
        setPendingResult(result);
        pendingResultRef.current = result;
        setSessionMode("MANUAL_FALLBACK");
        setManualItemName(text);
        setManualAmount("");
        setManualMode("none");
        setAssistantPrompt("Samajh nahi aaya, kya karna hai? Neeche diye options chunein ya dobara bole.");
      }
    },
    [executeSaveAction, parseVoiceWithAI, resetSilenceTimer, stopContinuousSession]
  );

  // Initialize Web Speech API instance
  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "hi-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorType(null);
      resetSilenceTimer();
    };

    recognition.onresult = (event: any) => {
      resetSilenceTimer();
      let interim = "";
      let finalSegment = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalSegment += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
      }

      if (finalSegment.trim()) {
        handleSpeechResult(finalSegment.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("[VoiceAssistant] Speech recognition event error:", event.error);

      if (event.error === "not-allowed" || event.error === "permission-denied") {
        isSessionActiveRef.current = false;
        setIsListening(false);
        setErrorType("permission");
        setAssistantPrompt("Microphone permission band hai. Kripya browser settings me allow karein.");
      } else if (event.error === "no-speech") {
        // No speech detected in current slice; continuous listening will keep going
      } else {
        // Network or general glitch
      }
    };

    // Auto-restart recognition if continuous session is active
    recognition.onend = () => {
      if (isSessionActiveRef.current) {
        try {
          recognition.start();
        } catch (_) {
          setTimeout(() => {
            if (isSessionActiveRef.current) {
              try {
                recognition.start();
              } catch (_) {}
            }
          }, 150);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch (_) {}
    };
  }, [handleSpeechResult, resetSilenceTimer]);

  // Start continuous listening session
  function startContinuousSession() {
    const win = typeof window !== "undefined" ? (window as any) : {};
    const hasSupport = !!(win.SpeechRecognition || win.webkitSpeechRecognition);

    if (!hasSupport) {
      setErrorType("unsupported");
      setIsOpen(true);
      setAssistantPrompt("Aapke browser me voice input support nahi hai. Kripya Google Chrome ya Edge use karein.");
      return;
    }

    setIsOpen(true);
    isSessionActiveRef.current = true;
    setSessionMode("LISTENING_COMMAND");
    setPendingResult(null);
    setLatestTranscript("");
    setInterimText("");
    setErrorType(null);
    setManualMode("none");
    setAssistantPrompt("Hindi ya Hinglish me boliye (jaise: 'Aaj sabzi 180 ki' ya 'Aata aur doodh lana hai')");

    try {
      recognitionRef.current?.start();
    } catch (_) {
      try {
        recognitionRef.current?.stop();
        setTimeout(() => {
          if (isSessionActiveRef.current) recognitionRef.current?.start();
        }, 150);
      } catch (_) {}
    }

    resetSilenceTimer();
  }

  // Manual fallback save: Expense
  async function handleSaveManualExpense() {
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0 || !profile?.familyId || !user || saving) return;

    setSaving(true);
    try {
      const userNickname = profile.nickname || profile.displayName || user.displayName || "Family Member";
      await addExpense({
        familyId: profile.familyId,
        amount: amt,
        category: manualCategory,
        note: latestTranscript.trim() || undefined,
        addedBy: userNickname,
        addedByUid: user.uid,
        date: new Date(),
      });

      const summary = `💰 ${manualCategory} ₹${amt}`;
      setSessionHistory((prev) => [
        {
          id: Math.random().toString(36).slice(2),
          summary,
          type: "expense",
          timestamp: new Date(),
        },
        ...prev,
      ]);

      showToast(`✅ ${summary} add ho gaya!`);
      setPendingResult(null);
      pendingResultRef.current = null;
      setSessionMode("LISTENING_COMMAND");
      setManualMode("none");
      setAssistantPrompt("✅ Add ho gaya! Agla command boliye, ya 'Band karo' boliye.");
    } catch (err) {
      console.error("Error saving manual expense:", err);
    } finally {
      setSaving(false);
    }
  }

  // Manual fallback save: Shopping
  async function handleSaveManualShopping() {
    if (!manualItemName.trim() || !profile?.familyId || !user || saving) return;

    setSaving(true);
    try {
      const userNickname = profile.nickname || profile.displayName || user.displayName || "Family Member";
      await addShoppingItem({
        familyId: profile.familyId,
        itemName: manualItemName.trim(),
        quantity: manualQty.trim() || undefined,
        addedBy: userNickname,
        addedByUid: user.uid,
        isBought: false,
      });

      const summary = `🛒 ${manualItemName.trim()}${manualQty ? ` (${manualQty})` : ""}`;
      setSessionHistory((prev) => [
        {
          id: Math.random().toString(36).slice(2),
          summary,
          type: "shopping",
          timestamp: new Date(),
        },
        ...prev,
      ]);

      showToast(`✅ ${summary} add ho gaya!`);
      setPendingResult(null);
      pendingResultRef.current = null;
      setSessionMode("LISTENING_COMMAND");
      setManualMode("none");
      setAssistantPrompt("✅ Add ho gaya! Agla command boliye, ya 'Band karo' boliye.");
    } catch (err) {
      console.error("Error saving manual shopping item:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ─── 1. Floating Success Toast Notification ─────────────── */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1F4B4C] text-white font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm border border-[#163738] animate-bounce"
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 2. Floating Microphone Button ─────────────────────── */}
      <div className="fixed bottom-20 right-4 sm:right-6 z-40 flex flex-col items-center">
        <button
          id="floating-voice-mic-btn"
          type="button"
          onClick={startContinuousSession}
          aria-label="Awaaz se jodein (Continuous Voice Input)"
          title="Awaaz se jodein"
          className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white focus:outline-none ${
            isListening
              ? "bg-[#B84A39] animate-pulse ring-4 ring-[#FBECE9]"
              : "bg-[#E8A33D] hover:bg-[#D4902B]"
          }`}
        >
          <svg
            className="w-7 h-7 text-white shrink-0 drop-shadow-xs"
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
        <span className="mt-1 bg-[#2A2622]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs">
          {isListening ? "🔴 Sun raha hoon..." : "🎙️ Bol kar jodein"}
        </span>
      </div>

      {/* ─── 3. Continuous Voice Assistant Modal / Sheet ────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => {
            stopContinuousSession();
            setIsOpen(false);
          }}
        >
          <div
            className="bg-[#FAF7F2] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border-t sm:border border-[#E5DFD5] max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD5] mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎙️</span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1F4B4C]">
                    Voice Assistant
                  </h2>
                  <p className="text-[11px] font-semibold text-[#6E675F]">
                    Awaaz se boliye, auto-confirm ho jayega
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopContinuousSession();
                  setIsOpen(false);
                }}
                className="text-[#9E978E] hover:text-[#2A2622] p-1.5 text-lg font-bold rounded-full cursor-pointer"
                title="Band karein (Close)"
              >
                ✕
              </button>
            </div>

            {/* ─── Active Status Banner & Visual Wave ─── */}
            <div className="bg-white border border-[#E5DFD5] rounded-2xl p-4 text-center shadow-xs mb-3.5">
              {isListening ? (
                <div className="flex flex-col items-center">
                  <div className="relative inline-flex items-center justify-center mb-1.5">
                    <div className="absolute w-14 h-14 rounded-full bg-[#E8A33D] opacity-30 animate-ping" />
                    <div className="relative w-11 h-11 rounded-full bg-[#E8A33D] text-white flex items-center justify-center shadow-xs">
                      <svg
                        className="w-5 h-5 animate-pulse"
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
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F0EA] text-[#346141] border border-[#C4DCCB]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4A7C59] animate-pulse" />
                    Sun raha hoon (Active)
                  </span>
                </div>
              ) : (
                <div className="text-[#6E675F] font-semibold text-xs">
                  Voice listening paused. Niche diye button se dobara shuru karein.
                </div>
              )}

              {/* Assistant Instruction / Speech Feedback */}
              <p className="text-xs sm:text-sm font-bold text-[#2A2622] mt-2 px-1">
                {assistantPrompt}
              </p>

              {/* Real-time Interim Live Bubble */}
              {interimText && (
                <div className="mt-2 bg-[#EBF3F3] border border-[#CFE0E0] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1F4B4C] italic">
                  🗣️ &quot;{interimText}&quot;
                </div>
              )}
            </div>

            {/* ─── State Error: Permission / Unsupported ─── */}
            {errorType && (
              <div className="bg-[#FBECE9] border border-[#F3D3CB] rounded-2xl p-4 text-center mb-3.5">
                <div className="text-2xl mb-1">⚠️</div>
                <p className="text-xs font-bold text-[#8F3324] mb-2">{assistantPrompt}</p>
                <button
                  type="button"
                  onClick={startContinuousSession}
                  className="bg-[#1F4B4C] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  🔄 Retry
                </button>
              </div>
            )}

            {/* ─── State 1: Awaiting Voice Confirmation Card ─── */}
            {sessionMode === "AWAITING_CONFIRMATION" && pendingResult && pendingResult.type !== "unknown" && (
              <div className="bg-white border-2 border-[#1F4B4C] rounded-2xl p-4 mb-3.5 shadow-sm animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4B4C] bg-[#EBF3F3] px-2 py-0.5 rounded-md border border-[#CFE0E0]">
                    Confirmation Pending
                  </span>
                  <span className="text-xs font-semibold text-[#6E675F]">
                    🗣️ &apos;Haan&apos; ya &apos;Cancel&apos; boliye
                  </span>
                </div>

                {/* Card details based on type */}
                {pendingResult.type === "expense" && (
                  <div className="flex items-center gap-3 bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DFD5]">
                    <span className="text-2xl">💰</span>
                    <div>
                      <h4 className="text-lg font-extrabold text-[#2A2622]">
                        ₹{pendingResult.amount}
                      </h4>
                      <p className="text-xs font-semibold text-[#6E675F]">
                        Category: <span className="text-[#2A2622] font-bold">{pendingResult.category}</span>
                        {pendingResult.note && ` • Note: ${pendingResult.note}`}
                      </p>
                    </div>
                  </div>
                )}

                {pendingResult.type === "shopping" && (
                  <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DFD5] space-y-1.5">
                    <span className="text-xs font-bold text-[#6E541C]">🛒 Shopping List:</span>
                    {pendingResult.items.map((it: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#2A2622] bg-white px-2.5 py-1 rounded-lg border border-[#E5DFD5]"
                      >
                        <span>• {it.itemName || it.name || "Item"}</span>
                        {it.quantity && (
                          <span className="text-[11px] font-semibold text-[#6E675F] bg-[#FAF7F2] border border-[#E5DFD5] px-1.5 py-0.5 rounded">
                            {it.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {pendingResult.type === "medicine" && (
                  <div className="flex items-center gap-3 bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DFD5]">
                    <span className="text-2xl">💊</span>
                    <div>
                      <h4 className="text-base font-bold text-[#2A2622]">{pendingResult.name}</h4>
                      <p className="text-xs font-semibold text-[#6E675F]">
                        ⏰ Samay: {pendingResult.time} • {pendingResult.takenAfterFood ? "Khane ke baad" : "Khane se pehle"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Voice + Tap Confirmation Buttons */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => executeSaveAction(pendingResult)}
                    className="py-2.5 px-3 rounded-xl bg-[#4A7C59] hover:bg-[#3E6A4B] text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>✓ Haan, Jodein</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setPendingResult(null);
                      pendingResultRef.current = null;
                      setSessionMode("LISTENING_COMMAND");
                      setAssistantPrompt("❌ Cancel ho gaya. Agla command boliye, ya 'Band karo' boliye.");
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#FAF7F2] hover:bg-[#F3EFEA] border border-[#E5DFD5] text-[#2A2622] font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>✕ Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* ─── State 2: Manual Fallback Option Card (When Ambiguous) ─── */}
            {sessionMode === "MANUAL_FALLBACK" && pendingResult && (
              <div className="bg-white border border-[#E5DFD5] rounded-2xl p-4 mb-3.5 shadow-xs">
                <p className="text-xs font-semibold text-[#6E675F] mb-2">
                  Aapne bola: <span className="font-bold text-[#2A2622]">&quot;{latestTranscript}&quot;</span>
                </p>

                {manualMode === "none" ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setManualMode("shopping")}
                      className="w-full py-2.5 px-3 rounded-xl border border-[#E5DFD5] bg-[#FAF7F2] hover:bg-[#F3EFEA] text-[#2A2622] font-bold text-xs sm:text-sm flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span>🛒</span> Shopping List me jodein
                      </span>
                      <span>➔</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setManualMode("expense")}
                      className="w-full py-2.5 px-3 rounded-xl border border-[#E5DFD5] bg-[#FAF7F2] hover:bg-[#F3EFEA] text-[#2A2622] font-bold text-xs sm:text-sm flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span>💰</span> Expense (Hisab) me jodein
                      </span>
                      <span>➔</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPendingResult(null);
                        pendingResultRef.current = null;
                        setSessionMode("LISTENING_COMMAND");
                        setAssistantPrompt("Agla command boliye, ya 'Band karo' boliye.");
                      }}
                      className="w-full py-2 rounded-xl text-[#6E675F] hover:text-[#2A2622] font-semibold text-xs text-center cursor-pointer"
                    >
                      Wapas (Next Command)
                    </button>
                  </div>
                ) : manualMode === "shopping" ? (
                  <div className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-xl p-3 space-y-2.5">
                    <h5 className="font-bold text-xs text-[#2A2622]">🛒 Shopping Item:</h5>
                    <input
                      type="text"
                      value={manualItemName}
                      onChange={(e) => setManualItemName(e.target.value)}
                      className="input-field text-sm font-semibold"
                      style={{ minHeight: "40px" }}
                      placeholder="Item name"
                    />
                    <input
                      type="text"
                      value={manualQty}
                      onChange={(e) => setManualQty(e.target.value)}
                      placeholder="Quantity (e.g. 2 kilo)"
                      className="input-field text-sm"
                      style={{ minHeight: "40px" }}
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setManualMode("none")}
                        className="w-1/3 py-2 rounded-lg bg-white border border-[#E5DFD5] text-[#2A2622] font-semibold text-xs cursor-pointer"
                      >
                        Wapas
                      </button>
                      <button
                        type="button"
                        disabled={saving || !manualItemName.trim()}
                        onClick={handleSaveManualShopping}
                        className="flex-1 py-2 rounded-lg bg-[#1F4B4C] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "⏳..." : "🛒 Add Karo"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-xl p-3 space-y-2.5">
                    <h5 className="font-bold text-xs text-[#2A2622]">💰 Expense:</h5>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="Amount (₹)"
                      className="input-field text-sm font-bold"
                      style={{ minHeight: "40px" }}
                    />
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as ExpenseCategory)}
                      className="input-field text-xs font-semibold"
                      style={{ minHeight: "40px" }}
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
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setManualMode("none")}
                        className="w-1/3 py-2 rounded-lg bg-white border border-[#E5DFD5] text-[#2A2622] font-semibold text-xs cursor-pointer"
                      >
                        Wapas
                      </button>
                      <button
                        type="button"
                        disabled={saving || !manualAmount || parseFloat(manualAmount) <= 0}
                        onClick={handleSaveManualExpense}
                        className="flex-1 py-2 rounded-lg bg-[#1F4B4C] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "⏳..." : "💰 Kharcha Jodo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Recent Items Added in this Continuous Session ─── */}
            {sessionHistory.length > 0 && (
              <div className="mb-3.5 bg-white border border-[#E5DFD5] rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#6E675F] uppercase tracking-wider">
                    📋 Abhi Add Kiye Gaye Items ({sessionHistory.length})
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {sessionHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs font-semibold text-[#2A2622] bg-[#FAF7F2] border border-[#E5DFD5] px-2.5 py-1.5 rounded-lg"
                    >
                      <span className="truncate">{item.summary}</span>
                      <span className="text-[10px] text-[#4A7C59] font-bold ml-1 shrink-0">✓ Saved</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Control Footer ─── */}
            <div className="pt-2 border-t border-[#E5DFD5] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopContinuousSession();
                    setIsOpen(false);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#2A2622] hover:bg-black text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <span>🛑 Ho gaya (Done)</span>
                </button>

                {!isListening && (
                  <button
                    type="button"
                    onClick={startContinuousSession}
                    className="py-2.5 px-4 rounded-xl bg-[#1F4B4C] hover:bg-[#163738] text-white font-bold text-xs sm:text-sm shadow-xs cursor-pointer transition"
                  >
                    🎙️ Resume
                  </button>
                )}
              </div>

              <div className="bg-[#FAF7F2] border border-[#E5DFD5] rounded-xl px-3 py-1.5 text-center text-[11px] text-[#6E675F] font-medium">
                💡 Bol kar band karne ke liye <strong>&quot;Band karo&quot;</strong> boliye.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
