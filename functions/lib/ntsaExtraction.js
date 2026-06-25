"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNtsaFormFromImage = extractNtsaFormFromImage;
const EXTRACTION_PROMPT = `You are extracting structured data from scanned Kenyan NTSA Test Application Forms. Each page normally contains one form. Extract exactly one row per page/image.

Return ONLY valid JSON with these exact keys: name, idNumber, testApplicationNumber, amount, date.

1. name — applicant full name from the declaration sentence near the top. Remove leading markers. Exclude test-application fragments (AEV, EL, QE, RE, JA, EE, AQ, CM, ZP, VFLLLKA, BZEL, W). No placeholder values like 11. If unclear: REVIEW_REQUIRED.
2. idNumber — digits immediately after "ID NO:". Digits only. If unreadable: REVIEW_REQUIRED.
3. testApplicationNumber — full code from "TEST APPLICATION FORM -" (normally TDB-…). Distinguish O/0, B/8, Z/2, R/P, I/1. If unclear: REVIEW_REQUIRED.
4. amount — value after "Fee Paid - KES:" as a plain number without commas (e.g. 1050).
5. date — printed date after "Driving Test allocated as follows Date:". Format DD Month YYYY (e.g. 03 September 2025). Ignore handwritten dates. Watch 2025 vs 2028 misreads.

Ignore handwritten notes, signatures, photos, QR codes, logos, school codes, licence numbers, and vehicle class text. Use REVIEW_REQUIRED instead of guessing.`;
function cleanField(value) {
    return String(value ?? "").trim();
}
function parseNtsaExtraction(raw) {
    let data = {};
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error("Could not parse extraction response");
        data = JSON.parse(jsonMatch[0]);
    }
    else if (raw && typeof raw === "object") {
        data = raw;
    }
    else {
        throw new Error("Invalid extraction response");
    }
    const idDigits = cleanField(data.idNumber).replace(/\D/g, "");
    const amountDigits = cleanField(data.amount).replace(/\D/g, "");
    return {
        name: cleanField(data.name),
        idNumber: idDigits || cleanField(data.idNumber),
        testApplicationNumber: cleanField(data.testApplicationNumber).toUpperCase().replace(/\s+/g, ""),
        amount: amountDigits || cleanField(data.amount),
        date: cleanField(data.date),
    };
}
function resolveVisionApiKey() {
    const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
    if (openaiKey)
        return { provider: "openai", key: openaiKey };
    const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    if (geminiKey)
        return { provider: "gemini", key: geminiKey };
    throw new Error("Vision API not configured. Set OPENAI_API_KEY or GEMINI_API_KEY in the server environment.");
}
async function extractWithOpenAI(imageBase64, mimeType, apiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: EXTRACTION_PROMPT },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract the NTSA form fields from this image." },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                    ],
                },
            ],
        }),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`OpenAI vision request failed (${res.status})${err ? `: ${err.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json());
    const content = json.choices?.[0]?.message?.content ?? "";
    return parseNtsaExtraction(content);
}
async function extractWithGemini(imageBase64, mimeType, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            generationConfig: {
                temperature: 0,
                responseMimeType: "application/json",
            },
            contents: [
                {
                    parts: [
                        { text: EXTRACTION_PROMPT },
                        { text: "Extract the NTSA form fields from this image." },
                        { inlineData: { mimeType, data: imageBase64 } },
                    ],
                },
            ],
        }),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Gemini vision request failed (${res.status})${err ? `: ${err.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json());
    const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return parseNtsaExtraction(content);
}
async function extractNtsaFormFromImage(imageBuffer, mimeType) {
    const normalizedMime = mimeType.toLowerCase().startsWith("image/") ? mimeType : "image/jpeg";
    const imageBase64 = imageBuffer.toString("base64");
    const { provider, key } = resolveVisionApiKey();
    if (provider === "openai")
        return extractWithOpenAI(imageBase64, normalizedMime, key);
    return extractWithGemini(imageBase64, normalizedMime, key);
}
