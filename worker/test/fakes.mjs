// In-memory stand-ins for Cloudflare bindings.
export function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(k, opts) {
      const v = store.has(k) ? store.get(k).value : null;
      const type = typeof opts === "string" ? opts : opts && opts.type;
      return v !== null && type === "json" ? JSON.parse(v) : v;
    },
    async put(k, value, opts = {}) { store.set(k, { value, metadata: opts.metadata }); },
    async list({ prefix = "" } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name, metadata: store.get(name).metadata }));
      return { keys, list_complete: true };
    },
  };
}

export function fakeMailer() {
  const sent = [];
  return { sent, async send(msg) { sent.push(msg); } };
}

/** A fake Anthropic client whose beta.messages.create replays scripted responses. */
export function fakeClient(script) {
  const calls = [];
  const options = [];
  let i = 0;
  return {
    calls,
    options,
    beta: {
      messages: {
        async create(params, opts = {}) {
          calls.push(JSON.parse(JSON.stringify(params)));
          options.push(opts);
          const step = script[i++];
          if (!step) throw new Error("script exhausted");
          return typeof step === "function" ? step(params) : step;
        },
      },
    },
  };
}

let n = 0;
export function msg(content, stop_reason = "end_turn", extra = {}) {
  return {
    id: `msg_${++n}`, type: "message", role: "assistant", model: "claude-opus-5-5",
    content, stop_reason, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    ...extra,
  };
}
export const thinking = () => ({ type: "thinking", thinking: "", signature: `sig_${++n}` });
export const text = (t) => ({ type: "text", text: t });
export const toolUse = (name, input) => ({ type: "tool_use", id: `toolu_${++n}`, name, input });
