const test = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../netlify/functions/contact.js");

const baseInquiry = {
  first_name: "Alex",
  last_name: "Morgan",
  email: "alex@example.com",
  phone: "",
  preferred_contact: "Email",
  callback_date_one: "",
  callback_from_one: "",
  callback_to_one: "",
  callback_date_two: "",
  callback_from_two: "",
  callback_to_two: "",
  project_type: "General Inquiry / Not Sure Yet",
  event_size: "",
  "administrative_services[]": [],
  "speaking_topics[]": [],
  project_message: "I would like to discuss a possible project.",
  website: ""
};

const request = async (body, method = "POST", headers = { "content-type": "application/json" }) => handler({
  httpMethod: method,
  headers,
  body: typeof body === "string" ? body : JSON.stringify(body)
});

const statusFor = async (body) => (await request(body)).statusCode;
const inquiry = (overrides = {}) => ({ ...baseInquiry, ...overrides });
const withOrigins = async (value, callback) => {
  const previous = process.env.CONTACT_ALLOWED_ORIGINS;

  if (value === undefined) {
    delete process.env.CONTACT_ALLOWED_ORIGINS;
  } else {
    process.env.CONTACT_ALLOWED_ORIGINS = value;
  }

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.CONTACT_ALLOWED_ORIGINS;
    } else {
      process.env.CONTACT_ALLOWED_ORIGINS = previous;
    }
  }
};

const deliveryKeys = [
  "RESEND_API_KEY",
  "CONTACT_TO_EMAIL",
  "CONTACT_FROM_EMAIL"
];

const withDelivery = async (overrides, fetchMock, callback) => {
  const previous = Object.fromEntries(
    deliveryKeys.map((key) => [key, process.env[key]])
  );
  const previousFetch = global.fetch;

  Object.assign(process.env, {
    RESEND_API_KEY: "test-resend-key",
    CONTACT_TO_EMAIL: "to@example.com",
    CONTACT_FROM_EMAIL: "PMA Website <from@example.com>",
    ...overrides
  });
  global.fetch = fetchMock;

  try {
    return await callback();
  } finally {
    for (const key of deliveryKeys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
    global.fetch = previousFetch;
  }
};

const successfulFetch = async () => ({ ok: true, status: 200 });
const failedFetch = (status) => async () => ({ ok: false, status });
const phoneWindow = {
  phone: "+1 (202) 555-0100",
  preferred_contact: "Phone",
  callback_date_one: "2026-09-15",
  callback_from_one: "09:00",
  callback_to_one: "10:00"
};

// Valid requests

test("email general inquiry is valid", async () => {
  assert.equal(await statusFor(inquiry()), 503);
});

test("phone inquiry with one callback window is valid", async () => {
  assert.equal(await statusFor(inquiry(phoneWindow)), 503);
});

test("phone inquiry with two callback windows is valid", async () => {
  assert.equal(await statusFor(inquiry({
    ...phoneWindow,
    callback_date_two: "2026-09-16",
    callback_from_two: "14:00",
    callback_to_two: "15:00"
  })), 503);
});

test("event planning inquiry accepts its event size", async () => {
  assert.equal(await statusFor(inquiry({
    project_type: "Event Planning",
    event_size: "50–99 attendees"
  })), 503);
});

test("administrative inquiry accepts known services", async () => {
  assert.equal(await statusFor(inquiry({
    project_type: "Administrative and Process Consultation",
    "administrative_services[]": ["Process Flow", "Checklists and Guides"]
  })), 503);
});

test("speaking inquiry accepts known topics", async () => {
  assert.equal(await statusFor(inquiry({
    project_type: "Speaking Engagement",
    "speaking_topics[]": ["Star Trek Fandom", "Law Enforcement Intelligence"]
  })), 503);
});

// Required fields

test("missing first name fails", async () => {
  assert.equal(await statusFor(inquiry({ first_name: "" })), 400);
});

test("missing last name fails", async () => {
  assert.equal(await statusFor(inquiry({ last_name: "" })), 400);
});

test("missing email fails", async () => {
  assert.equal(await statusFor(inquiry({ email: "" })), 400);
});

test("malformed email fails", async () => {
  assert.equal(await statusFor(inquiry({ email: "alex.example.com" })), 400);
});

test("missing preferred contact fails", async () => {
  assert.equal(await statusFor(inquiry({ preferred_contact: "" })), 400);
});

test("invalid preferred contact fails", async () => {
  assert.equal(await statusFor(inquiry({ preferred_contact: "Text" })), 400);
});

test("missing project type fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "" })), 400);
});

test("invalid project type fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Consulting" })), 400);
});

test("missing message fails", async () => {
  assert.equal(await statusFor(inquiry({ project_message: "" })), 400);
});

