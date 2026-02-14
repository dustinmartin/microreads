import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/digest";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "Missing authorization" },
      { status: 401 }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const secret = process.env.AUTH_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyDigest();
  return NextResponse.json(result);
}
