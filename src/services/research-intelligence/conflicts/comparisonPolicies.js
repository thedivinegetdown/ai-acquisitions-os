import { resolveAssetTypeAlias } from "../../asset-strategy/assetClassificationService";
import { normalizeStrategyTimeline } from "../../asset-strategy/strategyTimeline";
import { compactText } from "../../../utils/text";
import { CONFLICT_COMPARISON_TYPES } from "./conflictContracts";

const UNKNOWN = new Set(["", "unknown", "not sure", "unsure", "tbd", "n/a", "na", "unavailable"]);

function normalizedText(value) {
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  const normalized = compactText(String(value)).toLowerCase().replace(/[.,;:]+$/g, "");
  return UNKNOWN.has(normalized) ? null : normalized;
}

function number(value, money = false) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const compact = value.trim();
  if (!compact || UNKNOWN.has(compact.toLowerCase())) return null;
  const parsed = Number(money ? compact.replace(/[$,\s]/g, "") : compact.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function date(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value.trim())) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function boolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizedText(value);
  if (["true", "yes", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return null;
}

function knownStatus(value, mappings = {}) {
  const normalized = normalizedText(value)?.replace(/[-_/]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return null;
  return mappings[normalized] || normalized;
}

export function normalizeConflictComparableValue(policy, value, options = {}) {
  switch (policy) {
    case CONFLICT_COMPARISON_TYPES.MONEY: return number(value, true);
    case CONFLICT_COMPARISON_TYPES.NUMBER: return number(value);
    case CONFLICT_COMPARISON_TYPES.DATE: return date(value);
    case CONFLICT_COMPARISON_TYPES.BOOLEAN: return boolean(value);
    case CONFLICT_COMPARISON_TYPES.ASSET_TYPE: {
      const resolution = resolveAssetTypeAlias(value);
      return resolution.assetType || normalizedText(value);
    }
    case CONFLICT_COMPARISON_TYPES.PARCEL_IDENTIFIER:
    case CONFLICT_COMPARISON_TYPES.IDENTIFIER:
      return normalizedText(value)?.toUpperCase() || null;
    case CONFLICT_COMPARISON_TYPES.KNOWN_STATUS:
      return knownStatus(value, options.statusMappings);
    case CONFLICT_COMPARISON_TYPES.TIMELINE: {
      const timeline = normalizeStrategyTimeline(value, options.evaluatedTimestamp);
      return timeline.state === "present" ? timeline.days : null;
    }
    default:
      return normalizedText(value)?.replace(/[-_/]+/g, " ").replace(/\s+/g, " ") || null;
  }
}

export function isConcreteEvidenceValue(value) {
  if (!["string", "number", "boolean"].includes(typeof value)) return false;
  const normalized = normalizedText(value);
  return normalized !== null && !["recorded value", "available", "evidence attached", "current field is present"].includes(normalized);
}
