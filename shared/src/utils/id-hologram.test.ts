import { describe, expect, it } from "vitest";
import {
  HOLOGRAM_DEVICE_CHIP_FULL_MASK,
  HOLOGRAM_DEVICE_CHIP_PREFIX,
  HOLOGRAM_WEB_SESSION_CHIP,
  HOLOGRAM_WATERMARK_TEXT,
  buildWatermarkLine,
  formatLiveUtcStamp,
  maskDeviceChip,
} from "./id-hologram";

const UTC = (year: number, monthIndex: number, day: number, h: number, m: number, s: number) =>
  Date.UTC(year, monthIndex, day, h, m, s);

describe("formatLiveUtcStamp", () => {
  it("formats an epoch in UTC with zero padding", () => {
    expect(formatLiveUtcStamp(UTC(2026, 10, 2, 8, 1, 14))).toBe("2026-11-02 08:01:14");
  });

  it("pads single-digit components, including seconds", () => {
    expect(formatLiveUtcStamp(UTC(2026, 0, 5, 3, 7, 2))).toBe("2026-01-05 03:07:02");
  });

  it("applies a positive clock offset (device runs fast, shifted to server)", () => {
    expect(formatLiveUtcStamp(UTC(2026, 10, 2, 8, 1, 14), 60_000)).toBe("2026-11-02 08:02:14");
  });

  it("applies a negative clock offset", () => {
    expect(formatLiveUtcStamp(UTC(2026, 10, 2, 8, 1, 14), -60_000)).toBe("2026-11-02 08:00:14");
  });

  it("rolls forward across the day boundary with an offset", () => {
    expect(formatLiveUtcStamp(UTC(2026, 10, 2, 23, 59, 59), 1_000)).toBe("2026-11-03 00:00:00");
  });

  it("rolls back across the year boundary with an offset", () => {
    expect(formatLiveUtcStamp(UTC(2027, 0, 1, 0, 0, 0), -1_000)).toBe("2026-12-31 23:59:59");
  });

  it("defaults the offset to zero", () => {
    expect(formatLiveUtcStamp(UTC(2026, 10, 2, 8, 1, 14), 0)).toBe(
      formatLiveUtcStamp(UTC(2026, 10, 2, 8, 1, 14)),
    );
  });

  it("falls back to the epoch stamp for non-finite input instead of NaN garbage", () => {
    expect(formatLiveUtcStamp(Number.NaN)).toBe("1970-01-01 00:00:00");
    expect(formatLiveUtcStamp(UTC(2026, 10, 2, 8, 1, 14), Number.POSITIVE_INFINITY)).toBe(
      "1970-01-01 00:00:00",
    );
  });
});

describe("maskDeviceChip", () => {
  it.each([undefined, null, "", "   "])("reports WEB-SESSION when no device id exists (%s)", (deviceId) => {
    expect(maskDeviceChip(deviceId)).toBe(HOLOGRAM_WEB_SESSION_CHIP);
  });

  it("reveals only the last 4 alphanumeric characters of the device id", () => {
    expect(maskDeviceChip("mobile-a1b2c3d4e5")).toBe(`${HOLOGRAM_DEVICE_CHIP_PREFIX}d4e5`);
  });

  it("ignores separators when extracting the alphanumeric tail", () => {
    expect(maskDeviceChip("AB-CD-EF-1234")).toBe(`${HOLOGRAM_DEVICE_CHIP_PREFIX}1234`);
    expect(maskDeviceChip("device:PuP_9f2a")).toBe(`${HOLOGRAM_DEVICE_CHIP_PREFIX}9f2a`);
  });

  it("uses the full mask when the alphanumeric content is shorter than 4 characters", () => {
    expect(maskDeviceChip("ab")).toBe(HOLOGRAM_DEVICE_CHIP_FULL_MASK);
    expect(maskDeviceChip("xyz")).toBe(HOLOGRAM_DEVICE_CHIP_FULL_MASK);
  });

  it("uses the full mask when the id carries no alphanumeric content at all", () => {
    expect(maskDeviceChip("--_.&")).toBe(HOLOGRAM_DEVICE_CHIP_FULL_MASK);
  });

  it("never leaks the full device id", () => {
    const chip = maskDeviceChip("mobile-a1b2c3d4e5");
    expect(chip).not.toContain("mobile-a1b2c3d4e5");
    expect(chip.endsWith("d4e5")).toBe(true);
  });
});

describe("buildWatermarkLine", () => {
  it("assembles the verified prefix, live UTC stamp, and device chip", () => {
    expect(buildWatermarkLine("2026-11-02 08:01:14", "DEVICE-BOUND •·•·4F2A")).toBe(
      "PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • DEVICE-BOUND •·•·4F2A",
    );
  });

  it("starts with the shared watermark text constant", () => {
    const line = buildWatermarkLine("1970-01-01 00:00:00", HOLOGRAM_WEB_SESSION_CHIP);
    expect(line.startsWith(`${HOLOGRAM_WATERMARK_TEXT} • LIVE UTC: `)).toBe(true);
    expect(line.endsWith(HOLOGRAM_WEB_SESSION_CHIP)).toBe(true);
  });

  it("keeps the web-session chip inline for unbound cards", () => {
    expect(buildWatermarkLine("2026-11-02 08:01:14", HOLOGRAM_WEB_SESSION_CHIP)).toBe(
      "PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • WEB-SESSION",
    );
  });
});

describe("hologram constants", () => {
  it("keeps the watermark lead text stable across platforms", () => {
    expect(HOLOGRAM_WATERMARK_TEXT).toBe("PUP-ID-VERIFIED");
  });
});
