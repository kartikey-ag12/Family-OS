// ============================================================
// lib/voiceParser.ts — Rule-based Hindi/Hinglish Voice Intent Parser
// Zero external AI APIs — pure keyword & regex pattern matching
// ============================================================

import type { ExpenseCategory } from "./types";

export type ParsedVoiceResult =
  | {
      type: "expense";
      amount: number;
      category: ExpenseCategory;
      note?: string;
      confidence: "high" | "medium";
      rawText: string;
    }
  | {
      type: "shopping";
      items: { itemName: string; quantity?: string }[];
      confidence: "high" | "medium";
      rawText: string;
    }
  | {
      type: "medicine";
      name: string;
      time: string; // HH:MM (24-hour format)
      takenAfterFood: boolean;
      confidence: "high" | "medium";
      rawText: string;
    }
  | {
      type: "unknown";
      rawText: string;
      suggestedName?: string;
    };

// ─── Voice Confirmation & Control Helpers ─────────────────────

export function isVoiceStopPhrase(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    /\b(band\s*karo|band\s*kar\s*do|stop|ruk\s*jao|khatam|ho\s*gaya|pura\s*ho\s*gaya|close|exit|done)\b/i.test(t) ||
    /(बंद\s*करो|रुक\s*जाओ|बस|स्टॉप|हो\s*गया|खत्म|बंद)/.test(t)
  );
}

export function isVoiceConfirmationYes(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    /\b(haan|ha|han|haa|yes|yeah|yep|ok|okay|theek\s*hai|sahi\s*hai|kardo|kar\s*do|add\s*karo|save\s*karo|jod\s*do|daal\s*do|ji\s*haan|sure|correct)\b/i.test(t) ||
    /(हां|हाँ|सही\s*है|हाँ\s*करो|ठीक\s*है|यस|ओके|जोड़ो|डाल\s*दो|कर\s*दो|सेव)/.test(t)
  );
}

export function isVoiceConfirmationNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    /\b(cancel|nahi|nahin|na|no|nope|mat\s*karo|cancel\s*karo|hatao|nahi\s*karna|rehne\s*do|reject)\b/i.test(t) ||
    /(नहीं|ना|कैंसिल|रहने\s*दो|मत\s*करो|हटाओ)/.test(t)
  );
}

export function getVoiceConfirmationPrompt(result: ParsedVoiceResult): string {
  if (result.type === "expense") {
    return `${result.category} ₹${result.amount} add karu? 'Haan' ya 'Cancel' boliye`;
  }
  if (result.type === "shopping") {
    const names = result.items.map((i) => i.itemName + (i.quantity ? ` (${i.quantity})` : "")).join(", ");
    return `${names} shopping list me add karu? 'Haan' ya 'Cancel' boliye`;
  }
  if (result.type === "medicine") {
    return `${result.name} dawai (${result.time}) reminder add karu? 'Haan' ya 'Cancel' boliye`;
  }
  return "Kya karna hai? 'Shopping', 'Expense' ya 'Cancel' boliye";
}

// ─── 1. Number & Devanagari Translation ───────────────────────

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

/**
 * Word numbers in Hindi/Hinglish.
 * Used only when accompanied by currency markers (e.g. "do sau rupaye", "sau rupaye").
 */
const HINDI_WORD_NUMBERS: Record<string, number> = {
  "ek": 1, "एक": 1,
  "do": 2, "दो": 2,
  "teen": 3, "तीन": 3,
  "chaar": 4, "char": 4, "चार": 4,
  "paanch": 5, "panch": 5, "पांच": 5, "पाँच": 5,
  "che": 6, "chheh": 6, "छह": 6, "छे": 6,
  "saat": 7, "सात": 7,
  "aath": 8, "आठ": 8,
  "nau": 9, "नौ": 9,
  "das": 10, "dus": 10, "दस": 10,
  "bees": 20, "बीस": 20,
  "tees": 30, "तीस": 30,
  "chalis": 40, "चालीस": 40,
  "pachaas": 50, "pachas": 50, "पचास": 50,
  "saath": 60, "साठ": 60,
  "sattar": 70, "सत्तर": 70,
  "assi": 80, "अस्सी": 80,
  "nabbe": 90, "नब्बे": 90,
  "sau": 100, "सौ": 100,
  "dedh": 1.5, "डेढ़": 1.5,
  "dhai": 2.5, "ढाई": 2.5,
  "hazaar": 1000, "hazar": 1000, "हजार": 1000,
};

