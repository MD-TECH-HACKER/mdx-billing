import { describe, expect, test } from "vitest";
import { getHTMLForErrorPage } from "./get-html-for-error-page";

describe("error page security", () => {
  test("hides exception details when disabled", () => {
    const html = getHTMLForErrorPage(new Error("database password leaked"), {
      showDetails: false,
    });

    expect(html).toContain("An unexpected error occurred. Please try again.");
    expect(html).not.toContain("database password leaked");
    expect(html).not.toContain("Show details");
  });

  test("keeps details available for development diagnostics", () => {
    const html = getHTMLForErrorPage(new Error("development stack detail"), {
      showDetails: true,
    });

    expect(html).toContain("development stack detail");
    expect(html).toContain("Show details");
  });
});
