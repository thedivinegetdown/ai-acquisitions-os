import { createFailure, createSuccess } from "../api/serviceResult";

export function repositorySuccess(data, metadata) {
  return createSuccess(data, metadata);
}

export function repositoryFailure(error, fallback, metadata) {
  return createFailure(error, fallback, metadata);
}

export async function runRepositoryOperation(operation, fallback) {
  try {
    return await operation();
  } catch (error) {
    return repositoryFailure(error, fallback);
  }
}
