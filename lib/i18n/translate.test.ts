import { describe, expect, it } from "vitest";

import { translate } from "./translate";

describe("translate", () => {
  it("resolves a dotted key in the requested locale", () => {
    expect(translate("en", "settings.title")).toBe("Settings");
    expect(translate("hi", "settings.title")).toBe("सेटिंग्स");
    expect(translate("ta", "settings.rows.accounts.title")).toBe("கணக்குகள்");
  });

  it("falls back to English per missing key", () => {
    // Spanish has no resources yet → English.
    expect(translate("es", "settings.title")).toBe("Settings");
    // A locale present but missing a deep key still falls back.
    expect(translate("hi", "settings.rows.accounts.title")).not.toBe(
      "settings.rows.accounts.title",
    );
  });

  it("returns the raw key when nothing matches", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("interpolates {param} placeholders", () => {
    expect(translate("en", "language.search", { count: 14 })).toBe("Search 14 languages…");
    expect(translate("en", "language.empty", { query: "foo" })).toBe("No languages match “foo”.");
  });

  it("leaves unknown placeholders intact", () => {
    expect(translate("en", "language.search", {})).toBe("Search {count} languages…");
  });
});
