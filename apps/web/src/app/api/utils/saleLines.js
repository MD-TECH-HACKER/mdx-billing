import {
  availableSaleUnits,
  getStockBaseQuantity,
  getUnitModel,
  priceForUnit,
  toBaseQuantity,
} from "@/utils/productUnits";

function currency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function customerNameError(value) {
  return typeof value === "string" && value.trim() ? null : "Customer name is required.";
}

function lineAmounts({ quantity, price, discount, taxRate, totalCost }) {
  const grossAmount = currency(quantity * price);
  const discountAmount = currency(Math.min(grossAmount, Math.max(0, number(discount))));
  const taxableAmount = currency(grossAmount - discountAmount);
  const taxPercent = Math.max(0, Math.min(100, number(taxRate)));
  const taxAmount = currency(taxableAmount * (taxPercent / 100));
  return {
    subtotal: taxableAmount,
    discountAmount,
    taxRate: taxPercent,
    taxAmount,
    totalAmount: currency(taxableAmount + taxAmount),
    totalCost: currency(totalCost),
    totalProfit: currency(taxableAmount - totalCost),
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

  const pricePerUnitAtSale = priceForUnit(product.selling_price, selectedUnit, product);
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
    }),
  };
}
