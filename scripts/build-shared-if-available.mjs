import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

if (!existsSync(path.resolve("shared/src/index.ts"))) {
  console.log(
    "[postinstall] shared sources are not present yet; skipping shared build.",
  );
  process.exit(0);
}

try {
  require.resolve("tsup/package.json", {
    paths: [path.resolve("shared")],
  });
} catch {
  console.log(
    "[postinstall] tsup is not installed (production install); skipping shared build.",
  );
  process.exit(0);
}

execSync("pnpm --filter @polycheck/shared build", { stdio: "inherit" });
