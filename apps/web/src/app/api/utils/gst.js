function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStateCode(value) {
  return String(value || "").trim().slice(0, 2);
}

export function calculateGstBreakdown({
  amount,
  gstRate,
  taxMode = "exclusive",
  shopStateCode,
  customerStateCode,
  exempted = false,
}) {
  const rate = exempted ? 0 : Math.max(0, Math.min(100, number(gstRate)));
  const gross = money(Math.max(0, number(amount)));
  const mode = taxMode === "inclusive" ? "inclusive" : "exclusive";
  const taxableValue = rate > 0 && mode === "inclusive"
    ? money(gross / (1 + rate / 100))
    : gross;
  const gstAmount = rate > 0
    ? money(mode === "inclusive" ? gross - taxableValue : taxableValue * (rate / 100))
    : 0;
  const totalAmount = mode === "inclusive" ? gross : money(taxableValue + gstAmount);
  const shopState = normalizeStateCode(shopStateCode);
  const customerState = normalizeStateCode(customerStateCode);
  const interstate = !!shopState && !!customerState && shopState !== customerState;

  return {
    taxableValue,
    gstRate: rate,
    gstAmount,
    cgstAmount: interstate ? 0 : money(gstAmount / 2),
    sgstAmount: interstate ? 0 : money(gstAmount / 2),
    igstAmount: interstate ? gstAmount : 0,
    totalAmount,
    taxMode: mode,
    supplyType: interstate ? "inter_state" : "intra_state",
  };
}

export function calculateLineGst({
  quantity,
  unitPrice,
  discount = 0,
  gstRate = 0,
  taxMode = "exclusive",
  shopStateCode,
  customerStateCode,
  exempted = false,
}) {
  const gross = money(Math.max(0, number(quantity)) * Math.max(0, number(unitPrice)));
  const discountAmount = money(Math.min(gross, Math.max(0, number(discount))));
  const lineAmount = money(gross - discountAmount);
  const gst = calculateGstBreakdown({
    amount: lineAmount,
    gstRate,
    taxMode,
    shopStateCode,
    customerStateCode,
    exempted,
  });
  return {
    grossAmount: gross,
    discountAmount,
    subtotal: gst.taxableValue,
    taxableValue: gst.taxableValue,
    taxRate: gst.gstRate,
    taxAmount: gst.gstAmount,
    gstAmount: gst.gstAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    totalAmount: gst.totalAmount,
    taxMode: gst.taxMode,
    supplyType: gst.supplyType,
  };
}
