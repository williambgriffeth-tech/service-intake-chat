export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST only" });
      return;
    }

    if (!req.body || !req.body.messages) {
      res.status(400).json({ error: "messages[] required" });
      return;
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "messages[] required" });
      return;
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "Missing OPENAI_API_KEY" });
      return;
    }

    const system =
      "You are a service intake assistant for a commercial HVAC and restaurant equipment service company.\n\n" +
      "Ask ONE clear question at a time.\n" +
      "Use simple, non-technical language.\n" +
      "Determine urgency based on food safety and business impact.\n\n" +
      "Emergency rules:\n" +
      "- Walk-in cooler above 45°F = Emergency\n" +
      "- Freezer above 10°F = Emergency\n" +
      "- Gas smell = Emergency\n" +
      "- Fryer down during service hours = Emergency\n\n" +
      "You MUST respond in valid JSON ONLY using this schema:\n\n" +
      "{\n" +
      '  "reply": "string",\n' +
      '  "done": boolean,\n' +
      '  "ticket": {\n' +
      '    "customer_name": "string",\n' +
      '    "business_name": "string",\n' +
      '    "service_address": "string",\n' +
      '    "equipment_type": "string",\n' +
      '    "problem_summary": "string",\n' +
      '    "priority_level": "Emergency|Same-Day|Scheduled|Unknown",\n' +
      '    "recommended_technician": "string"\n' +
      "  }\n" +
      "}\n\n" +
      "Rules:\n" +
      "- If information is missing, set done=false and ask the next best question.\n" +
      '- When all required info is collected, set done=true and reply exactly:\n' +
      '"Thank you. Your service request has been sent to dispatch."';

    const openAIMessages = [];
    openAIMessages.push({ role: "system", content: system });

    for (let i = 0; i < messages.length; i++) {
      openAIMessages.push({
        role: messages[i].role,
        content: messages[i].content
      });
    }

    const payload = {
      model: "gpt-4o-mini-2024-07-18",
      messages: openAIMessages
    };

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const aiText = await aiResp.text();

    if (!aiResp.ok) {
      res.status(500).json({ error: "OpenAI error", detail: aiText });
      return;
    }

    const aiJson = JSON.parse(aiText);
    const content = aiJson.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      res.status(500).json({ error: "AI returned invalid JSON", raw: content });
      return;
    }

    if (parsed.done === true && parsed.ticket) {
      await fetch("https://api.servicem8.com/api_1.0/inboxmessage.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.SERVICEM8_API_KEY
        },
        body: JSON.stringify({
          from_name: parsed.ticket.customer_name || "Website Intake",
          from_email: "no-reply@atlantars.com",
          to_email: process.env.SERVICEM8_INBOX_TO_EMAIL || "service@atlantars.com",
          subject:
            "[WEB AI INTAKE] " +
            (parsed.ticket.priority_level || "Unknown") +
            " — " +
            parsed.ticket.business_name,
          message_text:
            "SERVICE REQUEST SUMMARY\n" +
            "Customer Name: " + parsed.ticket.customer_name + "\n" +
            "Business Name: " + parsed.ticket.business_name + "\n" +
            "Service Address: " + parsed.ticket.service_address + "\n" +
            "Equipment Type: " + parsed.ticket.equipment_type + "\n" +
            "Problem Summary: " + parsed.ticket.problem_summary + "\n" +
            "Priority Level: " + parsed.ticket.priority_level + "\n",
          message_type: "form"
        })
      });
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({
      error: "Server error",
      detail: err.message || String(err)
    });
  }
}
