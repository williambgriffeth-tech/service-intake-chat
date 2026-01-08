import { NextResponse } from "next/server";

const BASE = "https://api.servicem8.com/api_1.0";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      customerName,
      companyName,
      serviceAddress,
      equipmentType,
      problemSummary,
      priorityLevel,
      phone,
      email,
    } = body ?? {};

    if (!customerName || !companyName || !serviceAddress || !problemSummary) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
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

    const resp = await fetch(`${BASE}/inboxmessage.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.SERVICEM8_API_KEY as string,
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
      return NextResponse.json(
        { ok: false, error: "ServiceM8 inbox create failed", detail },
        { status: resp.status }
      );
    }

    const inboxUuid = resp.headers.get("x-record-uuid");
    return NextResponse.json({ ok: true, inboxUuid });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Server error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
