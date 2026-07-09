import { NextRequest, NextResponse } from "next/server";
import { registerUser, getUserByAddress, searchUsers } from "@/lib/db";

// POST /api/users — Register a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, stellarAddress } = body;

    if (!username || !stellarAddress) {
      return NextResponse.json(
        { error: "Username and stellar address are required" },
        { status: 400 }
      );
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-20 characters, letters, numbers, and underscores only",
        },
        { status: 400 }
      );
    }

    // Validate stellar address
    if (!/^G[A-Z2-7]{55}$/.test(stellarAddress)) {
      return NextResponse.json(
        { error: "Invalid Stellar address" },
        { status: 400 }
      );
    }

    const result = registerUser(username, stellarAddress);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json(
      { success: true, username, stellarAddress },
      { status: 201 }
    );
  } catch (error) {
    console.error("Users POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/users?address=...&q=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const query = searchParams.get("q");

  try {
    // Lookup by address
    if (address) {
      const user = getUserByAddress(address);
      if (!user) {
        return NextResponse.json({ user: null }, { status: 200 });
      }
      return NextResponse.json({ user });
    }

    // Search by username query
    if (query) {
      const users = searchUsers(query, 10);
      return NextResponse.json({ users });
    }

    return NextResponse.json(
      { error: "Provide ?address= or ?q= parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Users GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
