import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  markReceiptEmailError,
  sendReceiptEmailForSale,
} from "@/app/api/utils/receiptEmail";

function parseSaleId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request, { params }) {
  try {
    const context = await requireShopAccess(request, "sale.write");
    await ensureBusinessFeatureSchema();
    const id = parseSaleId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    try {
      const result = await sendReceiptEmailForSale(context, id);
      await writeAuditEvent(context, "receipt.email", "sale", id, {
        messageId: result.messageId,
      });
      return Response.json({
        ok: true,
        messageId: result.messageId,
      });
    } catch (error) {
      await markReceiptEmailError(context, id, error);
      return Response.json(
        { error: error.message || "Could not email receipt" },
        { status: 400 },
      );
    }
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/sales/[id]/email", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
