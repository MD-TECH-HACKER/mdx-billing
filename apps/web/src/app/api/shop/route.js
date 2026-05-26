import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows =
      await sql`SELECT * FROM shops WHERE owner_id = ${session.user.id} LIMIT 1`;
    return Response.json({ shop: rows[0] || null });
  } catch (err) {
    console.error("GET /api/shop", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const shopName = (body.shopName || "").toString().trim().slice(0, 100);
    const shopDescription = (body.shopDescription || "")
      .toString()
      .trim()
      .slice(0, 500);
    const shopLogo =
      (body.shopLogo || "").toString().trim() || null;
    const address =
      (body.address || "").toString().trim().slice(0, 300) || null;
    const phone = (body.phone || "").toString().trim().slice(0, 50) || null;

    if (!shopName) {
      return Response.json({ error: "Shop name is required" }, { status: 400 });
    }

    const existing =
      await sql`SELECT shop_id FROM shops WHERE owner_id = ${session.user.id} LIMIT 1`;
    if (existing[0]) {
      const updated = await sql`
        UPDATE shops SET
          shop_name = ${shopName},
          shop_description = ${shopDescription},
          shop_logo = ${shopLogo},
          address = ${address},
          phone = ${phone},
          updated_at = NOW()
        WHERE owner_id = ${session.user.id}
        RETURNING *`;
      return Response.json({ shop: updated[0] });
    }

    const created = await sql`
      INSERT INTO shops (owner_id, shop_name, shop_description, shop_logo, address, phone, currency)
      VALUES (${session.user.id}, ${shopName}, ${shopDescription}, ${shopLogo}, ${address}, ${phone}, 'INR')
      RETURNING *`;
    return Response.json({ shop: created[0] });
  } catch (err) {
    console.error("POST /api/shop", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const fields = {};
    if (typeof body.shopName === "string")
      fields.shop_name = body.shopName.trim().slice(0, 100);
    if (typeof body.shopDescription === "string")
      fields.shop_description = body.shopDescription.trim().slice(0, 500);
    if (typeof body.shopLogo === "string")
      fields.shop_logo = body.shopLogo.trim() || null;
    if (typeof body.address === "string")
      fields.address = body.address.trim().slice(0, 300) || null;
    if (typeof body.phone === "string")
      fields.phone = body.phone.trim().slice(0, 50) || null;
    if (typeof body.receiptPrefix === "string")
      fields.receipt_prefix = body.receiptPrefix.trim().slice(0, 10) || "INV";
    if (typeof body.taxPercent === "number")
      fields.tax_percent = Math.max(0, Math.min(100, body.taxPercent));
    if (typeof body.currency === "string")
      fields.currency = body.currency.trim().slice(0, 10).toUpperCase();
    if (typeof body.thankYouMessage === "string")
      fields.thank_you_message = body.thankYouMessage.trim().slice(0, 300);
    if (typeof body.theme === "string")
      fields.theme = body.theme.trim().slice(0, 20);
    if (typeof body.accentColor === "string")
      fields.accent_color = body.accentColor.trim().slice(0, 20);
    if (typeof body.driveConnected === "boolean")
      fields.drive_connected = body.driveConnected;
    if (typeof body.driveEmail === "string" || body.driveEmail === null)
      fields.drive_email = body.driveEmail
        ? body.driveEmail.trim().slice(0, 200)
        : null;
    if (body.driveLastSynced === null) fields.drive_last_synced = null;
    else if (body.driveLastSynced === "now")
      fields.drive_last_synced = new Date().toISOString();

    const keys = Object.keys(fields);
    if (keys.length === 0)
      return Response.json({ error: "No fields" }, { status: 400 });

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map((k) => fields[k]);
    const query = `UPDATE shops SET ${setClauses.join(", ")}, updated_at = NOW() WHERE owner_id = $${values.length + 1} RETURNING *`;
    const result = await sql(query, [...values, session.user.id]);
    return Response.json({ shop: result[0] });
  } catch (err) {
    console.error("PUT /api/shop", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
