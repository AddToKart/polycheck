#!/usr/bin/env node
/**
 * EAS builds run from a Git checkout, so a file only reaches the build when it
 * is BOTH present in the working tree AND tracked by Git. A file that exists
 * locally but is gitignored (or never committed) silently disappears from EAS,
 * which is exactly how android/metro.config.js shipped an unstyled APK.
 *
 * This gate asserts the release-critical files are present, tracked, and not
 * ignored. It is deliberately dependency-free and safe to run before any build.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RELEASE_CRITICAL_FILES = [
  "android/metro.config.js",
  "android/babel.config.js",
  "android/global.css",
  "android/postcss.config.mjs",
  "android/app.json",
  "android/eas.json",
  "scripts/build-shared-if-available.mjs",
  "pnpm-workspace.yaml",
];

function git(args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function firstLine(value) {
  const text = (value ?? "").trim();
  return text ? text.split(/\r?\n/, 1)[0] : "";
}

const failures = [];

for (const relPath of RELEASE_CRITICAL_FILES) {
  const absolutePath = path.join(repoRoot, relPath);

  if (!existsSync(absolutePath)) {
    failures.push(`${relPath}: missing from the working tree`);
    continue;
  }

  // `HEAD:<path>` proves the file is committed, not merely staged. EAS builds
  // from a clone of committed state, while `git ls-files` also lists staged files.
  const committed = git(["cat-file", "-e", `HEAD:${relPath}`]);
  if (committed.error) {
    failures.push(
      `${relPath}: could not run git (${committed.error.message}); is Git installed and on PATH?`,
    );
    break;
  }
  if (committed.status !== 0) {
    failures.push(
      `${relPath}: not committed at HEAD (git cat-file -e failed)${
        firstLine(committed.stderr) ? `: ${firstLine(committed.stderr)}` : ""
      }`,
    );
  }

  // Exit 0 means the path is ignored; exit 1 means it is not ignored. Any other
  // status is a Git error and must fail the gate rather than pass silently.
  // `--no-index` applies the ignore rules to tracked paths too; without it Git
  // skips tracked files and this assertion would be inert.
  const ignored = git(["check-ignore", "--quiet", "--no-index", "--", relPath]);
  if (ignored.error) {
    failures.push(
      `${relPath}: could not run git check-ignore (${ignored.error.message})`,
    );
    break;
  }
  if (ignored.status === 0) {
    failures.push(
      `${relPath}: ignored by Git (git check-ignore matched), so EAS will not receive it`,
    );
  } else if (ignored.status !== 1) {
    failures.push(
      `${relPath}: git check-ignore exited ${ignored.status}${
        firstLine(ignored.stderr) ? `: ${firstLine(ignored.stderr)}` : ""
      }`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    `[tracked-build-files] FAIL: ${failures.length} release-critical path(s) would not reach an EAS build:`,
  );
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error(
    "[tracked-build-files] EAS builds from Git; commit the file(s) and remove any ignore rule before releasing.",
  );
  process.exit(1);
}

console.log(
  `[tracked-build-files] PASS: all ${RELEASE_CRITICAL_FILES.length} release-critical files are present, tracked, and not ignored.`,
);
