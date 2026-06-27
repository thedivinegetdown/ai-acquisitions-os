import { appConfig } from "../config";
import { logger } from "../logging";
import { monitorAsync } from "../monitoring";
import { createFailure, createSuccess } from "./serviceResult";

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonResponse(response) {
  const responseText = await response.text();

  if (!responseText || responseText.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Invalid JSON response from server.");
  }
}

export async function callNetlifyFunction(
  functionName,
  {
    method = "POST",
    body,
    headers = {},
    retries = 1,
    retryDelayMs = 250,
  } = {}
) {
  return monitorAsync(`netlify:${functionName}`, async () => {
    const url = `${appConfig.apiBasePath}/${functionName}`;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = await parseJsonResponse(response);

        if (!response.ok || data.success === false) {
          const errorMessage = data.error || `Request failed with status ${response.status}`;
          lastError = new Error(errorMessage);

          if (attempt < retries && RETRY_STATUSES.has(response.status)) {
            await wait(retryDelayMs * (attempt + 1));
            continue;
          }

          return createFailure(lastError, "API request failed.", {
            status: response.status,
            functionName,
          });
        }

        return createSuccess(data, {
          status: response.status,
          functionName,
          attempt: attempt + 1,
        });
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          logger.warn("[api] retrying Netlify function", {
            functionName,
            attempt: attempt + 1,
            error: error?.message,
          });
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
      }
    }

    return createFailure(lastError, "API request failed.", { functionName });
  });
}