/** Normalize Devanagari numerals to standard ASCII digits */
export function normalizeHindiNumbers(text: string): string {
  let normalized = text;
  for (const [dev, ascii] of Object.entries(DEVANAGARI_DIGITS)) {
    normalized = normalized.replaceAll(dev, ascii);
  }
  return normalized;
}

/**
 * Extract financial amount from text.
 * Checks for digit patterns (180, ₹500, Rs 50) and currency-adjacent word numbers.
 */
function extractExpenseAmount(text: string): number | null {
  const norm = normalizeHindiNumbers(text);

  // 1. Explicit currency symbol / prefix / suffix with digits (e.g. "₹180", "180 rupaye", "Rs. 500", "500 ka", "180 ki")
  const explicitCurrencyMatch = norm.match(/(?:₹|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i) ||
    norm.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|rupaye|rupee|rupees|inr|रुपये|रुपया)/i);

  if (explicitCurrencyMatch) {
    const numStr = (explicitCurrencyMatch[1] || explicitCurrencyMatch[0]).replace(/[^\d.]/g, "");
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 2. Standalone digits (e.g. "sabzi 180 ki", "petrol 500 ka", "doodh 60")
  // Check that the number is NOT followed by a quantity unit (kilo, litre, packet, gm, baje)
  const numberMatch = norm.match(/\b(\d+(?:\.\d+)?)\b(?!\s*(?:kilo|kg|gram|gm|g|litre|ltr|l|packet|darjan|dozen|baje|am|pm|बजे|किलो|लीटर|ग्राम))/i);
  if (numberMatch) {
    const parsed = parseFloat(numberMatch[1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 3. Spoken word numbers when accompanied by currency markers (e.g. "sau rupaye", "do sau rupaye", "paanch sau")
  if (/(?:rupaye|rupee|rupees|rs\.?|₹|sau|hazaar|hazar|रुपये|सौ|हजार)/i.test(norm)) {
    const words = norm.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (HINDI_WORD_NUMBERS[w] !== undefined) {
        let val = HINDI_WORD_NUMBERS[w];
        if (i + 1 < words.length) {
          const next = words[i + 1];
          if (next === "sau" || next === "सौ") val = val * 100;
          else if (next === "hazaar" || next === "hazar" || next === "हजार") val = val * 1000;
        }
        return val;
      }
    }
  }

  return null;
}

// ─── 2. Category Keyword Dictionaries ─────────────────────────

const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  Sabzi: [
    "sabzi", "sabji", "vegetable", "vegetables", "phal", "fruits", "fruit",
    "tamatar", "aloo", "pyaz", "pyaaz", "adrak", "lahsun", "dhaniya", "mirch",
    "gobhi", "palak", "bhindi", "kheera",
    "सब्जी", "सब्जियां", "सब्जी मंडी", "फल", "आलू", "प्याज", "टमाटर", "गोभी"
  ],
  Doodh: [
    "doodh", "dudh", "milk", "dahi", "curd", "paneer", "butter", "makhan", "ghee", "chaach", "lassi",
    "दूध", "दही", "पनीर", "मक्खन", "घी", "छाछ", "लस्सी", "mother dairy", "amul"
  ],
  Grocery: [
    "grocery", "ration", "kirana", "rashan", "atta", "aata", "chawal", "rice", "dal", "daal",
    "tel", "oil", "sarson", "refine", "cheeni", "chini", "sugar", "chai", "tea", "masala",
    "namak", "salt", "bread", "biscuit", "maggi", "soap", "surf",
    "किराना", "राशन", "आटा", "चावल", "दाल", "तेल", "चीनी", "चाय", "मसाला", "नमक", "ग्रॉसरी"
  ],
  Electricity: [
    "bijli", "electricity", "light bill", "power bill", "bijli bill", "current bill",
    "बिजली", "बिजली बिल", "लाइट बिल"
  ],
  Recharge: [
    "recharge", "mobile recharge", "phone recharge", "wifi", "wi-fi", "internet", "jio", "airtel", "vi", "broadband",
    "रिचार्ज", "मोबाइल", "फोन", "इंटरनेट", "वाईफाई"
  ],
  Petrol: [
    "petrol", "diesel", "fuel", "cng", "bike petrol", "scooter petrol",
    "पेट्रोल", "डीजल", "सीएनजी"
  ],
  Medical: [
    "doctor fees", "doctor fee", "dr fees", "clinic", "hospital", "chemist", "pharmacy", "medical bill", "medical store",
    "दवा का बिल", "डॉक्टर फीस", "मेडिकल बिल", "अस्पताल"
  ],
  Repair: [
    "repair", "plumber", "electrician", "mistri", "mistry", "mechanic", "carpenter",
    "ghar ka kaam", "repairing", "service", "ac service",
    "रिपेयर", "मरम्मत", "प्लंबर", "मिस्त्री", "इलेक्ट्रीशियन"
  ],
  "Rent/EMI": [
    "rent", "kiraya", "house rent", "room rent", "emi", "kist", "kisht", "installment", "loan",
    "किराया", "ईएमआई", "किस्त", "लोन"
  ],
  Others: [
    "kharcha", "kharch", "saman", "other", "others", "khud", "extra",
    "खर्च", "खर्चा", "अन्य", "सामान"
  ],
};

function matchCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(lower) || lower.includes(kw.toLowerCase())) {
        return category as ExpenseCategory;
      }
    }
  }

  // Fallback check for medical expense if "dawai" + "rupaye" / "bill" is present
  if (/(?:dawai|dawa|medicine|tablet|goli|दवाई|दवा)\b/i.test(lower) && /(?:rupaye|rupee|rs\.?|₹|bill|kharcha|रुपये|बिल)/i.test(lower)) {
    return "Medical";
  }

  return "Others";
}

