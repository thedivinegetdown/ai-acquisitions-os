import Papa from "papaparse";
import { detectDuplicateLeads } from "./duplicateLeadService";
import {
  normalizeLead,
  toDealImportPayload,
  toDealPreviewPayload,
} from "./leadNormalizationService";
import { validateLeads } from "./leadValidationService";
import { normalizeCanonicalEvidence as normalizeEvidenceReference } from "../research-intelligence/evidence/evidenceContracts";

const TAX_SOURCE = "orange-county-tax-sale";
const OCPA_SOURCE = "orange-county-property-appraiser";
const TAX_REFERENCE = "https://services1.arcgis.com/0U8EQ1FrumPeIqDb/ArcGIS/rest/services/Tax_Sale_Data/FeatureServer/0/query";
const OCPA_REFERENCE = "https://vgispublic.ocpafl.org/server/rest/services/DynamicForJs/PARCEL/MapServer/1/query";

function parcelKey(value) {
  return String(value || "").replace(/[\s-]/g, "").toLowerCase();
}

function countyEvidence({ sourceSystem, sourceType, sourceRecordId, sourceField, relatedCanonicalField, summary, retrievedAt, details, verificationState }) {
  return normalizeEvidenceReference({
    sourceType, sourceSystem, sourceRecordId: String(sourceRecordId), sourceField,
    relatedCanonicalField, rawValueSummary: summary, relationship: "supports",
    extractionMethod: "import", verificationState, observedTimestamp: retrievedAt,
    provenanceDetails: details,
  });
}

export function analyzeOrangeCountyTaxSaleCandidate({ candidate, existingDeals = [] } = {}) {
  const ocpa = candidate?.enrichment;
  const tda = String(candidate?.externalTaxDeedNumber || "").trim();
  const parcel = String(candidate?.parcelNumber || "").trim();
  const address = String(ocpa?.address || "").trim();
  if (candidate?.source !== TAX_SOURCE || !tda || !parcel || ocpa?.status !== "matched" ||
      ocpa?.source !== OCPA_SOURCE || parcelKey(parcel) !== parcelKey(ocpa.parcelId) || !address) return null;

  const taxEvidence = countyEvidence({
    sourceSystem: TAX_SOURCE, sourceType: "tax-record", sourceRecordId: tda,
    sourceField: "USER_TDA_NUM", relatedCanonicalField: "property.taxSaleCase",
    summary: `Tax deed ${tda}; parcel ${parcel}`, retrievedAt: candidate.retrievedAt,
    verificationState: "unverified",
    details: { tdaNumber: tda, parcelNumber: parcel, sourceRecordId: candidate.sourceRecordId,
      countyStatus: candidate.deedStatus, saleDate: candidate.saleDate,
      retrievedAt: candidate.retrievedAt, sourceReference: TAX_REFERENCE },
  });
  const ocpaIdentity = countyEvidence({
    sourceSystem: OCPA_SOURCE, sourceType: "property-record", sourceRecordId: ocpa.sourceRecordId || ocpa.parcelId,
    sourceField: "SITUS", relatedCanonicalField: "property.address",
    summary: address, retrievedAt: ocpa.retrievedAt, verificationState: "verified",
    details: { parcelNumber: parcel, parcelId: ocpa.parcelId, address, city: ocpa.city, zip: ocpa.zip,
      recordOwner: ocpa.owner, propertyName: ocpa.propertyName, dorCode: ocpa.propertyUse?.dorCode,
      parcelCategory: ocpa.propertyUse?.parcelCategory, buildingDorCode: ocpa.propertyUse?.buildingDorCode,
      beds: ocpa.facts?.beds, baths: ocpa.facts?.baths, livingArea: ocpa.facts?.livingArea,
      stories: ocpa.facts?.stories, yearBuilt: ocpa.facts?.yearBuilt, acreage: ocpa.facts?.acreage },
  });
  const ocpaFacts = countyEvidence({
    sourceSystem: OCPA_SOURCE, sourceType: "property-record", sourceRecordId: ocpa.sourceRecordId || ocpa.parcelId,
    sourceField: "PARCEL", relatedCanonicalField: "property.recordFacts",
    summary: `OCPA record for parcel ${parcel}`, retrievedAt: ocpa.retrievedAt, verificationState: "verified",
    details: { parcelNumber: parcel, zoning: ocpa.facts?.zoning, pool: ocpa.facts?.pool,
      marketValue: ocpa.assessment?.marketValue, assessedValue: ocpa.assessment?.assessedValue,
      taxableValue: ocpa.assessment?.taxableValue, taxes: ocpa.assessment?.taxes,
      recentSaleDate: ocpa.recentSale?.date, recentSaleAdjustedValue: ocpa.recentSale?.adjustedValue,
      recentSaleQualificationCode: ocpa.recentSale?.qualificationCode,
      retrievedAt: ocpa.retrievedAt, sourceReference: OCPA_REFERENCE },
  });
  const lead = {
    countyResearch: true, tdaNumber: tda, parcelNumber: parcel,
    sellerName: "", phone: "", email: "", propertyAddress: address,
    city: ocpa.city || "", state: "FL", zip: ocpa.zip || "",
    leadSource: TAX_SOURCE, market: "Orange County, FL", askingPrice: null, notes: "",
    stage: "New Lead", researchEvidence: [taxEvidence, ocpaIdentity, ocpaFacts],
  };
  return buildImportAnalysis([lead], existingDeals);
}

