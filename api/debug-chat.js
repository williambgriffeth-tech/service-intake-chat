export default async function handler(req, res) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Reply in JSON exactly like this: {\"ok\":true}" },
},
        { role: "user", content: "test" }
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

    return res.status(200).json({
      status: r.status,
      ok: r.ok,
      raw: text
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "server error" });
  }
}