// Phone and callback validation

test("phone contact without a phone fails", async () => {
  assert.equal(await statusFor(inquiry({
    preferred_contact: "Phone",
    callback_date_one: "2026-09-15",
    callback_from_one: "09:00",
    callback_to_one: "10:00"
  })), 400);
});

test("phone with too few digits fails", async () => {
  assert.equal(await statusFor(inquiry({ phone: "123-456" })), 400);
});

test("email contact with an empty phone is valid", async () => {
  assert.equal(await statusFor(inquiry({ phone: "" })), 503);
});

test("phone contact without callback date fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_date_one: "" })), 400);
});

test("phone contact without callback start fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_from_one: "" })), 400);
});

test("phone contact without callback end fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_to_one: "" })), 400);
});

test("callback with end before start fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_from_one: "15:00", callback_to_one: "14:00" })), 400);
});

test("invalid callback date fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_date_one: "09/15/2026" })), 400);
});

test("invalid callback time fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_from_one: "9am" })), 400);
});

// Optional second callback window

test("empty second callback window is valid", async () => {
  assert.equal(await statusFor(inquiry(phoneWindow)), 503);
});

test("second callback date alone fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_date_two: "2026-09-16" })), 400);
});

test("second callback start alone fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_from_two: "14:00" })), 400);
});

test("partial second callback window fails", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_date_two: "2026-09-16", callback_to_two: "15:00" })), 400);
});

test("complete second callback window is valid", async () => {
  assert.equal(await statusFor(inquiry({ ...phoneWindow, callback_date_two: "2026-09-16", callback_from_two: "14:00", callback_to_two: "15:00" })), 503);
});

// Project conditional validation

test("general inquiry with conditional fields fails", async () => {
  assert.equal(await statusFor(inquiry({ event_size: "50–99 attendees" })), 400);
});

test("event planning rejects administrative services", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Event Planning", "administrative_services[]": ["Process Flow"] })), 400);
});

test("administrative project rejects event size", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Administrative and Process Consultation", event_size: "50–99 attendees" })), 400);
});

test("administrative invented service fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Administrative and Process Consultation", "administrative_services[]": ["Payroll"] })), 400);
});

test("administrative duplicate service fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Administrative and Process Consultation", "administrative_services[]": ["Process Flow", "Process Flow"] })), 400);
});

test("speaking project rejects administrative services", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Speaking Engagement", "administrative_services[]": ["Process Flow"] })), 400);
});

test("speaking invented topic fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Speaking Engagement", "speaking_topics[]": ["Public Relations"] })), 400);
});

test("speaking duplicate topic fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Speaking Engagement", "speaking_topics[]": ["Star Trek Fandom", "Star Trek Fandom"] })), 400);
});

test("event planning rejects speaking topics", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Event Planning", "speaking_topics[]": ["Star Trek Fandom"] })), 400);
});

// Length and primitive safety

test("overlong first name fails", async () => {
  assert.equal(await statusFor(inquiry({ first_name: "A".repeat(101) })), 400);
});

test("overlong email fails", async () => {
  assert.equal(await statusFor(inquiry({ email: `${"a".repeat(245)}@example.com` })), 400);
});

test("overlong phone fails", async () => {
  assert.equal(await statusFor(inquiry({ phone: `+${"1".repeat(40)}` })), 400);
});

test("overlong message fails", async () => {
  assert.equal(await statusFor(inquiry({ project_message: "x".repeat(5001) })), 400);
});

test("array item with wrong primitive fails", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "Speaking Engagement", "speaking_topics[]": [42] })), 400);
});

test("unexpected field fails", async () => {
  assert.equal(await statusFor({ ...inquiry(), hidden_note: "unexpected" }), 400);
});

// P2.0 transport regressions

test("GET remains method not allowed", async () => {
  const response = await request(inquiry(), "GET");
  assert.equal(response.statusCode, 405);
});

test("malformed JSON remains invalid JSON", async () => {
  const response = await request("{");
  assert.equal(response.statusCode, 400);
  assert.match(response.body, /invalid_json/);
});

test("non-object JSON remains validation error", async () => {
  assert.equal(await statusFor("[]"), 400);
});

test("valid request still reaches unavailable delivery boundary", async () => {
  const response = await request(inquiry());
  assert.equal(response.statusCode, 503);
  assert.match(response.body, /service_unavailable/);
});

// Abuse and transport protection

test("POST without JSON content type fails", async () => {
  assert.equal((await request(inquiry(), "POST", {})).statusCode, 415);
});

test("text content type fails", async () => {
  assert.equal((await request(inquiry(), "POST", { "content-type": "text/plain" })).statusCode, 415);
});

