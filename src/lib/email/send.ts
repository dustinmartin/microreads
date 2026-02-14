import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import type { ReactElement } from "react";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  reactElement: ReactElement,
  attachments?: nodemailer.SendMailOptions["attachments"]
): Promise<void> {
  const transport = createTransport();
  const html = await render(reactElement);

  await transport.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    html,
    attachments,
  });
}