function summarizeWarnings(leads = []) {
  return [
    ...new Set(
      leads.flatMap((lead) => [
        ...(lead.warnings || []),
        ...(lead.duplicateReasons || []),
      ])
    ),
  ];
}

function buildImportAnalysis(leads = [], existingDeals = []) {
  const validatedLeads = validateLeads(leads);
  const parsedLeads = detectDuplicateLeads({
    leads: validatedLeads,
    existingDeals,
  });
  const validLeads = parsedLeads.filter(
    (lead) => lead.valid && !lead.duplicate
  );
  const invalidLeads = parsedLeads.filter((lead) => !lead.valid);
  const duplicateLeads = parsedLeads.filter((lead) => lead.duplicate);
  const warnings = summarizeWarnings(parsedLeads);

  return {
    parsedLeads,
    validLeads,
    invalidLeads,
    duplicateLeads,
    warnings,
    previewPayloads: parsedLeads.map(toDealPreviewPayload),
    recommendedNextAction:
      parsedLeads.length === 0
        ? "Add a manual lead or upload a CSV to preview intake."
        : "Review warnings and duplicates, then confirm the accepted records.",
    summary:
      parsedLeads.length === 0
        ? "No leads parsed yet."
        : `${parsedLeads.length} leads parsed: ${validLeads.length} clean, ${invalidLeads.length} invalid, ${duplicateLeads.length} possible duplicates.`,
    generatedAt: new Date().toISOString(),
  };
}

export function analyzeManualLead({ lead = {}, existingDeals = [], defaults = {} } = {}) {
  const normalized = normalizeLead(lead, {
    fallbackSource: defaults.leadSource,
    fallbackMarket: defaults.market,
  });

  return buildImportAnalysis([normalized], existingDeals);
}

export function analyzeLeadRows({
  rows = [],
  existingDeals = [],
  defaults = {},
} = {}) {
  const normalizedRows = rows.map((row) =>
    normalizeLead(row, {
      fallbackSource: defaults.leadSource,
      fallbackMarket: defaults.market,
    })
  );

  return buildImportAnalysis(normalizedRows, existingDeals);
}

export function parseCsvLeadText({
  csvText = "",
  existingDeals = [],
  defaults = {},
} = {}) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors?.length) {
    return {
      ...buildImportAnalysis([], existingDeals),
      warnings: result.errors.map((error) => error.message),
      recommendedNextAction: "Fix CSV formatting issues and upload again.",
      summary: "CSV could not be parsed cleanly.",
    };
  }

  return analyzeLeadRows({
    rows: result.data || [],
    existingDeals,
    defaults,
  });
}

export async function confirmLeadImport(analysis = {}) {
  const acceptedLeads = Array.isArray(analysis.validLeads) ? analysis.validLeads : [];
  if (acceptedLeads.length === 0) {
    return {
      success: false,
      error: { message: "No validated, non-duplicate leads are available to import." },
    };
  }

  const { persistImportedDeals } = await import("../repositories");
  const result = await persistImportedDeals(
    acceptedLeads.map((lead) => ({
      rowNumber: lead.rowNumber,
      payload: toDealImportPayload(lead),
    }))
  );

  if (!result.success) return result;

  const { importedCount, duplicateCount, failedCount } = result.data;
  return {
    ...result,
    data: {
      ...result.data,
      previewCount: analysis.parsedLeads?.length || 0,
      rejectedCount: Math.max(
        0,
        (analysis.parsedLeads?.length || 0) - acceptedLeads.length
      ),
      message: `${importedCount} imported, ${duplicateCount} duplicate retries skipped, ${failedCount} failed.`,
      confirmedAt: new Date().toISOString(),
    },
  };
}
