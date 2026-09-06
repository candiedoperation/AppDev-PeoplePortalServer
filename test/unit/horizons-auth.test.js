const assert = require("node:assert/strict");
const test = require("node:test");

const { expressAuthentication } = require("../../dist/auth.js");

function requestWithBearer(value) {
  return { headers: { authorization: value === undefined ? undefined : `Bearer ${value}` } };
}

test("Horizons auth accepts only the exact configured strong key", async () => {
  const previous = process.env.HORIZONS_API_KEY;
  const configuredKey = "h".repeat(32);
  process.env.HORIZONS_API_KEY = configuredKey;

  try {
    await assert.doesNotReject(expressAuthentication(requestWithBearer(configuredKey), "horizons"));
    await assert.rejects(expressAuthentication(requestWithBearer(`${configuredKey}x`), "horizons"));
    await assert.rejects(expressAuthentication({ headers: {} }, "horizons"));
  } finally {
    if (previous === undefined) delete process.env.HORIZONS_API_KEY;
    else process.env.HORIZONS_API_KEY = previous;
  }
});

test("Horizons auth fails closed for missing, short, and public placeholder keys", async () => {
  const previous = process.env.HORIZONS_API_KEY;

  try {
    for (const configuredKey of [undefined, "too-short", "replace-with-a-random-service-key"]) {
      if (configuredKey === undefined) delete process.env.HORIZONS_API_KEY;
      else process.env.HORIZONS_API_KEY = configuredKey;

      await assert.rejects(expressAuthentication(requestWithBearer(configuredKey), "horizons"));
    }
  } finally {
    if (previous === undefined) delete process.env.HORIZONS_API_KEY;
    else process.env.HORIZONS_API_KEY = previous;
  }
});
