import { ColorSpace } from "#src/index";
import { describe, expect, it } from "vitest";

describe("ColorSpace", () => {
  it("should export ColorSpace constants", () => {
    expect(ColorSpace.DeviceGray).toBe("DeviceGray");
    expect(ColorSpace.DeviceRGB).toBe("DeviceRGB");
    expect(ColorSpace.DeviceCMYK).toBe("DeviceCMYK");
    expect(ColorSpace.Pattern).toBe("Pattern");
  });
});
