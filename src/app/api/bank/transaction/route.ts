import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    console.log(`Proxying transaction request to Ktor Reference Server for ID: ${id}`);
    const refRes = await fetch(`http://localhost:8091/transaction`, {
      headers: {
        Authorization: `Bearer ${id}`,
      },
    });

    if (!refRes.ok) {
      const errText = await refRes.text();
      fs.writeFileSync(
        path.join(process.cwd(), "error.log"),
        `Ktor error: Status ${refRes.status}, Body: ${errText}\n`,
        { flag: "a" }
      );
      return NextResponse.json({ error: `Reference server returned error: ${errText}` }, { status: refRes.status });
    }

    const data = await refRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Proxy transaction fetch error:", error);
    fs.writeFileSync(
      path.join(process.cwd(), "error.log"),
      `Fetch catch error: ${error.stack || error.message}\n`,
      { flag: "a" }
    );
    return NextResponse.json({ error: error.message || "Failed to fetch transaction details" }, { status: 500 });
  }
}


