import { describe, expect, test } from "vitest";
import { calculateGstBreakdown } from "./gst";

describe("GST invoice calculation", () => {
  test("calculates tax exclusive intra-state CGST and SGST", () => {
    expect(
      calculateGstBreakdown({
        amount: 100,
        gstRate: 18,
        taxMode: "exclusive",
        shopStateCode: "33",
        customerStateCode: "33",
      }),
    ).toMatchObject({
      taxableValue: 100,
      gstAmount: 18,
      cgstAmount: 9,
      sgstAmount: 9,
      igstAmount: 0,
      totalAmount: 118,
      supplyType: "intra_state",
    });
  });

  test("extracts tax inclusive inter-state IGST", () => {
    expect(
      calculateGstBreakdown({
        amount: 118,
        gstRate: 18,
        taxMode: "inclusive",
        shopStateCode: "33",
        customerStateCode: "29",
      }),
    ).toMatchObject({
      taxableValue: 100,
      gstAmount: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 18,
      totalAmount: 118,
      supplyType: "inter_state",
    });
  });
});
