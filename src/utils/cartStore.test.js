import { beforeEach, describe, expect, test, vi } from "vitest";
import { addToCart, clearCart, getCart } from "./cartStore";

describe("cartStore product units", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("stores product unit snapshots when adding products", () => {
    const result = addToCart({
      product_id: 7,
      title: "Rice",
      description: "Premium rice",
      image_url: null,
      selling_price: 80,
      cost_price: 60,
      stock: 25,
      primary_unit: "kg",
      secondary_unit: "g",
    }, 2);

    expect(result.ok).toBe(true);
    expect(getCart()).toEqual([
      expect.objectContaining({
        product_id: 7,
        quantity: 2,
        primary_unit: "kg",
        secondary_unit: "g",
      }),
    ]);
  });

  test("defaults missing product units to piece", () => {
    addToCart({
      product_id: 8,
      title: "Notebook",
      selling_price: 30,
      cost_price: 20,
      stock: 4,
    }, 1);

    expect(getCart()[0]).toEqual(expect.objectContaining({ primary_unit: "piece", secondary_unit: null }));
  });

  test("normalizes legacy cart rows so billing totals can use them", () => {
    localStorage.setItem(
      "mdx_cart_v3:unselected",
      JSON.stringify([
        {
          id: 22,
          name: "Legacy service",
          price: "455",
          quantity: 3,
          primaryUnit: "piece",
          taxRate: "18",
        },
      ]),
    );

    expect(getCart()).toEqual([
      expect.objectContaining({
        product_id: 22,
        title: "Legacy service",
        selling_price: 455,
        quantity: 3,
        primary_unit: "piece",
        tax_rate: 18,
      }),
    ]);
  });

  test("normalizes older price field names and formatted money strings", () => {
    localStorage.setItem(
      "mdx_cart_v3:unselected",
      JSON.stringify([
        {
          id: 31,
          name: "Formatted price",
          unit_price: "2,323.00",
          quantity: 2,
          selectedUnit: "piece",
        },
        {
          productId: 32,
          title: "Sale snapshot",
          pricePerUnitAtSale: "455.00",
          quantity: 1,
          unit: "box",
        },
      ]),
    );

    expect(getCart()).toEqual([
      expect.objectContaining({
        product_id: 31,
        selling_price: 2323,
        quantity: 2,
        primary_unit: "piece",
      }),
      expect.objectContaining({
        product_id: 32,
        selling_price: 455,
        quantity: 1,
        primary_unit: "box",
      }),
    ]);
  });

  test("clearCart removes unit snapshots with all cart data", () => {
    addToCart({ product_id: 1, title: "Bottle", selling_price: 10, cost_price: 5, stock: 1, primary_unit: "bottle" }, 1);
    clearCart();

    expect(getCart()).toEqual([]);
  });
});
