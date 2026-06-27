import { createFailure } from "../api";
import { manualPropertyDataProvider } from "./manualPropertyDataProvider";
import { mockPropertyDataProvider } from "./mockPropertyDataProvider";
import {
  getCachedPropertyData,
  setCachedPropertyData,
} from "./propertyDataCache";
import { buildPropertyDataInput } from "./propertyDataNormalizer";

const PROVIDERS = {
  manual: manualPropertyDataProvider,
  mock: mockPropertyDataProvider,
};

export function getPropertyDataProvider(providerId = "manual") {
  return PROVIDERS[providerId] || manualPropertyDataProvider;
}

export async function lookupPropertyData({
  address = "",
  deal = {},
  manualData = {},
  providerId = "manual",
  useCache = true,
} = {}) {
  const input = buildPropertyDataInput({ address, deal, manualData });

  if (!input.address) {
    return createFailure(
      new Error("Property address is required for lookup."),
      "Property address is required for lookup."
    );
  }

  const cacheKey = {
    address: `${providerId}:${input.address}`,
  };
  const cached = useCache ? getCachedPropertyData(cacheKey) : null;
  if (cached) return cached;

  const provider = getPropertyDataProvider(providerId);
  const result = await provider.lookupPropertyData(input);

  if (result.success) {
    setCachedPropertyData(cacheKey, result);
  }

  return result;
}

export function listPropertyDataProviders() {
  return [
    manualPropertyDataProvider,
    mockPropertyDataProvider,
    {
      id: "api-placeholder",
      label: "Future property API provider",
      available: false,
    },
  ];
}
