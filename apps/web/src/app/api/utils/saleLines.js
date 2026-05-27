import {
  availableSaleUnits,
  getStockBaseQuantity,
  getUnitModel,
  priceForUnit,
  toBaseQuantity,
} from "@/utils/productUnits";
import { calculateLineGst } from "./gst";

function currency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function customerNameError() {
  return null;
}

function lineAmounts({
  quantity,
  price,
  discount,
  taxRate,
  totalCost,
  taxMode,
  shopStateCode,
  customerStateCode,
  exempted,
}) {
  const gst = calculateLineGst({
    quantity,
    unitPrice: price,
    discount,
    gstRate: taxRate,
    taxMode,
    shopStateCode,
    customerStateCode,
    exempted,
  });
  return {
    subtotal: gst.taxableValue,
    taxableValue: gst.taxableValue,
    discountAmount: gst.discountAmount,
    taxRate: gst.taxRate,
    gstRateAtSale: gst.taxRate,
    taxModeAtSale: gst.taxMode,
    taxAmount: gst.taxAmount,
    gstAmount: gst.gstAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    totalAmount: gst.totalAmount,
    totalCost: currency(totalCost),
    totalProfit: currency(gst.taxableValue - totalCost),
  };
}

export function buildProductSaleLine(product, input) {
  const quantity = number(input.quantity);
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const model = getUnitModel(product);
  const selectedUnit = String(input.selectedUnit || model.primaryUnit).toLowerCase();
  if (!availableSaleUnits(product).includes(selectedUnit)) {
    throw new Error("Invalid product unit");
  }
  const quantityBaseUnit = toBaseQuantity(quantity, selectedUnit, product);
  if (quantityBaseUnit <= 0 || quantityBaseUnit > getStockBaseQuantity(product)) {
    throw new Error(`Not enough stock for ${product.title}`);
  }

  const quotedPrice = Number(input.unitPriceOverride);
  const pricePerUnitAtSale =
    Number.isFinite(quotedPrice) && quotedPrice >= 0
      ? currency(quotedPrice)
      : priceForUnit(product.selling_price, selectedUnit, product);
  const costPerBaseUnitAtSale = model.conversionRate
    ? currency(number(product.cost_price) / model.conversionRate)
    : currency(product.cost_price);
  const totalCost = currency(costPerBaseUnitAtSale * quantityBaseUnit);
  const amounts = lineAmounts({
    quantity,
    price: pricePerUnitAtSale,
    discount: input.discount,
    taxRate: input.taxRate,
    totalCost,
    taxMode: input.taxMode,
    shopStateCode: input.shopStateCode,
    customerStateCode: input.customerStateCode,
    exempted: input.gstExempt ?? product.gst_exempt,
  });

  return {
    productId: product.product_id,
    productNameSnapshot: product.title,
    title: product.title,
    imageSnapshot: product.image_url || null,
    imageUrl: product.image_url || null,
    hsnSacSnapshot: product.hsn_sac || null,
    sku: product.sku || null,
    category: product.category || null,
    selectedUnit,
    primaryUnitSnapshot: model.primaryUnit,
    secondaryUnitSnapshot: model.secondaryUnit,
    conversionRateSnapshot: model.conversionRate,
    quantity,
    quantityBaseUnit,
    pricePerUnitAtSale,
    unitPrice: pricePerUnitAtSale,
    costPerBaseUnitAtSale,
    costPrice: costPerBaseUnitAtSale,
    ...amounts,
  };
}

export function buildManualSaleLine(input) {
  const name = String(input.name || "").trim().slice(0, 150);
  const quantity = number(input.quantity);
  const price = Math.max(0, number(input.price));
  if (!name || quantity <= 0) {
    throw new Error("Manual item name and quantity are required");
  }

  return {
    productId: null,
    productNameSnapshot: name,
    title: name,
    imageSnapshot: null,
    imageUrl: null,
    hsnSacSnapshot: String(input.hsnSac || "").trim().slice(0, 20) || null,
    selectedUnit: String(input.unit || "service").trim().slice(0, 30) || "service",
    primaryUnitSnapshot: null,
    secondaryUnitSnapshot: null,
    conversionRateSnapshot: null,
    quantity,
    quantityBaseUnit: 0,
    pricePerUnitAtSale: currency(price),
    unitPrice: currency(price),
    costPerBaseUnitAtSale: 0,
    costPrice: 0,
    ...lineAmounts({
      quantity,
      price,
      discount: input.discount,
      taxRate: input.taxRate,
      totalCost: 0,
      taxMode: input.taxMode,
      shopStateCode: input.shopStateCode,
      customerStateCode: input.customerStateCode,
    }),
  };
}
