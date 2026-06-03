import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import {
  Printer,
  Download,
  Share2,
  ArrowLeft,
  Loader2,
  Package,
  Check,
  Mail,
  Copy,
  ExternalLink,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import ToastHost, { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import { inrAmountInWords } from "@/utils/amountInWords";
import { buildInvoicePdfBlob } from "@/utils/invoicePdf";
import { ConfirmDialog, Tabs } from "@/components/ui";
import { getProductUnitLabel } from "@/utils/productUnits";
import { shopHeaders } from "@/utils/shopContext";

export default function ReceiptPage(props) {
  const id = props?.params?.id;
  const publicMode = !!props?.publicMode;
  const { data: user, loading: userLoading } = useUser();
  const { shop } = useShop({ enabled: !!user && !publicMode });
  const navigate = useNavigate();
  const [printMode, setPrintMode] = useState("color"); // "color" | "bw"
  const [paperSize, setPaperSize] = useState("a4"); // "a4" | "thermal"
  const [confirmEmailResend, setConfirmEmailResend] = useState(false);

  useEffect(() => {
    if (publicMode) return;
    if (!userLoading && !user && typeof window !== "undefined")
      navigate("/", { replace: true });
  }, [publicMode, user, userLoading, navigate]);

  // Auto-print when ?print=1 in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, []);

  const query = useQuery({
    queryKey: ["sale", publicMode ? "public" : shop?.shop_id, id],
    queryFn: async () => {
      const token =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("token") || ""
          : "";
      const res = publicMode
        ? await fetch(`/api/public/receipt/${id}?token=${encodeURIComponent(token)}`)
        : await fetch(`/api/sales/${id}`, { headers: shopHeaders() });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: publicMode ? !!id : !!user && !!shop?.shop_id && !!id,
    staleTime: 60000,
  });

  const sale = query.data?.sale;
  const fmt = (n) => formatMoney(n, sale?.currency || "INR");

  const emailReceipt = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sales/${id}/email`, {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not email receipt");
      return data;
    },
    onSuccess: () => {
      showToast("Receipt emailed to customer.");
      query.refetch();
    },
    onError: (error) => showToast(error.message, "error"),
  });

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
    const url = URL.createObjectURL(createPdf());
    const link = document.createElement("a");
    link.href = url;
    link.download = pdfName;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Invoice PDF downloaded");
  };
  const handleShare = async () => {
    if (!sale || typeof window === "undefined") return;
    const file = new File([createPdf()], pdfName, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `Invoice ${sale.receipt_number}`,
          files: [file],
        });
      } catch {}
    } else {
      handleDownload();
      showToast("PDF download ready; native file sharing is not available on this device.", "info");
    }
  };

  useEffect(() => {
    if (!publicMode || !sale || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("download") === "1") {
      const t = setTimeout(() => handleDownload(), 400);
      return () => clearTimeout(t);
    }
  }, [publicMode, sale]);

  const copyPublicLink = async (url, message) => {
    if (!url || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(url);
      showToast(message);
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  if (query.isLoading || (!publicMode && userLoading)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-page)" }}
      >
        <Loader2 className="w-8 h-8 t-text animate-spin" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="text-center">
          <p className="t-text mb-3">Receipt not found.</p>
          <Link to={publicMode ? "/" : "/sales"} className="t-accent-text">
            {publicMode ? "Go home" : "Back to sales"}
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

  // Receipt color palette adjusts based on print mode
  const paperBg = bw ? "#ffffff" : "#ffffff";
  const textPrimary = bw ? "#000000" : "#111827";
  const textMuted = bw ? "#333333" : "#6b7280";
  const borderColor = bw ? "#000000" : "#e5e7eb";

  return (
    <div
      className="min-h-screen font-inter receipt-wrap"
      style={{
        background: "var(--bg-page)",
        backgroundAttachment: "fixed",
      }}
    >
      <ToastHost />

      <div
        className={`mx-auto px-3 py-6 ${thermal ? "max-w-sm" : "max-w-2xl"}`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 no-print">
          <Link
            to={publicMode ? "/" : "/sales"}
            className="flex items-center gap-2 t-muted hover:t-text text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {publicMode ? "Home" : "Back"}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={printMode}
              onChange={setPrintMode}
              options={[
                { value: "color", label: "Color" },
                { value: "bw", label: "B&W" },
              ]}
            />
            <Tabs
              value={paperSize}
              onChange={setPaperSize}
              options={[
                { value: "a4", label: "A4" },
                { value: "thermal", label: "Thermal" },
              ]}
            />
            <button
              onClick={handlePrint}
              className="t-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={handleDownload}
              className="t-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
              title="Download invoice PDF"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={handleShare}
              className="t-btn-primary px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share PDF
            </button>
            {!publicMode && sale.customer_email ? (
              <button
                onClick={() => {
                  if (sale.receipt_email_sent) {
                    setConfirmEmailResend(true);
                    return;
                  }
                  emailReceipt.mutate();
                }}
                disabled={emailReceipt.isPending}
                className="t-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
                title={`Email receipt to ${sale.customer_email}`}
              >
                {emailReceipt.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                Email Receipt
              </button>
            ) : null}
          </div>
        </div>
        <ConfirmDialog
          open={confirmEmailResend}
          title="Receipt already sent"
          message={`This receipt was already sent to ${sale.customer_email}. Do you want to send it again?`}
          confirmText="Send Again"
          cancelText="Cancel"
          onClose={() => setConfirmEmailResend(false)}
          onConfirm={() => {
            setConfirmEmailResend(false);
            emailReceipt.mutate();
          }}
        />
        {!publicMode && sale.publicReceiptUrl ? (
          <div className="no-print mb-4 rounded-2xl t-card px-4 py-3 text-xs t-muted flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="t-text font-semibold text-sm">Public receipt link</div>
              <div className="t-dim mt-0.5">Customer can view or download this receipt without logging in.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={sale.publicReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="t-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View link
              </a>
              <button
                type="button"
                onClick={() => copyPublicLink(sale.publicReceiptUrl, "Receipt view link copied")}
                className="t-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy view
              </button>
              <button
                type="button"
                onClick={() => copyPublicLink(sale.publicReceiptDownloadUrl, "Receipt download link copied")}
                className="t-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Copy download
              </button>
            </div>
          </div>
        ) : null}
        {!publicMode && sale.customer_email ? (
          <div className="no-print mb-4 rounded-2xl t-card px-4 py-3 text-xs t-muted flex flex-wrap items-center justify-between gap-2">
            <span>
              Customer email: <strong className="t-text">{sale.customer_email}</strong>
            </span>
            {sale.receipt_email_sent ? (
              <span className="t-success-bg px-2 py-1 rounded-full font-semibold">
                Email sent on {new Date(sale.receipt_email_sent_at).toLocaleString("en-IN")}
              </span>
            ) : sale.receipt_email_error ? (
              <span className="t-danger-bg px-2 py-1 rounded-full font-semibold">
                Last email failed
              </span>
            ) : (
              <span className="t-elev px-2 py-1 rounded-full font-semibold">
                Not emailed yet
              </span>
            )}
          </div>
        ) : null}

        {/* Receipt card */}
        <div
          id="receipt"
          className="receipt-paper"
          style={{
            background: paperBg,
            color: textPrimary,
            border: `1px solid ${borderColor}`,
            borderRadius: thermal ? 8 : 16,
            padding: thermal ? 14 : 28,
            boxShadow: bw ? "none" : "0 20px 60px -15px rgba(0,0,0,0.4)",
            fontSize: thermal ? 12 : 14,
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 pb-3"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-3">
              {sale.shop_logo ? (
                <img
                  src={sale.shop_logo}
                  alt={sale.shop_name}
                  className={`${thermal ? "w-10 h-10" : "w-14 h-14"} rounded-xl object-cover`}
                />
              ) : (
                <div
                  className={`${thermal ? "w-10 h-10 text-base" : "w-14 h-14 text-lg"} rounded-xl flex items-center justify-center font-bold`}
                  style={{
                    background: bw
                      ? "#000"
                      : "linear-gradient(135deg, #8b5cf6, #d946ef)",
                    color: "#fff",
                  }}
                >
                  {sale.shop_name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1
                  style={{ color: textPrimary }}
                  className={`font-bold font-poppins ${thermal ? "text-base" : "text-lg"}`}
                >
                  {sale.shop_name}
                </h1>
                {sale.shop_description ? (
                  <p style={{ color: textMuted }} className="text-xs">
                    {sale.shop_description}
                  </p>
                ) : null}
                {sale.address ? (
                  <p style={{ color: textMuted }} className="text-xs">
                    {sale.address}
                  </p>
                ) : null}
                {sale.phone ? (
                  <p style={{ color: textMuted }} className="text-xs">
                    📞 {sale.phone}
                  </p>
                ) : null}
              </div>
            </div>
            {!thermal ? (
              <div className="text-right">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
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
            <div className="grid grid-cols-2 gap-3 py-3 text-sm">
              <div>
                <div className="text-xs" style={{ color: textMuted }}>
                  Billed to
                </div>
                <div className="font-medium" style={{ color: textPrimary }}>
                  {sale.buyer_name || "Walk-in customer"}
                </div>
                {sale.buyer_phone ? (
                  <div className="text-xs" style={{ color: textMuted }}>
                    {sale.buyer_phone}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: textMuted }}>
                  Date
                </div>
                <div className="font-medium" style={{ color: textPrimary }}>
                  {new Date(sale.created_at).toLocaleString("en-IN")}
                </div>
                <div className="text-xs" style={{ color: textMuted }}>
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
            className="pt-2"
            style={{ borderTop: `1px dashed ${borderColor}` }}
          >
            {!thermal ? (
              <div
                className="grid grid-cols-12 text-[10px] uppercase tracking-wide mb-2 px-1"
                style={{ color: textMuted }}
              >
                <div className="col-span-5 md:col-span-6">Item / HSN/SAC</div>
                <div className="col-span-1 md:col-span-2 text-center">Qty / Unit</div>
                <div className="col-span-3 md:col-span-2 text-right">Price / Unit</div>
                <div className="col-span-3 md:col-span-2 text-right">Amount</div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              {items.map((it, idx) => {
                const unitLabel = it.selectedUnit || getProductUnitLabel(it);
                const itemName = it.productNameSnapshot || it.title;
                const pricePerUnit = it.pricePerUnitAtSale ?? it.unitPrice;
                const lineAmount = it.totalAmount ?? it.subtotal;
                return (
                  <div
                    key={idx}
                    className={
                      thermal
                        ? "flex justify-between gap-2 text-xs"
                        : "grid grid-cols-12 gap-2 items-center px-1"
                    }
                  >
                  {thermal ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate font-medium"
                          style={{ color: textPrimary }}
                        >
                          {itemName}
                        </div>
                        <div style={{ color: textMuted }}>
                          {it.quantity} {unitLabel} x {fmt(pricePerUnit)}
                        </div>
                      </div>
                      <div
                        className="font-semibold"
                        style={{ color: textPrimary }}
                      >
                        {fmt(lineAmount)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-5 md:col-span-6 flex items-center gap-2 min-w-0">
                        {it.imageUrl && !bw ? (
                          <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-gray-100">
                            <img
                              src={it.imageUrl}
                              alt={itemName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: bw ? "#f3f4f6" : "#f3f4f6",
                            }}
                          >
                            <Package
                              className="w-4 h-4"
                              style={{ color: textMuted }}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div
                            className="text-sm font-medium truncate"
                            style={{ color: textPrimary }}
                          >
                            {itemName}
                          </div>
                          {it.hsnSacSnapshot ? (
                            <div className="text-xs truncate" style={{ color: textMuted }}>
                              HSN/SAC: {it.hsnSacSnapshot}
                            </div>
                          ) : it.description ? (
                            <div
                              className="text-xs truncate"
                              style={{ color: textMuted }}
                            >
                              {it.description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="col-span-1 md:col-span-2 text-sm text-center"
                        style={{ color: textPrimary }}
                      >
                        ×{it.quantity} <span className="hidden md:inline">{unitLabel}</span>
                      </div>
                      <div
                        className="col-span-3 md:col-span-2 text-sm text-right truncate"
                        style={{ color: textPrimary }}
                      >
                        {fmt(pricePerUnit)}
                      </div>
                      <div
                        className="col-span-3 md:col-span-2 font-semibold text-sm text-right truncate"
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
            className="mt-4 pt-3 space-y-1 text-sm"
            style={{ borderTop: `1px dashed ${borderColor}` }}
          >
            {taxAmount > 0 || discountAmount > 0 ? (
              <>
                <div
                  className="flex justify-between"
                  style={{ color: textMuted }}
                >
                  <span>Subtotal</span>
                  <span>
                    {fmt(originalSubtotal)}
                  </span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between" style={{ color: textMuted }}>
                    <span>Discount</span>
                    <span>- {fmt(discountAmount)}</span>
                  </div>
                ) : null}
                {taxAmount > 0 ? (
                  <div className="flex justify-between" style={{ color: textMuted }}>
                    <span>Tax</span>
                    <span>{fmt(taxAmount)}</span>
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
                Amount in words: <span style={{ color: textPrimary }}>{inrAmountInWords(grandTotal)}</span>
              </div>
            ) : null}
            {sale.payment_status !== "paid" ? (
              <>
                <div className="flex justify-between pt-1" style={{ color: textMuted }}>
                  <span>Paid</span>
                  <span>{fmt(paidAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold" style={{ color: textPrimary }}>
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
                className="font-semibold mb-0.5"
                style={{ color: textPrimary }}
              >
                Notes
              </div>
              {sale.notes}
            </div>
          ) : null}
          {!thermal ? (
            <div className="mt-5 grid grid-cols-2 gap-6 text-xs" style={{ color: textMuted }}>
              <div>
                <div className="font-semibold mb-1" style={{ color: textPrimary }}>Terms & Conditions</div>
                {sale.default_terms || "Goods once sold are subject to the shop return policy."}
              </div>
              <div className="text-right pt-8">
                <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 6 }}>Authorized Signatory</div>
              </div>
            </div>
          ) : null}

          <div
            className="text-center text-xs mt-5 pt-3"
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
