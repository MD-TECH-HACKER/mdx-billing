import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Download, Eye, FileText, Plus, Printer } from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { Button, Card, Modal, Skeleton } from "@/components/ui";
import { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";
import { buildInvoicePdfBlob } from "@/utils/invoicePdf";
import { inrAmountInWords } from "@/utils/amountInWords";

export default function EstimatePage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const navigate = useNavigate();
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const query = useQuery({
    queryKey: ["estimates", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/estimates", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Failed to load estimates");
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const estimates = query.data?.estimates || [];
  const currency = shop?.currency || "INR";
  const convertEstimate = (estimate, targetType) => {
    navigate(`/billing?type=${targetType}`, {
      state: { fromEstimate: estimate, targetType },
    });
  };
  const estimatePdfData = selectedEstimate
    ? {
        ...selectedEstimate,
        receipt_number: selectedEstimate.estimate_number,
        invoice_type: "estimate",
        buyer_name: selectedEstimate.customer_name,
        buyer_phone: selectedEstimate.customer_phone,
        total_amount: selectedEstimate.total_amount,
        tax_amount: selectedEstimate.tax_amount,
        discount_amount: selectedEstimate.discount_amount,
        paid_amount: 0,
        shop_name: shop?.business_legal_name || shop?.shop_name,
        address: shop?.business_address || shop?.address,
        phone: shop?.phone,
        gstin: shop?.gstin,
        default_terms: selectedEstimate.terms || shop?.default_terms,
      }
    : null;
  const downloadSelected = () => {
    if (!estimatePdfData || typeof window === "undefined") return;
    const url = URL.createObjectURL(buildInvoicePdfBlob(estimatePdfData, {
      amountInWords: inrAmountInWords(Number(estimatePdfData.total_amount) || 0),
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(estimatePdfData.receipt_number).replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Estimate PDF downloaded");
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Estimate</h1>
          <p className="t-muted text-sm">
            Create quotation bills without reducing stock. Convert from Billing when ready.
          </p>
        </div>
        <Link to="/billing?type=estimate">
          <Button>
            <Plus className="w-4 h-4" /> New Estimate
          </Button>
        </Link>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : query.isError ? (
        <Card className="text-center py-10">
          <FileText className="w-11 h-11 mx-auto mb-3 t-dim2" />
          <h2 className="t-text font-semibold">Could not load estimates</h2>
          <Button variant="secondary" className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      ) : estimates.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="w-12 h-12 t-dim2 mx-auto mb-3" />
          <h2 className="t-text font-semibold">No estimates yet</h2>
          <p className="t-muted text-sm mt-1 mb-4">
            Use the Estimate / Quotation billing type to prepare quotes without stock out.
          </p>
          <Link to="/billing?type=estimate">
            <Button>
              <Plus className="w-4 h-4" /> Create Estimate
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {estimates.map((estimate) => (
            <Card key={estimate.estimate_id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="t-text font-semibold truncate">{estimate.estimate_number}</div>
                  <div className="t-muted text-xs truncate">
                    {estimate.customer_name || "Walk-in customer"}
                  </div>
                </div>
                <span className="t-accent-soft rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {estimate.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Amount" value={formatMoney(estimate.total_amount, currency)} />
                <Stat label="Valid until" value={estimate.valid_until ? new Date(estimate.valid_until).toLocaleDateString("en-IN") : "Not set"} />
              </div>
              <div className="t-dim text-xs">
                Created {new Date(estimate.created_at).toLocaleString("en-IN")}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setSelectedEstimate(estimate)}>
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
                {estimate.status === "draft" ? (
                  <Button size="sm" onClick={() => convertEstimate(estimate, "invoice")}>
                    <ArrowRight className="w-3.5 h-3.5" /> Invoice
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={!!selectedEstimate}
        onClose={() => setSelectedEstimate(null)}
        title={selectedEstimate?.estimate_number || "Estimate"}
        maxWidth="max-w-3xl"
      >
        {selectedEstimate ? (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between gap-3 rounded-2xl t-elev border t-border p-4">
              <div>
                <div className="t-text font-semibold">{shop?.business_legal_name || shop?.shop_name}</div>
                <div className="t-muted text-xs">{selectedEstimate.customer_name || "Walk-in customer"}</div>
              </div>
              <div className="text-right">
                <div className="t-accent-soft rounded-full px-3 py-1 text-xs font-semibold">{selectedEstimate.status}</div>
                <div className="t-muted text-xs mt-2">{new Date(selectedEstimate.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border t-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="t-elev t-muted text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Rate</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedEstimate.items || []).map((item, index) => (
                    <tr key={`${item.productId || "manual"}-${index}`} className="t-divider">
                      <td className="t-text px-3 py-2">{item.productNameSnapshot || item.title}</td>
                      <td className="t-text px-3 py-2 text-right">{item.quantity} {item.selectedUnit}</td>
                      <td className="t-text px-3 py-2 text-right">{formatMoney(item.pricePerUnitAtSale || item.unitPrice, currency)}</td>
                      <td className="t-text px-3 py-2 text-right font-semibold">{formatMoney(item.totalAmount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto max-w-sm space-y-2 text-sm">
              <Total label="Taxable amount" value={formatMoney(selectedEstimate.taxable_amount, currency)} />
              <Total label="Tax / GST" value={formatMoney(selectedEstimate.tax_amount, currency)} />
              <Total label="Estimate total" value={formatMoney(selectedEstimate.total_amount, currency)} strong />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={downloadSelected}>
                <Download className="w-4 h-4" /> Download PDF
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="w-4 h-4" /> Print
              </Button>
              {selectedEstimate.status === "draft" ? (
                <>
                  <Button onClick={() => convertEstimate(selectedEstimate, "invoice")}>Convert to Invoice</Button>
                  <Button onClick={() => convertEstimate(selectedEstimate, "gst_invoice")}>Convert to GST Invoice</Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl t-elev px-3 py-2">
      <div className="t-dim text-[10px]">{label}</div>
      <div className="t-text font-semibold truncate">{value}</div>
    </div>
  );
}

function Total({ label, value, strong = false }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "t-divider pt-2 t-text font-bold" : "t-muted"}`}>
      <span>{label}</span>
      <span className="t-text">{value}</span>
    </div>
  );
}
