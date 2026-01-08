export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages[] required" });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    /* ================================
       SYSTEM PROMPT (TEXT ONLY)
       ================================ */
    const system = `
You are a service intake assistant for a commercial HVAC and restaurant equipment service company.

Ask ONE clear question at a time.
Use simple, non-technical language.
Determine urgency based on food safety and business impact.

Emergency rules:
- Walk-in cooler above 45°F = Emergency
- Freezer above 10°F = Emergency
- Gas smell = Emergency
- Fryer down during service hours = Emergency

You MUST respond in JSON only with this schema:

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

Rules:
- If information is missing, set done=false and ask the next best question.
- When all required info is collected, set done=true and reply:
"Thank you. Your service request has been sent to dispatch."
`;

    /* ================================
       CALL OPENAI
       ================================ */
    const payload = {
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: system },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ]
};


    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const aiText = await aiResp.text();
    if (!aiResp.ok) {
      return res.status(500).json({ error: "OpenAI error", detail: aiText });
    }

    const aiJson = JSON.parse(aiText);
    const content = aiJson?.choices?.[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON", raw: content });
    }

    /* ================================
       SEND TO SERVICEM8 WHEN DONE
       ================================ */
    if (parsed.done === true && parsed.ticket) {
      const {
        customer_name,
        business_name,
        service_address,
        equipment_type,
        problem_summary,
        priority_level
      } = parsed.ticket;

      await fetch("https://api.servicem8.com/api_1.0/inboxmessage.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.SERVICEM8_API_KEY
        },
        body: JSON.stringify({
          from_name: customer_name || "Website Intake",
          from_email: "no-reply@atlantars.com",
          to_email: process.env.SERVICEM8_INBOX_TO_EMAIL || "service@atlantars.com",
          subject: `[WEB AI INTAKE] ${priority_level || "Unknown"} — ${business_name}`,
          message_text:
            `SERVICE REQUEST SUMMARY\n` +
            `Customer Name: ${customer_name}\n` +
            `Business Name: ${business_name}\n` +
            `Service Address: ${service_address}\n` +
            `Equipment Type: ${equipment_type}\n` +
            `Problem Summary: ${problem_summary}\n` +
            `Priority Level: ${priority_level}\n`,
          message_type: "form"
        })
      );
    }

    /* ================================
       RETURN AI RESPONSE TO FRONTEND
       ================================ */
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: err?.message || String(err)
    });
  }
}
