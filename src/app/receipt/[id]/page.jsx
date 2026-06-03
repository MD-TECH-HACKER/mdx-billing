import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import {
  Printer,
  Download,
  Loader2,
  Package,
  Check,
  AlertTriangle,
} from "lucide-react";
import ToastHost, { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import { inrAmountInWords } from "@/utils/amountInWords";
import { buildInvoicePdfBlob } from "@/utils/invoicePdf";
import { getProductUnitLabel } from "@/utils/productUnits";

export default function PublicReceiptPage(props) {
  const { id: paramId } = useParams();
  const id = props?.params?.id || paramId;

  const [printMode, setPrintMode] = useState("color"); // "color" | "bw"
  const [paperSize, setPaperSize] = useState("a4"); // "a4" | "thermal"

  const query = useQuery({
    queryKey: ["public-sale", id],
    queryFn: async () => {
      const token =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("token") || ""
          : "";
      const res = await fetch(`/api/public/receipt/${id}?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
    staleTime: 60000,
  });

  const sale = query.data?.sale;
  const fmt = (n) => formatMoney(n, sale?.currency || "INR");

  useEffect(() => {
    if (!sale) return;
    setPrintMode(sale.print_mode === "bw" ? "bw" : "color");
    setPaperSize(["thermal", "small"].includes(sale.receipt_size) ? "thermal" : "a4");
  }, [sale]);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const pdfName = `${String(sale?.receipt_number || "invoice").replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;

  const createPdf = () => buildInvoicePdfBlob(sale, {
    thermal: paperSize === "thermal",
    amountInWords: inrAmountInWords(Number(sale?.total_amount) || 0),
  });

  const handleDownload = () => {
    if (!sale || typeof window === "undefined") return;
    try {
      const url = URL.createObjectURL(createPdf());
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfName;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Invoice PDF downloaded");
    } catch (e) {
      console.error(e);
      showToast("Could not generate PDF", "error");
    }
  };

  if (query.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 relative">
        <div className="prism-bg" />
        <Loader2 className="w-10 h-10 t-accent-text animate-spin" />
        <span className="t-muted text-sm font-medium tracking-wide relative z-10">Retrieving receipt...</span>
      </div>
    );
  }

  if (query.isError || !sale) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <div className="prism-bg" />
        <div className="t-card p-8 max-w-md w-full text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl t-danger-bg flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 t-danger" />
          </div>
          <h2 className="t-text font-poppins font-bold text-xl mb-2">Receipt Not Found</h2>
          <p className="t-muted text-sm leading-relaxed mb-6">
            The link you followed is invalid, has expired, or is for a receipt that does not exist.
          </p>
          <Link
            to="/"
            className="inline-block t-btn-primary rounded-2xl px-6 py-3 font-semibold text-sm transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const items = Array.isArray(sale.items) ? sale.items : [];
  const discountAmount = Number(sale.discount_amount) || 0;
  const taxAmount = Number(sale.tax_amount) || 0;
  const grandTotal = Number(sale.total_amount) || 0;
  const paidAmount = Number(sale.paid_amount) || 0;
  const originalSubtotal = grandTotal - taxAmount + discountAmount;
  const balanceDue = Math.max(0, grandTotal - paidAmount);
  const bw = printMode === "bw";
  const thermal = paperSize === "thermal";

  const paperBg = "#ffffff";
  const textPrimary = bw ? "#000000" : "#111827";
  const textMuted = bw ? "#333333" : "#6b7280";
  const borderColor = bw ? "#000000" : "#e5e7eb";

  return (
    <div className="min-h-screen font-inter receipt-wrap py-6 px-3 relative">
      <div className="prism-bg" />
      <ToastHost />

      <div className={`mx-auto ${thermal ? "max-w-sm" : "max-w-2xl"}`}>
        
        {/* Customer Focused Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print t-card p-4 rounded-3xl relative z-10">
          <div className="flex items-center gap-3">
            {sale.shop_logo ? (
              <img
                src={sale.shop_logo}
                alt={sale.shop_name}
                className="w-10 h-10 rounded-xl object-cover border t-border shadow-inner"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl t-btn-primary flex items-center justify-center font-bold text-white text-base shadow-lg">
                {sale.shop_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-poppins font-bold text-sm t-text">{sale.shop_name}</div>
              <div className="text-[10px] t-dim">Receipt #{sale.receipt_number}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="t-btn px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={handleDownload}
              className="t-btn-primary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          </div>
        </div>

        {/* Receipt card */}
        <div
          id="receipt"
          className="receipt-paper"
          style={{
            background: paperBg,
            color: textPrimary,
            border: `1px solid ${borderColor}`,
            borderRadius: thermal ? 12 : 24,
            padding: thermal ? 16 : 32,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            fontSize: thermal ? 12 : 14,
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 pb-4"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-3">
              {sale.shop_logo ? (
                <img
                  src={sale.shop_logo}
                  alt={sale.shop_name}
                  className={`${thermal ? "w-10 h-10" : "w-16 h-16"} rounded-xl object-cover`}
                />
              ) : (
                <div
                  className={`${thermal ? "w-10 h-10 text-base" : "w-16 h-16 text-xl"} rounded-xl flex items-center justify-center font-bold`}
                  style={{
                    background: "linear-gradient(135deg, #f97316, #fb923c)",
                    color: "#fff",
                  }}
                >
                  {sale.shop_name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1
                  style={{ color: textPrimary }}
                  className={`font-bold font-poppins ${thermal ? "text-base" : "text-xl"}`}
                >
                  {sale.shop_name}
                </h1>
                {sale.shop_description ? (
                  <p style={{ color: textMuted }} className="text-xs mt-0.5">
                    {sale.shop_description}
                  </p>
                ) : null}
                {sale.address ? (
                  <p style={{ color: textMuted }} className="text-xs mt-0.5">
                    {sale.address}
                  </p>
                ) : null}
                {sale.phone ? (
                  <p style={{ color: textMuted }} className="text-xs mt-0.5">
                    📞 {sale.phone}
                  </p>
                ) : null}
              </div>
            </div>
            {!thermal ? (
              <div className="text-right">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: bw ? "transparent" : "#d1fae5",
                    color: bw ? "#000" : "#065f46",
                    border: bw ? "1px solid #000" : "none",
                  }}
                >
                  <Check className="w-3 h-3" /> {sale.payment_status}
                </span>
                <div className="text-xs mt-2" style={{ color: textMuted }}>
                  Receipt #
                </div>
                <div
                  className="font-bold text-sm"
                  style={{ color: textPrimary }}
                >
                  {sale.receipt_number}
                </div>
              </div>
            ) : null}
          </div>

          {/* Thermal small header */}
          {thermal ? (
            <div
              className="text-center py-2 text-xs"
              style={{ color: textMuted }}
            >
              <div>Receipt #{sale.receipt_number}</div>
              <div>{new Date(sale.created_at).toLocaleString("en-IN")}</div>
              <div className="uppercase font-semibold mt-1">
                {sale.payment_status} ·{" "}
                {(sale.payment_method || "cash").replace("_", " ")}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 py-4 text-sm">
              <div>
                <div className="text-xs" style={{ color: textMuted }}>
                  Billed to
                </div>
                <div className="font-semibold" style={{ color: textPrimary }}>
                  {sale.buyer_name || "Walk-in customer"}
                </div>
                {sale.buyer_phone ? (
                  <div className="text-xs mt-0.5" style={{ color: textMuted }}>
                    {sale.buyer_phone}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: textMuted }}>
                  Date
                </div>
                <div className="font-semibold" style={{ color: textPrimary }}>
                  {new Date(sale.created_at).toLocaleString("en-IN")}
                </div>
                <div className="text-xs mt-0.5" style={{ color: textMuted }}>
                  Payment:{" "}
                  <span className="capitalize">
                    {(sale.payment_method || "cash").replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div
            className="pt-3"
            style={{ borderTop: `1px dashed ${borderColor}` }}
          >
            {!thermal ? (
              <div
                className="grid grid-cols-12 text-[10px] uppercase tracking-wider mb-3 px-1"
                style={{ color: textMuted }}
              >
                <div className="col-span-5 md:col-span-6">Item / Snapshot</div>
                <div className="col-span-1 md:col-span-2 text-center">Qty / Unit</div>
                <div className="col-span-3 md:col-span-2 text-right">Price / Unit</div>
                <div className="col-span-3 md:col-span-2 text-right">Amount</div>
              </div>
            ) : null}
            <div className="space-y-2">
              {items.map((it, idx) => {
                const unitLabel = it.selectedUnit || getProductUnitLabel(it);
                const itemName = it.productNameSnapshot || it.title;
                const pricePerUnit = it.pricePerUnitAtSale ?? it.unitPrice;
                const lineAmount = it.totalAmount ?? it.subtotal;
                const productImg = it.imageSnapshot || it.imageUrl;

                return (
                  <div
                    key={idx}
                    className={
                      thermal
                        ? "flex justify-between gap-2 text-xs py-1"
                        : "grid grid-cols-12 gap-2 items-center px-1"
                    }
                  >
                  {thermal ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate font-semibold"
                          style={{ color: textPrimary }}
                        >
                          {itemName}
                        </div>
                        <div style={{ color: textMuted }}>
                          {it.quantity} {unitLabel} x {fmt(pricePerUnit)}
                        </div>
                      </div>
                      <div
                        className="font-bold"
                        style={{ color: textPrimary }}
                      >
                        {fmt(lineAmount)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-5 md:col-span-6 flex items-center gap-3 min-w-0">
                        {productImg ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-gray-50 border border-gray-100 shadow-sm">
                            <img
                              src={productImg}
                              alt={itemName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-100"
                            style={{
                              background: "#f3f4f6",
                            }}
                          >
                            <Package
                              className="w-5 h-5"
                              style={{ color: textMuted }}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{ color: textPrimary }}
                          >
                            {itemName}
                          </div>
                          {it.hsnSacSnapshot ? (
                            <div className="text-[10px] mt-0.5 truncate" style={{ color: textMuted }}>
                              HSN/SAC: {it.hsnSacSnapshot}
                            </div>
                          ) : it.description ? (
                            <div
                              className="text-[10px] mt-0.5 truncate"
                              style={{ color: textMuted }}
                            >
                              {it.description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="col-span-1 md:col-span-2 text-sm text-center font-medium"
                        style={{ color: textPrimary }}
                      >
                        ×{it.quantity} <span className="hidden md:inline text-xs text-gray-500 font-normal ml-0.5">{unitLabel}</span>
                      </div>
                      <div
                        className="col-span-3 md:col-span-2 text-sm text-right truncate font-medium"
                        style={{ color: textPrimary }}
                      >
                        {fmt(pricePerUnit)}
                      </div>
                      <div
                        className="col-span-3 md:col-span-2 font-bold text-sm text-right truncate"
                        style={{ color: textPrimary }}
                      >
                        {fmt(lineAmount)}
                      </div>
                    </>
                  )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div
            className="mt-4 pt-3 space-y-1.5 text-sm"
            style={{ borderTop: `1px dashed ${borderColor}` }}
          >
            {taxAmount > 0 || discountAmount > 0 ? (
              <>
                <div
                  className="flex justify-between"
                  style={{ color: textMuted }}
                >
                  <span>Subtotal</span>
                  <span className="font-medium">
                    {fmt(originalSubtotal)}
                  </span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between" style={{ color: textMuted }}>
                    <span>Discount</span>
                    <span className="font-medium">- {fmt(discountAmount)}</span>
                  </div>
                ) : null}
                {taxAmount > 0 ? (
                  <div className="flex justify-between" style={{ color: textMuted }}>
                    <span>Tax</span>
                    <span className="font-medium">{fmt(taxAmount)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
            <div
              className="flex justify-between font-bold pt-2 mt-1"
              style={{
                color: textPrimary,
                fontSize: thermal ? 14 : 18,
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <span>Grand Total</span>
              <span>{fmt(sale.total_amount)}</span>
            </div>
            {!thermal ? (
              <div className="text-xs pt-2" style={{ color: textMuted }}>
                Amount in words: <span className="font-semibold" style={{ color: textPrimary }}>{inrAmountInWords(grandTotal)}</span>
              </div>
            ) : null}
            {sale.payment_status !== "paid" ? (
              <>
                <div className="flex justify-between pt-1" style={{ color: textMuted }}>
                  <span>Paid</span>
                  <span className="font-medium">{fmt(paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold" style={{ color: textPrimary }}>
                  <span>Balance due</span>
                  <span>{fmt(balanceDue)}</span>
                </div>
                {sale.due_date ? (
                  <div className="text-right text-xs" style={{ color: textMuted }}>
                    Due by {new Date(sale.due_date).toLocaleDateString("en-IN")}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          {sale.notes ? (
            <div
              className="mt-4 pt-3 text-xs"
              style={{
                color: textMuted,
                borderTop: `1px dashed ${borderColor}`,
              }}
            >
              <div
                className="font-bold mb-0.5"
                style={{ color: textPrimary }}
              >
                Notes
              </div>
              {sale.notes}
            </div>
          ) : null}
          {!thermal ? (
            <div className="mt-6 grid grid-cols-2 gap-6 text-xs" style={{ color: textMuted }}>
              <div>
                <div className="font-bold mb-1" style={{ color: textPrimary }}>Terms & Conditions</div>
                {sale.default_terms || "Goods once sold are subject to the shop return policy."}
              </div>
              <div className="text-right pt-8">
                <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 6 }}>Authorized Signatory</div>
              </div>
            </div>
          ) : null}

          <div
            className="text-center text-xs mt-6 pt-3 font-medium"
            style={{
              color: textMuted,
              borderTop: `1px dashed ${borderColor}`,
            }}
          >
            {sale.thank_you_message || "Thank you for your purchase!"}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          html,
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-wrap {
            background: white !important;
            padding: 0 !important;
          }
          .receipt-paper {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  );
}
