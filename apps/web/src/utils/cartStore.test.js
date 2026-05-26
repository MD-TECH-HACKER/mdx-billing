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

  test("clearCart removes unit snapshots with all cart data", () => {
    addToCart({ product_id: 1, title: "Bottle", selling_price: 10, cost_price: 5, stock: 1, primary_unit: "bottle" }, 1);
    clearCart();

    expect(getCart()).toEqual([]);
  });
});
