// A scripted stand-in for the Anthropic Messages API, for local end-to-end runs.
//   node test/mock-anthropic.mjs [port]
// It plays a short booking conversation, issues signed-looking thinking blocks,
// and rejects any request whose replayed assistant turns differ from what it
// issued (a rough model of the API's prefix check). GET /__requests lists calls.
import http from "node:http";

const port = Number(process.argv[2] || 8788);
const issued = new Set(); // JSON of every assistant content array we returned
const requests = [];
let counter = 0;

function message(model, content, stop_reason = "end_turn") {
  issued.add(JSON.stringify(content));
  return {
    id: `msg_mock_${++counter}`, type: "message", role: "assistant", model,
    content, stop_reason, stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80, cache_creation_input_tokens: 0 },
  };
}
const think = () => ({ type: "thinking", thinking: "", signature: `mocksig_${++counter}` });
const say = (t) => ({ type: "text", text: t });
const tool = (name, input) => ({ type: "tool_use", id: `toolu_mock_${++counter}`, name, input });

function userTexts(messages) {
  return messages.filter((m) => m.role === "user").flatMap((m) => m.content.filter((b) => b.type === "text").map((b) => b.text)).join("\n");
}

function reply(body) {
  const { model, messages } = body;
  const last = messages.at(-1);
  const results = last.content.filter((b) => b.type === "tool_result");
  if (results.length) {
    const prev = messages.at(-2);
    const use = prev.content.find((b) => b.type === "tool_use" && b.id === results[0].tool_use_id);
    const data = JSON.parse(results[0].content);
    if (use.name === "get_call_times") {
      const [a, b] = data.available;
      return message(model, [think(), say(`I have ${a.label} or ${b.label}. Which works better?`)]);
    }
    if (use.name === "book_call") {
      if (data.booked) return message(model, [think(), say(`You're all set for ${data.when}. The team will review your property before the call.`)]);
      return message(model, [think(), say(`Sorry, ${data.error}`)]);
    }
    return message(model, [think(), say("Got it. Someone from the team will reach out soon.")]);
  }

  const latest = last.content.map((b) => b.text || "").join(" ");
  const all = userTexts(messages);
  const phone = (all.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/) || [])[0];
  if (/ at .*(AM|PM)/i.test(latest) && phone) {
    // The seller picked one of the offered times: find it in the last get_call_times result.
    for (let i = messages.length - 1; i >= 0; i--) {
      const r = messages[i].content.find((b) => b.type === "tool_result");
      if (!r) continue;
      const data = JSON.parse(r.content);
      const pick = (data.available || []).find((s) => latest.includes(s.label));
      if (!pick) continue;
      return message(model, [think(), tool("book_call", {
        slot_id: pick.slot_id, name: "Dana Lee", phone, email: "", property_address: "123 Main St",
        city: "Mesa", state: "AZ", zip: "", sms_consent: true, property_type: "single-family",
        condition: "needs a roof", occupancy: "vacant", timeline: "30 days", reason: "inherited",
        asking_price: "", notes: "",
      })], "tool_use");
    }
  }
  if (/book|call|schedule/i.test(latest) && phone) {
    return message(model, [think(), tool("get_call_times", { day: "", part_of_day: "any" })], "tool_use");
  }
  return message(model, [think(), say("Thanks for reaching out! What's the property address, and your name and best phone number?")]);
}

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.url === "/__requests") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(requests));
    }
    let body;
    try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
    if (!Array.isArray(body.messages) || !body.messages.length) {
      // Anything that isn't a Messages API call (a health probe, a stray GET, an empty list) gets a 400, not a crash.
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "messages: Field required" } }));
    }
    requests.push({ headers: req.headers, body });
    for (const [i, m] of (body.messages || []).entries()) {
      if (m.role === "assistant" && !issued.has(JSON.stringify(m.content))) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: `messages.${i}: Invalid \`signature\` in \`thinking\` block. The block is bound to a different conversation.` } }));
      }
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(reply(body)));
  });
}).listen(port, "127.0.0.1", () => console.log(`mock anthropic on ${port}`));
