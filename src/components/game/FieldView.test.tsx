import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldView, fieldToFill } from "~/components/game/FieldView";
import { TEAMS } from "~/lib/test-utils/fixtures";

describe("fieldToFill", () => {
  it("keeps the usual field in a box of its shape", () => {
    expect(fieldToFill(480, 100)).toEqual({ height: 250, width: 480 });
  });

  it("draws the field taller to fill a taller box", () => {
    expect(fieldToFill(450, 200)).toEqual({ height: 533, width: 450 });
  });

  it("stops at half as tall as the field is long", () => {
    expect(fieldToFill(400, 400)).toEqual({ height: 600, width: 400 });
  });

  it("narrows the usual field to fit a short box", () => {
    expect(fieldToFill(800, 100)).toEqual({ height: 250, width: 480 });
  });

  it("keeps the usual field until there is a box", () => {
    expect(fieldToFill(0, 0).height).toBe(250);
  });
});

describe("FieldView", () => {
  it("draws at the height it is given", () => {
    render(
      <FieldView
        home={TEAMS.MIN}
        away={TEAMS.NO}
        field={{
          offense: "home",
          ballOn: 25,
          lineToGain: 35,
          driveSpots: [25],
        }}
        height={400}
      />,
    );
    expect(screen.getByRole("img", { name: /ball on/ })).toHaveAttribute(
      "viewBox",
      "0 0 1200 400",
    );
  });
});
