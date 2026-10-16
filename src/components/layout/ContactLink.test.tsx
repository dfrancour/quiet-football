import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContactLink } from "~/components/layout/ContactLink";

const ADDRESS = "contact@quiet-football.com";

describe("ContactLink", () => {
  it("keeps the address out of the prerendered markup", () => {
    const html = renderToStaticMarkup(<ContactLink />);
    expect(html).not.toContain(ADDRESS);
    expect(html).not.toContain("quiet-football.com");
    expect(html).not.toContain("mailto:");
    expect(html).toContain("Email");
  });

  it("reads the address and opens mail once hydrated", () => {
    render(<ContactLink />);
    expect(screen.getByRole("link", { name: ADDRESS })).toHaveAttribute(
      "href",
      `mailto:${ADDRESS}`,
    );
  });
});
