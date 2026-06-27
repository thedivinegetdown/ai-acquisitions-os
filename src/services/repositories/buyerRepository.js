import { supabase } from "../../supabaseClient";
import { safeTrim } from "../../utils/text";
import {
  clearCache,
  getCachedValue,
  setCachedValue,
} from "../cache";
import {
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";

const BUYERS_CACHE_KEY = "buyers:list";
const BUYERS_CACHE_TTL_MS = 10000;

function normalizeBuyerPayload(buyer = {}) {
  return {
    email: safeTrim(buyer.email) || null,
    max_price:
      buyer.max_price === "" || buyer.max_price == null
        ? null
        : Number(buyer.max_price),
    name: safeTrim(buyer.name),
    notes: safeTrim(buyer.notes) || null,
    phone: safeTrim(buyer.phone) || null,
    target_areas: safeTrim(buyer.target_areas) || null,
  };
}

export async function listBuyers({ orderBy = "created_at" } = {}) {
  return runRepositoryOperation(async () => {
    const cacheKey = `${BUYERS_CACHE_KEY}:${orderBy}`;
    const cached = getCachedValue(cacheKey);

    if (cached) return cached;

    const { data, error } = await supabase
      .from("buyers")
      .select("*")
      .order(orderBy, { ascending: false });

    if (error) throw error;

    const result = repositorySuccess(data || []);
    setCachedValue(cacheKey, result, BUYERS_CACHE_TTL_MS);
    return result;
  }, "Could not load buyers.");
}

export async function createBuyer(buyer) {
  const payload = normalizeBuyerPayload(buyer);

  if (!payload.name) {
    return repositoryFailure("Buyer name is required.", "Could not save buyer.");
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("buyers")
      .insert([payload])
      .select()
      .limit(1);

    if (error) throw error;
    clearCache(`${BUYERS_CACHE_KEY}:created_at`);

    return repositorySuccess(data?.[0] || payload);
  }, "Could not save buyer.");
}