test("form URL encoded content type fails", async () => {
  assert.equal((await request(inquiry(), "POST", { "content-type": "application/x-www-form-urlencoded" })).statusCode, 415);
});

test("JSON content type follows validation path", async () => {
  assert.equal((await request(inquiry(), "POST", { "content-type": "application/json" })).statusCode, 503);
});

test("JSON charset content type is accepted", async () => {
  assert.equal((await request(inquiry(), "POST", { "content-type": "application/json; charset=utf-8" })).statusCode, 503);
});

test("empty honeypot is accepted", async () => {
  assert.equal(await statusFor(inquiry({ website: "" })), 503);
});

test("whitespace-only honeypot is accepted", async () => {
  assert.equal(await statusFor(inquiry({ website: "   " })), 503);
});

test("populated honeypot is rejected generically", async () => {
  const response = await request(inquiry({ website: "https://spam.example" }));
  assert.equal(response.statusCode, 400);
  assert.match(response.body, /validation_error/);
  assert.doesNotMatch(response.body, /honeypot/);
});

test("disallowed configured origin fails", async () => {
  const response = await withOrigins("https://pma.example", () =>
    request(inquiry(), "POST", {
      origin: "https://attacker.example",
      "content-type": "application/json"
    })
  );
  assert.equal(response.statusCode, 403);
  assert.match(response.body, /forbidden/);
});

test("allowed configured origin is accepted", async () => {
  const response = await withOrigins("https://pma.example", () =>
    request(inquiry(), "POST", {
      origin: "https://pma.example",
      "content-type": "application/json"
    })
  );
  assert.equal(response.statusCode, 503);
});

test("multiple configured origins are supported", async () => {
  const response = await withOrigins("https://pma.example, https://www.pma.example", () =>
    request(inquiry(), "POST", {
      origin: "https://www.pma.example",
      "content-type": "application/json"
    })
  );
  assert.equal(response.statusCode, 503);
});

test("missing origin configuration preserves development behavior", async () => {
  const response = await withOrigins("", () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("missing Origin header is accepted for tests", async () => {
  const response = await withOrigins("https://pma.example", () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("responses include no-store", async () => {
  const response = await request(inquiry());
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("responses include nosniff", async () => {
  const response = await request(inquiry());
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
});

test("responses declare JSON UTF-8", async () => {
  const response = await request(inquiry());
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
});

test("CRLF in email is rejected", async () => {
  assert.equal(await statusFor(inquiry({ email: "alex@example.com\r\nBcc:spam@example.com" })), 400);
});

test("CRLF in name is rejected", async () => {
  assert.equal(await statusFor(inquiry({ first_name: "Alex\nInjected" })), 400);
});

test("NUL in structured field is rejected", async () => {
  assert.equal(await statusFor(inquiry({ project_type: "General\0 Inquiry / Not Sure Yet" })), 400);
});

test("newlines in project message remain valid", async () => {
  assert.equal(await statusFor(inquiry({ project_message: "First line.\nSecond line." })), 503);
});

test("oversized body remains rejected", async () => {
  const response = await request("x".repeat(32 * 1024 + 1));
  assert.equal(response.statusCode, 413);
});

// Resend delivery boundary

test("missing Resend API key returns service unavailable", async () => {
  const response = await withDelivery({ RESEND_API_KEY: "" }, successfulFetch, () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("missing recipient configuration returns service unavailable", async () => {
  const response = await withDelivery({ CONTACT_TO_EMAIL: "" }, successfulFetch, () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("missing sender configuration returns service unavailable", async () => {
  const response = await withDelivery({ CONTACT_FROM_EMAIL: "" }, successfulFetch, () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("provider success returns ok without provider data", async () => {
  const response = await withDelivery({}, successfulFetch, () => request(inquiry()));
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '{"ok":true}');
});

for (const status of [400, 401, 403, 429, 500]) {
  test(`provider ${status} returns generic service failure`, async () => {
    const response = await withDelivery({}, failedFetch(status), () => request(inquiry()));
    assert.equal(response.statusCode, 503);
    assert.match(response.body, /service_unavailable/);
  });
}

test("provider network rejection returns generic service failure", async () => {
  const response = await withDelivery({}, async () => {
    throw new Error("network failure");
  }, () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("provider abort rejection returns generic service failure", async () => {
  const response = await withDelivery({}, async (_url, options) => {
    options.signal.dispatchEvent(new Event("abort"));
    throw new Error("aborted");
  }, () => request(inquiry()));
  assert.equal(response.statusCode, 503);
});

test("provider timeout returns generic service failure", async () => {
  const previousTimeout = global.setTimeout;

  global.setTimeout = (callback) => {
    callback();
    return 0;
  };

  try {
    const response = await withDelivery({}, async (_url, options) => {
      assert.equal(options.signal.aborted, true);
      throw new Error("timeout");
    }, () => request(inquiry()));
    assert.equal(response.statusCode, 503);
  } finally {
    global.setTimeout = previousTimeout;
  }
});

test("provider receives the expected request", async () => {
  let captured;
  const response = await withDelivery({}, async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 200 };
  }, () => request(inquiry({ project_type: "Event Planning" })));

  assert.equal(response.statusCode, 200);
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.Authorization, "Bearer test-resend-key");
  assert.equal(captured.options.headers["Content-Type"], "application/json");
  assert.equal(captured.options.headers["User-Agent"], "PMA-Consulting-Website/1.0");
});

test("provider uses configured sender and recipient only", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry()));

  assert.equal(body.from, "PMA Website <from@example.com>");
  assert.deepEqual(body.to, ["to@example.com"]);
  assert.equal(body.reply_to, "alex@example.com");
});

test("provider uses a stable safe subject", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry({ project_type: "Event Planning" })));

  assert.equal(body.subject, "New PMA Consulting Inquiry — Event Planning");
  assert.doesNotMatch(body.subject, /alex@example|possible project|555/);
});

test("provider receives readable text and HTML bodies", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry()));

  assert.match(body.text, /PMA CONSULTING WEBSITE INQUIRY/);
  assert.match(body.text, /Project \/ Inquiry/);
  assert.match(body.html, /<h1>PMA Consulting Website Inquiry<\/h1>/);
});

test("user HTML is escaped in the email body", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry({
    first_name: "<script>",
    last_name: "O'Reilly & \"Co\"",
    project_message: "<script>alert('x')</script>\nSecond line"
  })));

  assert.match(body.html, /&lt;script&gt;/);
  assert.match(body.html, /O&#39;Reilly &amp; &quot;Co&quot;/);
  assert.doesNotMatch(body.html, /<script>/);
  assert.match(body.html, /<br>Second line/);
  assert.match(body.text, /<script>alert\('x'\)<\/script>\nSecond line/);
});

test("API key and provider data are not exposed", async () => {
  const response = await withDelivery({}, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "re_secret_provider_id" })
  }), () => request(inquiry()));

  assert.equal(response.body, '{"ok":true}');
  assert.doesNotMatch(response.body, /test-resend-key|re_secret_provider_id|to@example/);
});

test("empty callback fields are omitted from email", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry()));

  assert.doesNotMatch(body.text, /Callback Window/);
});