// ─── 3. Intent Detection Logic ────────────────────────────────

export function parseVoiceInput(rawTranscript: string): ParsedVoiceResult {
  const text = rawTranscript.trim();
  if (!text) {
    return { type: "unknown", rawText: "" };
  }

  const lower = text.toLowerCase();
  const normalized = normalizeHindiNumbers(lower);

  // ─────────────────────────────────────────────────────────────
  // 1. PRIORITY 1: Check for MEDICINE REMINDER Pattern
  // Trigger: Contains medicine keyword AND (time marker OR reminder context)
  // ─────────────────────────────────────────────────────────────
  const hasMedKeyword =
    /\b(dawai|dawa|medicine|medicines|tablet|tablets|goli|capsule|capsules|syrup|drops|paracetamol|crocin|combiflam|pantocid|bp|sugar|thyroid|insulin|vitamins|calcium|injection)\b/i.test(lower) ||
    /(दवाई|दवा|गोली|टैबलेट|कैप्सूल|सिरप|पैरासिटामोल|बीपी|शुगर|इंसुलिन|कैल्शियम|विटामिन)/.test(text);

  const hasTimeKeyword =
    /\b(\d{1,2}(?::\d{2})?\s*(?:baje|am|pm|बजे))\b/i.test(normalized) ||
    /\b(subah|shaam|dopahar|raat|सुबह|शाम|दोपहर|रात)\s*\d{1,2}\b/i.test(normalized) ||
    /\b(subah|shaam|dopahar|raat|सुबह|शाम|दोपहर|रात|time|baje|बजे)\b/i.test(lower);

  const isExplicitMedicalExpense =
    /(?:rupaye|rupee|rupees|rs\.?|₹|bill|kharcha|fees|fee|रुपये|रुपया|बिल|खर्च|फीस)/i.test(lower);

  // If medicine signals are present and it's not explicitly a monetary payment/bill, treat as medicine reminder
  if (hasMedKeyword && (hasTimeKeyword || /reminder|yaad|lena|khana|time/i.test(lower)) && !isExplicitMedicalExpense) {
    const parsedMed = parseMedicineIntent(text, normalized);
    if (parsedMed) return parsedMed;
  }

  // Also catch cases where time marker + medicine name is spoken without explicit "dawai" keyword (e.g. "Raat 9 baje paracetamol")
  if (hasTimeKeyword && !isExplicitMedicalExpense) {
    const parsedMed = parseMedicineIntent(text, normalized);
    if (parsedMed && parsedMed.type === "medicine" && parsedMed.name !== "Dawai") {
      return parsedMed;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. PRIORITY 2: Check for SHOPPING LIST Pattern
  // Explicit triggers: "list me daalo", "lana hai", "chahiye", "le aana", "mangwana hai"
  // OR phrases with quantity units ("2 kilo", "1 litre") and NO currency markers
  // ─────────────────────────────────────────────────────────────
  const isExplicitShoppingPhrase =
    /(?:list\s*me|list\s*mein|shopping\s*list|laana\s*hai|lana\s*hai|laana|lana|le\s*aana|le\s*aao|mangwana\s*hai|mangwana|mangwa\s*lo|kharidna\s*hai|kharidna|kharid\s*lo|chahiye|daal\s*do|dal\s*do|add\s*karo|jod\s*do|लिस्ट\s*में|लाना\s*है|लाना|ले\s*आना|ले\s*आओ|मंगवाना|खरीदना|चाहिए|जोड़ो)/i.test(lower);

  const hasQuantityUnit =
    /\b\d+(?:\.\d+)?\s*(?:kilo|kg|gram|gm|g|litre|ltr|l|packet|pkt|darjan|dozen|piece|bottles?|किलो|ग्राम|लीटर|पैकेट)\b/i.test(normalized);

  const hasCurrencyMarker =
    /(?:₹|rs\.?|rupaye|rupee|rupees|inr|रुपये|रुपया|bill|बिल|kharcha|kharch|खर्च|खर्चा)/i.test(lower);

  if ((isExplicitShoppingPhrase || hasQuantityUnit) && !hasCurrencyMarker) {
    const shoppingItems = parseShoppingIntent(text);
    if (shoppingItems.length > 0) {
      return {
        type: "shopping",
        items: shoppingItems,
        confidence: "high",
        rawText: text,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PRIORITY 3: Check for EXPENSE Pattern
  // Must contain an amount + either currency/expense words OR specific category
  // ─────────────────────────────────────────────────────────────
  const amount = extractExpenseAmount(text);
  const matchedCat = matchCategory(text);
  const hasExpenseContext =
    hasCurrencyMarker ||
    /\b(ki|ka|ke|me|mein|diye|diya|bhara|bharwaya|lag|gaye|का|की|में|दिए|भरा)\b/i.test(lower);

  if (amount !== null && (hasExpenseContext || matchedCat !== "Others")) {
    let note = text
      .replace(/(?:aaj|kal|ko|ka|ki|ke|rupaye|rupee|rs\.?|₹|\d+|खर्च|रुपये|का|की|में|add\s*karo|jod\s*do|likh\s*lo)/gi, "")
      .trim();

    return {
      type: "expense",
      amount,
      category: matchedCat,
      note: note.length > 2 ? note : undefined,
      confidence: "high",
      rawText: text,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Fallback / Unknown Intent
  // ─────────────────────────────────────────────────────────────
  return {
    type: "unknown",
    rawText: text,
    suggestedName: text.slice(0, 50),
  };
}

// ─── Helpers: Medicine Parsing ────────────────────────────────

function parseMedicineIntent(text: string, normalized: string): ParsedVoiceResult | null {
  let hour = 8;
  let minute = 0;
  let isPM = /\b(shaam|raat|dopahar|pm|शाम|रात|दोपहर)\b/i.test(normalized);

  const timeMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|am|pm|बजे)?/i);

  if (timeMatch && timeMatch[1]) {
    hour = parseInt(timeMatch[1], 10);
    if (timeMatch[2]) minute = parseInt(timeMatch[2], 10);

    if (isPM && hour < 12) hour += 12;
    if (!isPM && /\b(subah|am|सुबह)\b/i.test(normalized) && hour === 12) hour = 0;
  } else {
    if (/\b(subah|सुबह)\b/i.test(normalized)) hour = 8;
    else if (/\b(dopahar|दोपहर)\b/i.test(normalized)) hour = 13;
    else if (/\b(shaam|शाम)\b/i.test(normalized)) hour = 18;
    else if (/\b(raat|रात)\b/i.test(normalized)) hour = 21;
  }

  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const takenAfterFood = !/(?:khali\s*pet|bina\s*khaye|khane\s*se\s*pehle|खाली\s*पेट)/i.test(normalized);

  let medName = text
    .replace(/\b(?:kal|aaj|subah|shaam|dopahar|raat|baje|\d{1,2}(?::\d{2})?|am|pm|ki|ka|ke|ko|se|dawai|dawa|medicine|tablet|goli|lena|dena|yaad\s*dilana|reminder|set\s*karo|add\s*karo|khane\s*ke\s*baad|khali\s*pet|khane\s*se\s*pehle|khana|baad|pehle)\b/gi, " ")
    .replace(/(?:दवाई|दवा|गोली|बजे|सुबह|शाम|रात|कल|खाने\s*के\s*बाद|खाली\s*पेट|पहले|खाना)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!medName || medName.length < 2) {
    medName = "Dawai";
  } else {
    medName = medName.charAt(0).toUpperCase() + medName.slice(1);
  }

  return {
    type: "medicine",
    name: medName,
    time: timeStr,
    takenAfterFood,
    confidence: "high",
    rawText: text,
  };
}

// ─── Helpers: Shopping List Parsing ───────────────────────────

function parseShoppingIntent(text: string): { itemName: string; quantity?: string }[] {
  let cleaned = text
    .replace(/(?:shopping\s*list\s*me|list\s*me|list\s*mein|me\s*daal\s*do|daal\s*do|dal\s*do|add\s*karo|jod\s*do|laana\s*hai|lana\s*hai|le\s*aana|le\s*aao|mangwana\s*hai|mangwa\s*lo|kharidna\s*hai|chahiye|kripya|please|लिस्ट\s*में\s*डाल\s*दो|लिस्ट\s*में|लाना\s*है|ले\s*आना|चाहिए)/gi, " ")
    .trim();

  const rawParts = cleaned.split(/(?:\s+(?:aur|and|tatha|evam|saath\s*me|और|एवं)\s+|,|\+)/i);
  const results: { itemName: string; quantity?: string }[] = [];

  for (const part of rawParts) {
    const itemStr = part.trim();
    if (!itemStr || itemStr.length < 2) continue;

    const qtyMatch = itemStr.match(/(\d+(?:\.\d+)?\s*(?:kilo|kg|gram|gm|g|litre|ltr|l|packet|pkt|darjan|dozen|piece|bottles?|किलो|ग्राम|लीटर|पैकेट))/i);

    let quantity: string | undefined = undefined;
    let itemName = itemStr;

    if (qtyMatch && qtyMatch[0].trim().length > 0) {
      quantity = qtyMatch[0].trim();
      itemName = itemName.replace(qtyMatch[0], "").trim();
    }

    if (itemName.length > 0) {
      const formattedName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
      results.push({
        itemName: formattedName,
        quantity: quantity || undefined,
      });
    }
  }

  return results;
}
