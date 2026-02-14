import { NextResponse } from "next/server";
import { buildDigestProps } from "@/lib/digest";
import { DigestEmail } from "@/lib/email/digest-template";
import { render } from "@react-email/components";
import { createElement } from "react";

export async function GET() {
  try {
    const result = await buildDigestProps();

    if (!result) {
      return new NextResponse(
        "<html><body><p>No active books to preview.</p></body></html>",
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const element = createElement(DigestEmail, result.props);
    const html = await render(element);

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Digest preview error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
