import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

const PAYMENT_METHODS = new Set(["cash", "card", "upi", "bank_transfer", "other"]);

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "expense.read");
    await ensureBusinessFeatureSchema();
    const expenses = await sql`
      SELECT * FROM expenses
      WHERE shop_id = ${context.shopId}
      ORDER BY expense_date DESC, created_at DESC
      LIMIT 500
    `;
    return Response.json({ expenses });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/expenses", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "expense.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const category = (body.category || "").toString().trim().slice(0, 80);
    const amount = Number(body.amount);
    const expenseDate = (body.expenseDate || "").toString().slice(0, 10) || null;
    const vendor = (body.vendor || "").toString().trim().slice(0, 120) || null;
    const notes = (body.notes || "").toString().trim().slice(0, 500) || null;
    const receiptUrl = (body.receiptUrl || "").toString().trim().slice(0, 1000) || null;
    const paymentMethod = PAYMENT_METHODS.has(body.paymentMethod)
      ? body.paymentMethod
      : "cash";
    if (!category || !Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Category and positive amount are required" }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO expenses (shop_id, expense_date, category, amount, payment_method, vendor, notes, receipt_url, created_by)
      VALUES (${context.shopId}, COALESCE(${expenseDate}::date, CURRENT_DATE), ${category}, ${amount}, ${paymentMethod}, ${vendor}, ${notes}, ${receiptUrl}, ${context.userId})
      RETURNING *
    `;
    await writeAuditEvent(context, "expense.create", "expense", rows[0].expense_id, {
      category,
      amount,
    });
    return Response.json({ expense: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/expenses", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const context = await requireShopAccess(request, "expense.write");
    await ensureBusinessFeatureSchema();
    const id = Number.parseInt(new URL(request.url).searchParams.get("id"), 10);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Expense id is required" }, { status: 400 });
    }
    const rows = await sql`
      DELETE FROM expenses WHERE expense_id = ${id} AND shop_id = ${context.shopId}
      RETURNING expense_id
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "expense.delete", "expense", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/expenses", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
