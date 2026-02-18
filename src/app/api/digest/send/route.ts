import { NextResponse } from "next/server";
import {
  sendDailyDigest,
  alreadySentToday,
  buildDigestProps,
  getEmailTo,
} from "@/lib/digest";
import { sendEmail } from "@/lib/email/send";
import { DigestEmail } from "@/lib/email/digest-template";
import { createElement } from "react";

export async function POST() {
  try {
    const wasSentToday = await alreadySentToday();

    if (wasSentToday) {
      // Idempotent: re-send the same email without advancing
      const emailTo = await getEmailTo();
      if (!emailTo) {
        return NextResponse.json(
          { sent: false, bookCount: 0, error: "No recipient email configured" },
          { status: 500 }
        );
      }

      const result = await buildDigestProps();
      if (!result) {
        return NextResponse.json({
          sent: false,
          bookCount: 0,
          message: "Already sent today, no active books to re-send",
        });
      }

      const element = createElement(DigestEmail, result.props);
      const subject = `Your Micro Reads - ${result.props.date}`;
      await sendEmail(emailTo, subject, element, result.attachments);

      return NextResponse.json({
        sent: true,
        bookCount: result.props.books.length,
        message: "Already sent today, re-sent without advancing",
      });
    }

    const result = await sendDailyDigest();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Digest send error:", message);
    return NextResponse.json(
      { sent: false, bookCount: 0, error: message },
      { status: 500 }
    );
  }
}
