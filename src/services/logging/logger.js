const isDevelopment = import.meta.env.DEV;
const SECRET_PATTERN =
  /service[_-]?role|auth[_-]?token|anon[_-]?key|secret|password|bearer\s+[a-z0-9._-]+|sk_live|sk_test/i;

function sanitizeValue(value) {
  if (value == null) return value;

  if (typeof value === "string") {
    if (SECRET_PATTERN.test(value)) return "[redacted]";
    if (value.length > 240) return `${value.slice(0, 240)}...`;
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((safe, [key, entry]) => {
      safe[key] = SECRET_PATTERN.test(key) ? "[redacted]" : sanitizeValue(entry);
      return safe;
    }, {});
  }

  return value;
}

function serializeMetadata(metadata) {
  if (!metadata) return undefined;

  try {
    return sanitizeValue(JSON.parse(JSON.stringify(metadata)));
  } catch {
    return { message: "Unable to serialize log metadata." };
  }
}

function writeLog(level, message, metadata) {
  const safeMetadata = serializeMetadata(metadata);

  if (level === "debug" && !isDevelopment) return;

  const payload = safeMetadata === undefined ? [message] : [message, safeMetadata];

  if (level === "error") {
    console.error(...payload);
    return;
  }

  if (level === "warn") {
    console.warn(...payload);
    return;
  }

  console.log(...payload);
}

export const logger = {
  info(message, metadata) {
    writeLog("info", message, metadata);
  },
  warn(message, metadata) {
    writeLog("warn", message, metadata);
  },
  error(message, metadata) {
    writeLog("error", message, metadata);
  },
  debug(message, metadata) {
    writeLog("debug", message, metadata);
  },
};

export default logger;
