const BASE = process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1";
const MODEL = process.env.MIMO_MODEL || "mimo-v2.5-pro";
const ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "POST only" };
  if (!process.env.MIMO_API_KEY)
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "MIMO_API_KEY not set" }) };

  let system, input;
  try { ({ system, input } = JSON.parse(event.body || "{}")); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "bad JSON" }) }; }
  if (!system || input === undefined)
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "expected { system, input }" }) };

  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MIMO_API_KEY}`,
        "api-key": process.env.MIMO_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000, temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: typeof input === "string" ? input : JSON.stringify(input) },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: `MiMo HTTP ${r.status}`, detail: detail.slice(0, 300) }) };
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ text }) };
  } catch (err) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
