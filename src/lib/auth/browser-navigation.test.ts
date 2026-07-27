// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { postLoginPath } from "./browser-navigation";

describe("postLoginPath", () => {
  it("po logowaniu przechodzi przez serwerowy wybór ekranu dla roli", () => {
    expect(postLoginPath()).toBe("/");
  });
});
