import { describe, expect, test } from "vitest";
import { selectAccessibleShop } from "./shopSelection";

const shops = [
  { shop_id: "shop-one", access_role: "manager" },
  { shop_id: "shop-two", access_role: "owner" },
];

describe("shop selection", () => {
  test("defaults to the owner shop when no selection is supplied", () => {
    expect(selectAccessibleShop(shops, null)).toEqual(shops[1]);
    expect(selectAccessibleShop(shops, "")).toEqual(shops[1]);
  });

  test("honors an accessible selected shop", () => {
    expect(selectAccessibleShop(shops, "shop-two")).toEqual(shops[1]);
  });

  test("rejects a selected shop outside the access list", () => {
    expect(selectAccessibleShop(shops, "shop-missing")).toBeNull();
  });

  test("returns no default if the user has no accessible shop", () => {
    expect(selectAccessibleShop([], null)).toBeNull();
  });
});
