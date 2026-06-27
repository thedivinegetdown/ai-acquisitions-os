import { createServiceError } from "../../utils/errors";

export function createSuccess(data, metadata = {}) {
  return {
    success: true,
    data,
    metadata,
  };
}

export function createFailure(error, fallback = "Request failed.", metadata = {}) {
  return {
    success: false,
    error: createServiceError(error, fallback),
    metadata,
  };
}

export async function runServiceOperation(operation, fallback = "Request failed.") {
  try {
    return await operation();
  } catch (error) {
    return createFailure(error, fallback);
  }
}
