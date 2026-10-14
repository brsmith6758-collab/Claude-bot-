// Lets Node load Worker modules: maps Cloudflare-only imports to local stubs.
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
