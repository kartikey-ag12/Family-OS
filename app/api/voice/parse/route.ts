import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a Hindi/Hinglish Voice Command Intent Parser for "Family OS", an elderly-friendly family organizer app in India.
Your task is to analyze transcribed voice speech in Hindi / Hinglish / English and parse it into structured JSON.

You MUST classify the transcript into EXACTLY ONE of the following 4 schemas:

1. EXPENSE:
If the user mentions spending money, buying something with a price, paying bills, fuel, rent, recharge, etc.
Schema:
{
  "type": "expense",
  "amount": number (positive numeric value in Rupees),
  "category": "Sabzi" | "Doodh" | "Grocery" | "Electricity" | "Recharge" | "Petrol" | "Medical" | "Repair" | "Rent/EMI" | "Others",
  "note": string (optional short description)
}

Category Guidelines:
- "Sabzi": vegetables, fruits, sabji, phal, aloo, pyaaz, tamatar, etc.
- "Doodh": milk, doodh, dahi, paneer, butter, curd, etc.
- "Grocery": ration, rashan, aata, chawal, daal, tel, oil, cheeni, sugar, tea, spices, biscuits, etc.
- "Electricity": bijli bill, power, light bill, current bill.
- "Recharge": mobile recharge, phone, wifi, internet, jio, airtel, etc.
- "Petrol": petrol, diesel, fuel, cng.
- "Medical": doctor fees, clinic, chemist, pharmacy, medical bill, hospital.
- "Repair": plumber, electrician, mistri, mechanic, maintenance, AC service.
- "Rent/EMI": rent, kiraya, emi, kist, loan installment.
- "Others": any other miscellaneous expense.

2. SHOPPING:
If the user wants to add items to buy/bring from the market, grocery list, or mentions quantities without a monetary payment.
Schema:
{
  "type": "shopping",
  "items": [
    {
      "name": string (capitalized item name in English/Hinglish, e.g. "Aata", "Doodh", "Tel"),
      "quantity": string (optional, e.g. "2 kilo", "1 litre", "500 gram", "1 packet")
    }
  ]
}
Supports multiple items separated by "aur", "and", commas, etc.

3. MEDICINE:
If the user mentions medicine reminders, tablets, pills, doses, or taking medicine at a specific time.
Schema:
{
  "type": "medicine",
  "name": string (clean medicine name, e.g. "BP", "Paracetamol", "Sugar", "Thyroid"),
  "time": "HH:MM" (string in 24-hour format, e.g. "08:00", "14:30", "21:00". Defaults to "08:00" for morning / "20:00" for night if time is unspecified),
  "takenAfterFood": boolean (default true unless "khali pet", "khane se pehle", or "before food" is specified),
  "frequency": "daily"
}

4. UNKNOWN:
If the transcript does NOT clearly match an expense, shopping item, or medicine reminder (e.g. general chit-chat, weather, greetings, ambiguous phrases), return:
{
  "type": "unknown",
  "transcript": string (the input transcript)
}
DO NOT GUESS if the command is not related to expense, shopping, or medicine.

FEW-SHOT EXAMPLES:
User: "Aaj sabzi ke liye 180 rupaye kharch hue"
Output: {"type":"expense","amount":180,"category":"Sabzi","note":"sabzi"}

User: "Aaj sabzi 180 ki aayi"
Output: {"type":"expense","amount":180,"category":"Sabzi"}

User: "Do kilo aata aur ek litre tel mangwana hai"
Output: {"type":"shopping","items":[{"name":"Aata","quantity":"2 kilo"},{"name":"Tel","quantity":"1 litre"}]}

User: "2 kilo aata aur 1 litre tel list me daal do"
Output: {"type":"shopping","items":[{"name":"Aata","quantity":"2 kilo"},{"name":"Tel","quantity":"1 litre"}]}

User: "BP ki dawai subah 8 baje khane ke baad lena hai"
Output: {"type":"medicine","name":"BP","time":"08:00","takenAfterFood":true,"frequency":"daily"}

User: "Subah 8 baje BP ki dawai"
Output: {"type":"medicine","name":"BP","time":"08:00","takenAfterFood":true,"frequency":"daily"}

User: "Raat 9 baje paracetamol khali pet"
Output: {"type":"medicine","name":"Paracetamol","time":"21:00","takenAfterFood":false,"frequency":"daily"}

User: "Bike me 500 ka petrol dalwaya"
Output: {"type":"expense","amount":500,"category":"Petrol"}

User: "Bijli ka bill 1200 rupaye bhara"
Output: {"type":"expense","amount":1200,"category":"Electricity"}

User: "Aaj mausam accha hai"
Output: {"type":"unknown","transcript":"Aaj mausam accha hai"}

User: "Namaste beta kaise ho"
Output: {"type":"unknown","transcript":"Namaste beta kaise ho"}

Return ONLY valid JSON with no markdown tags or explanations.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const transcript = (body?.transcript || "").trim();

    if (!transcript) {
      return NextResponse.json(
        { type: "unknown", transcript: "" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[VoiceParser API] Missing GEMINI_API_KEY in environment variables.");
      return NextResponse.json(
        {
          type: "unknown",
          transcript,
          error: "GEMINI_API_KEY not configured",
        },
        { status: 500 }
      );
    }

    // Call Gemini Flash with 5-second timeout and fallback across active flash model versions
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const requestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Transcript: "${transcript}"` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1000,
      },
    };

    // Candidate flash models in preferred order
    const candidateModels = [
      "gemini-2.5-flash",
      "gemini-3.6-flash",
      "gemini-flash-latest",
    ];

    let response: Response | null = null;
    let lastErrorText = "";

    try {
      for (const model of candidateModels) {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
          const res = await fetch(geminiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          if (res.ok) {
            response = res;
            break;
          } else {
            lastErrorText = await res.text();
            console.warn(`[VoiceParser API] Model ${model} returned status ${res.status}:`, lastErrorText);
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === "AbortError") throw fetchErr;
          console.warn(`[VoiceParser API] Fetch failed for model ${model}:`, fetchErr);
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response) {
      console.error("[VoiceParser API] All Gemini candidate models failed:", lastErrorText);
      return NextResponse.json(
        {
          type: "unknown",
          transcript,
          error: lastErrorText || "Gemini API failed",
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      console.warn("[VoiceParser API] Empty response candidate from Gemini:", data);
      return NextResponse.json({ type: "unknown", transcript });
    }

    const parsed = JSON.parse(textOutput.trim());
    return NextResponse.json(parsed);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn("[VoiceParser API] Gemini API request timed out (5s).");
      return NextResponse.json(
        { type: "unknown", error: "Request timeout" },
        { status: 504 }
      );
    }

    console.error("[VoiceParser API] Unexpected error in /api/voice/parse:", err);
    return NextResponse.json(
      { type: "unknown", error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
