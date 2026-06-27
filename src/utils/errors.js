export function getErrorMessage(error, fallback = "Something went wrong.") {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && "message" in error && error.message) {
    return String(error.message);
  }

  return fallback;
}

export function toUserSafeError(error, fallback = "Unable to complete request.") {
  const message = getErrorMessage(error, fallback);

  if (/service_role|auth_token|anon_key|secret|password/i.test(message)) {
    return fallback;
  }

  return message;
}

export function createServiceError(error, fallback = "Request failed.") {
  return {
    message: toUserSafeError(error, fallback),
    cause: error,
  };
}
