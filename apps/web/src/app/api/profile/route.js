import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const rows =
      await sql`SELECT id, name, email, image, display_name FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const u = rows[0];
    if (!u) return Response.json({ profile: null });

    // Detect provider via auth_accounts
    const accountRows = await sql`
      SELECT provider FROM auth_accounts WHERE "userId" = ${session.user.id} ORDER BY id ASC LIMIT 1
    `;
    const provider = accountRows[0]?.provider || "email";

    return Response.json({
      profile: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        displayName: u.display_name,
        provider,
      },
    });
  } catch (err) {
    console.error("GET /api/profile", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const displayName = (body.displayName || "").toString().trim().slice(0, 80);
    if (!displayName)
      return Response.json(
        { error: "Display name is required" },
        { status: 400 },
      );

    // Update display_name; if user.name is empty, set name as well so it shows everywhere.
    await sql`
      UPDATE auth_users
      SET display_name = ${displayName},
          name = COALESCE(NULLIF(name, ''), ${displayName})
      WHERE id = ${session.user.id}
    `;
    const result = await sql`SELECT id, name, email, image, display_name FROM auth_users WHERE id = ${session.user.id}`;
    const u = result[0];
    return Response.json({
      profile: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        displayName: u.display_name,
      },
    });
  } catch (err) {
    console.error("PUT /api/profile", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
