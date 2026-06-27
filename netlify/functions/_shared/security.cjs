const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECRET_PATTERN =
  /service[_-]?role|auth[_-]?token|anon[_-]?key|secret|password|bearer\s+[a-z0-9._-]+|sk_live|sk_test/i;

function json(statusCode, body = {}, headers = {}) {
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function text(statusCode, body = "", headers = {}) {
  return {
    statusCode,
    headers,
    body,
  };
}

function methodNotAllowed() {
  return json(405, { success: false, error: "Method not allowed." });
}

function handleOptions() {
  return json(200, { success: true });
}

function parseJsonBody(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { body: null, error: "Invalid JSON body." };
    }

    return { body, error: "" };
  } catch {
    return { body: null, error: "Invalid JSON body." };
  }
}

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value, maxLength) {
  return safeTrim(value).slice(0, maxLength);
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTrim(value).toLowerCase());
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function normalizeUsPhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function isValidPhone(value) {
  const digits = normalizePhone(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function sanitizeLogValue(value) {
  if (value == null) return value;

  if (typeof value === "string") {
    if (SECRET_PATTERN.test(value)) return "[redacted]";
    if (value.length > 240) return `${value.slice(0, 240)}...`;
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue);
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((safe, [key, entry]) => {
      safe[key] = SECRET_PATTERN.test(key) ? "[redacted]" : sanitizeLogValue(entry);
      return safe;
    }, {});
  }

  return value;
}

function logInfo(message, metadata) {
  console.log(message, sanitizeLogValue(metadata || {}));
}

function logWarn(message, metadata) {
  console.warn(message, sanitizeLogValue(metadata || {}));
}

function logError(message, error) {
  console.error(
    message,
    sanitizeLogValue({
      message: error?.message || String(error || ""),
      code: error?.code,
      status: error?.status,
      type: error?.type,
    })
  );
}

function safeErrorMessage(error, fallback = "Request failed.") {
  const message = error?.message || String(error || "");
  return SECRET_PATTERN.test(message) ? fallback : message || fallback;
}

function requirePost(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return methodNotAllowed();
  return null;
}

module.exports = {
  DEFAULT_HEADERS,
  handleOptions,
  isLikelyEmail,
  isValidPhone,
  json,
  logError,
  logInfo,
  logWarn,
  methodNotAllowed,
  normalizePhone,
  normalizeUsPhoneDigits,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
  safeTrim,
  text,
  truncate,
};
