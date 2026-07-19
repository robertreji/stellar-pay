import { NextRequest, NextResponse } from "next/server";
import { getRecipients, addRecipient, deleteRecipient } from "@/lib/services/recipientService";
import { bankService } from "@/lib/services/bankService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
    }

    const list = await getRecipients(username);
    return NextResponse.json({ success: true, recipients: list });
  } catch (error: any) {
    console.error("Recipients GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch recipients" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, name, upi_id, nickname, is_favorite } = body;

    if (!username || !name || !upi_id) {
      return NextResponse.json(
        { error: "Missing required fields: username, name, upi_id" },
        { status: 400 }
      );
    }

    // Validate UPI ID against the bank simulator
    console.log(`[api/recipients] Validating UPI ID ${upi_id} against bank simulator...`);
    const validation = await bankService.validateUpiId(upi_id);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error || "UPI ID not found in bank simulator." },
        { status: 400 }
      );
    }

    // Save recipient to database
    const saved = await addRecipient({
      username,
      name,
      upi_id,
      nickname,
      is_favorite,
    });

    return NextResponse.json({ success: true, recipient: saved });
  } catch (error: any) {
    console.error("Recipients POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to save recipient" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID parameter is required" }, { status: 400 });
    }

    await deleteRecipient(id);
    return NextResponse.json({ success: true, message: "Recipient deleted" });
  } catch (error: any) {
    console.error("Recipients DELETE error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete recipient" }, { status: 500 });
  }
}
