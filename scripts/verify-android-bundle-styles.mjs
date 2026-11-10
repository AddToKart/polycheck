#!/usr/bin/env node
/**
 * Proves that a production Android export actually contains NativeWind's
 * compiled stylesheet. Expo SDK 57 still resolves a bare `.css` import on
 * native when NativeWind is absent, so a build can succeed and ship an empty
 * stylesheet while every className silently does nothing.
 *
 * The fingerprints below come from the compiled stylesheet variable table:
 *   - twsa-safe-area  (nativewind safe-area theme variables)
 *   - color-red-50    (Tailwind palette variable)
 *   - color-zinc-700  (Tailwind palette variable)
 * A wired production Hermes bundle contains all three; a config-less bundle
 * contains exactly zero of each. A plain JSX `flex-1` appears in both, so it is
 * intentionally NOT used as a fingerprint.
 *
 * The palette fingerprints follow current class usage (Tailwind v4 emits used
 * variables). If a refactor removes those utilities, refresh the list from a
 * known-good bundle instead of assuming the pipeline broke.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FINGERPRINTS = ["twsa-safe-area", "color-red-50", "color-zinc-700"];
const EXPORT_TIMEOUT_MS = 15 * 60 * 1000;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const androidDir = path.join(repoRoot, "android");
const outputDir = path.join(
  os.tmpdir(),
  `polycheck-bundle-gate-${process.pid}`,
);

function countOccurrences(buffer, needle) {
  const target = Buffer.from(needle, "utf8");
  let count = 0;
  let index = buffer.indexOf(target);
  while (index !== -1) {
    count += 1;
    index = buffer.indexOf(target, index + target.length);
  }
  return count;
}

function fail(message) {
  console.error(`\n[android-bundle-styles] FAIL: ${message}`);
  console.error(
    "[android-bundle-styles] NativeWind's Metro config (android/metro.config.js -> withNativeWind)",
  );
  console.error(
    "[android-bundle-styles] is missing, not tracked, or was not applied by the bundler.",
  );
  console.error(
    "[android-bundle-styles] EAS builds from Git and would ship an unstyled APK whose className",
  );
  console.error(
    "[android-bundle-styles] styles silently do nothing. Check the config and the tracked-files gate.",
  );
  process.exitCode = 1;
}

function runExport() {
  const isWindows = process.platform === "win32";
  const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
  const args = [
    "exec",
    "expo",
    "export",
    "--platform",
    "android",
    "--output-dir",
    // With `shell: true` on Windows, Node concatenates arguments instead of
    // quoting them, so the temp path must be quoted explicitly.
    isWindows ? `"${outputDir}"` : outputDir,
    "--clear",
  ];

  console.log(
    `[android-bundle-styles] Exporting production Android bundle to ${outputDir} ...`,
  );

  const result = spawnSync(pnpm, args, {
    cwd: androidDir,
    stdio: "inherit",
    timeout: EXPORT_TIMEOUT_MS,
    shell: isWindows,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`expo export could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `expo export exited with status ${result.status ?? "null"}${
        result.signal ? ` (signal ${result.signal})` : ""
      }`,
    );
  }
}

try {
  if (!existsSync(path.join(androidDir, "package.json"))) {
    throw new Error(`android project not found at ${androidDir}`);
  }

  // Never reuse a stale export from a previous run/PID.
  rmSync(outputDir, { recursive: true, force: true });

  runExport();

  const bundleDir = path.join(outputDir, "_expo", "static", "js", "android");
  const bundles = existsSync(bundleDir)
    ? readdirSync(bundleDir).filter((file) => file.endsWith(".hbc"))
    : [];

  if (bundles.length === 0) {
    throw new Error(
      `no Hermes bundle (*.hbc) found under ${bundleDir}; the export output was not a production native bundle`,
    );
  }

  const counts = Object.fromEntries(FINGERPRINTS.map((name) => [name, 0]));
  let totalBytes = 0;

  for (const bundle of bundles) {
    const bundlePath = path.join(bundleDir, bundle);
    const bytes = readFileSync(bundlePath);
    totalBytes += bytes.length;
    for (const fingerprint of FINGERPRINTS) {
      if (bytes.includes(Buffer.from(fingerprint, "utf8"))) {
        counts[fingerprint] += countOccurrences(bytes, fingerprint);
      }
    }
  }

  const report = FINGERPRINTS.map((name) => `${name}=${counts[name]}`).join(
    ", ",
  );
  const missing = FINGERPRINTS.filter((name) => counts[name] === 0);

  console.log(
    `[android-bundle-styles] Bundles: ${bundles.join(", ")} (${(totalBytes / 1024 / 1024).toFixed(1)} MiB)`,
  );
  console.log(`[android-bundle-styles] Fingerprints: ${report}`);

  if (missing.length > 0) {
    throw new Error(
      `compiled NativeWind stylesheet fingerprints missing: ${missing.join(", ")}`,
    );
  }

  console.log(
    "[android-bundle-styles] PASS: production Android Hermes bundle contains the compiled NativeWind stylesheet.",
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  try {
    rmSync(outputDir, { recursive: true, force: true, maxRetries: 3 });
  } catch (error) {
    console.warn(
      `[android-bundle-styles] Could not remove temp export directory ${outputDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
