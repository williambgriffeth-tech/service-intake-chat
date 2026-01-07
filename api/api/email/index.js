import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { ticket, transcript } = req.body || {};
    if (!ticket) return res.status(400).json({ error: "ticket required" });

    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const DISPATCH_TO_EMAIL = process.env.DISPATCH_TO_EMAIL;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !DISPATCH_TO_EMAIL) {
      return res.status(500).json({ error: "Missing email env vars" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    });

    const body =
`NEW SERVICE REQUEST

Customer Name: ${ticket.customer_name || ""}
Business Name: ${ticket.business_name || ""}
Service Address: ${ticket.service_address || ""}

Equipment Type: ${ticket.equipment_type || ""}
Problem Summary: ${ticket.problem_summary || ""}

Priority Level: ${ticket.priority_level || ""}
Recommended Technician: ${ticket.recommended_technician || ""}

--- Transcript ---
${transcript || ""}`.trim();

    await transporter.sendMail({
      from: GMAIL_USER,
      to: DISPATCH_TO_EMAIL,
      subject: "New Service Request – Website AI Intake",
      text: body
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Email error" });
  }
}
