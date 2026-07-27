// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { postLoginPath } from "./browser-navigation";

describe("postLoginPath", () => {
  it("otwiera kalendarz po logowaniu na telefonie", () => {
    expect(postLoginPath(true)).toBe("/calendar");
  });

  it("zostawia pulpit jako start na komputerze", () => {
    expect(postLoginPath(false)).toBe("/dashboard");
  });
});
