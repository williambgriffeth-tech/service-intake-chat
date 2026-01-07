export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages[] required" });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const system = `
You are a service intake assistant for a commercial HVAC and restaurant equipment service company.

Ask ONE clear question at a time. Use simple language.
Determine urgency based on food safety and business impact.

Emergency rules:
- Walk-in cooler above 45°F = Emergency
- Freezer above 10°F = Emergency
- Gas smell = Emergency
- Fryer down during service hours = Emergency

You MUST respond ONLY as valid JSON in this schema:
{
  "reply": "string",
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
`;

    const payload = {
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    const rawText = data.output_text || "";
    const parsed = JSON.parse(rawText);

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
