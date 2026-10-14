// Builds worker/cloudflare-paste/worker.js: the whole Worker (with the Anthropic SDK) as one
// file to paste into the Cloudflare dashboard editor. Run: npm run bundle:paste
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "pac-bundle-"));
execFileSync("npx", ["wrangler", "deploy", "--dry-run", "--minify", "--outdir", out], { stdio: "inherit" });
const code = readFileSync(join(out, "index.js"), "utf8").replace(/\n\/\/# sourceMappingURL=.*\s*$/, "\n");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const sdk = JSON.parse(readFileSync("node_modules/@anthropic-ai/sdk/package.json", "utf8")).version;
const header = `// Prime Acre Capital chat assistant v${pkg.version} (Anthropic SDK ${sdk}).
// Generated from worker/src by "npm run bundle:paste". Do not edit by hand.
// Paste this entire file into the Cloudflare dashboard editor, replacing everything, then Deploy.
`;
mkdirSync("cloudflare-paste", { recursive: true });
writeFileSync("cloudflare-paste/worker.js", header + code);
rmSync(out, { recursive: true, force: true });
console.log(`wrote cloudflare-paste/worker.js (${Math.round((header + code).length / 1024)} KB)`);