test("phone callback fields are included in email", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry(phoneWindow)));

  assert.match(body.text, /Callback Window 1/);
  assert.match(body.text, /2026-09-15/);
});

test("event size is included only for event planning", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry({ project_type: "Event Planning", event_size: "Up to 25–50 attendees" })));

  assert.match(body.text, /Event Size/);
});

test("administrative selections are rendered", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry({
    project_type: "Administrative and Process Consultation",
    "administrative_services[]": ["Process Flow"]
  })));

  assert.match(body.text, /Administrative Services\nProcess Flow/);
});

test("speaking selections are rendered", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry({
    project_type: "Speaking Engagement",
    "speaking_topics[]": ["Star Trek Fandom"]
  })));

  assert.match(body.text, /Speaking Topics\nStar Trek Fandom/);
});

test("general inquiry omits irrelevant email sections", async () => {
  let body;
  await withDelivery({}, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200 };
  }, () => request(inquiry()));

  assert.doesNotMatch(body.text, /Event Size|Administrative Services|Speaking Topics|Callback Window/);
});

test("honeypot rejection occurs before provider call", async () => {
  let calls = 0;
  const response = await withDelivery({}, async () => {
    calls++;
    return { ok: true, status: 200 };
  }, () => request(inquiry({ website: "bot" })));

  assert.equal(response.statusCode, 400);
  assert.equal(calls, 0);
});

test("validation failure occurs before provider call", async () => {
  let calls = 0;
  const response = await withDelivery({}, async () => {
    calls++;
    return { ok: true, status: 200 };
  }, () => request(inquiry({ email: "invalid" })));

  assert.equal(response.statusCode, 400);
  assert.equal(calls, 0);
});

test("forbidden Origin occurs before provider call", async () => {
  let calls = 0;
  const response = await withDelivery({}, async () => {
    calls++;
    return { ok: true, status: 200 };
  }, () => withOrigins("https://allowed.example", () => request(inquiry(), "POST", {
    origin: "https://blocked.example",
    "content-type": "application/json"
  })));

  assert.equal(response.statusCode, 403);
  assert.equal(calls, 0);
});
