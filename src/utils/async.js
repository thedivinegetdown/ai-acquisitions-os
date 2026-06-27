import { createFailure } from "../services/api";

export async function safeAsync(operation, fallback = "Request failed.") {
  try {
    return await operation();
  } catch (error) {
    return createFailure(error, fallback);
  }
}

export function createAsyncState(data = null) {
  return {
    data,
    loading: false,
    error: "",
  };
}
