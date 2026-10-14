export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:email") {
    return { url: new URL("./stubs/cloudflare-email.mjs", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
