import { createFailure, createSuccess } from "../api/serviceResult";

export const REPOSITORY_LIST_LIMIT = 100;

export function normalizeRepositoryListLimit(
  value,
  fallback = REPOSITORY_LIST_LIMIT
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(REPOSITORY_LIST_LIMIT, Math.max(1, Math.floor(parsed)));
}

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
