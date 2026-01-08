export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages[] required" });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    // IMPORTANT: Must contain the word "JSON" because we use response_format json_object
    const system = `
You are a service intake assistant for a commercial HVAC and restaurant equipment service company.

Ask ONE clear question at a time. Use simple, non-technical language.
Determine urgency based on food safety and business impact.

Emergency rules:
- Walk-in cooler above 45°F = Emergency
- Freezer above 10°F = Emergency
- Gas smell = Emergency
- Fryer down during service hours = Emergency

You MUST respond in JSON only (valid JSON object) with this schema:
{
  "reply": "string (your next question or closing confirmation)",
  "done": boolean,
  "ticket": {
    "customer_name": "string",
    "business_name": "string",
    "service_address": "string",
    "equipment_type": "string",
    "problem_summary": "string",
    "priority_level": "Emergency|Same-Day|Scheduled|Unknown",
    "recommended_technician": "string"
  }
}

Rules:
- If not enough info, done=false and ask the next best question.
- When you have enough info, done=true, fill ticket fields as best as possible, and reply:
try {
  console.log("Sending to ServiceM8 inbox…");

  // ✅ Guard: only send when intake is complete
if (
  customerName &&
  companyName &&
  serviceAddress &&
  problemSummary
) {
  await fetch("/api/servicem8-inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName,
      companyName,
      serviceAddress,
      equipmentType,
      problemSummary,
      priorityLevel,
      phone,
      email,
    }),
  });
}


  const data = await res.json();
  console.log("ServiceM8 response:", data);
} catch (err) {
  console.error("ServiceM8 fetch failed:", err);
}


  "Thank you. Your service request has been sent to dispatch."
`;

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      response_format: { type: "json_object" }
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(500).json({ error: "OpenAI error", detail: text });
    }

    const data = JSON.parse(text);
    const content = data?.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "AI returned non-JSON", raw: content });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
