import { createFailure } from "../api";
import { manualPropertyDataProvider } from "./manualPropertyDataProvider";
import { mockPropertyDataProvider } from "./mockPropertyDataProvider";
import { rentCastPropertyDataProvider } from "./rentCastPropertyDataProvider";
import {
  getCachedPropertyData,
  setCachedPropertyData,
} from "./propertyDataCache";
import { buildPropertyDataInput } from "./propertyDataNormalizer";

const PROVIDERS = {
  manual: manualPropertyDataProvider,
  mock: mockPropertyDataProvider,
  rentcast: rentCastPropertyDataProvider,
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
  // Live provider cache ownership is server-side and tenant-scoped.
  const cached = useCache && providerId !== "rentcast" ? getCachedPropertyData(cacheKey) : null;
  if (cached) return cached;

  const provider = getPropertyDataProvider(providerId);
  const result = await provider.lookupPropertyData(input);

  if (result.success) {
    if (providerId !== "rentcast") setCachedPropertyData(cacheKey, result);
  }

  return result;
}

export function listPropertyDataProviders() {
  return [
    manualPropertyDataProvider,
    mockPropertyDataProvider,
    rentCastPropertyDataProvider,
    {
      id: "api-placeholder",
      label: "Future property API provider",
      available: false,
    },
  ];
}
