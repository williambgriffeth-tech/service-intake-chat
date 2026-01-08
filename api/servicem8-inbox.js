export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }

  try {
    const {
      customerName,
      companyName,
      serviceAddress,
      equipmentType,
      problemSummary,
      priorityLevel,
      phone,
      email,
    } = req.body ?? {};

    if (!customerName || !companyName || !serviceAddress || !problemSummary) {
      res.status(400).json({ ok: false, error: "Missing required fields" });
      return;
    }

    const subject = `[WEB AI INTAKE] ${priorityLevel ?? "Standard"} — ${companyName}`;
    const messageText =
      `SERVICE REQUEST SUMMARY\n` +
      `Customer Name: ${customerName}\n` +
      `Business Name: ${companyName}\n` +
      `Service Address: ${serviceAddress}\n` +
      (phone ? `Phone: ${phone}\n` : "") +
      (email ? `Email: ${email}\n` : "") +
      `Equipment Type: ${equipmentType ?? "Unknown"}\n` +
      `Problem Summary: ${problemSummary}\n` +
      `Priority Level: ${priorityLevel ?? "Standard"}\n`;

    const resp = await fetch("https://api.servicem8.com/api_1.0/inboxmessage.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.SERVICEM8_API_KEY,
      },
      body: JSON.stringify({
        from_name: customerName,
        from_email: email ?? "no-reply@atlantars.com",
        to_email: process.env.SERVICEM8_INBOX_TO_EMAIL ?? "service@atlantars.com",
        subject,
        message_text: messageText,
        message_type: "form",
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      res.status(resp.status).json({ ok: false, error: "ServiceM8 inbox failed", detail });
      return;
    }

    const inboxUuid = resp.headers.get("x-record-uuid");
    res.status(200).json({ ok: true, inboxUuid });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error", detail: String(err?.message ?? err) });
  }
}
