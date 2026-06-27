import Papa from "papaparse";
import { detectDuplicateLeads } from "./duplicateLeadService";
import { normalizeLead, toDealPreviewPayload } from "./leadNormalizationService";
import { validateLeads } from "./leadValidationService";

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
        : "Review warnings and duplicates before enabling any future database import.",
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

export function confirmPreviewOnlyImport(analysis = {}) {
  return {
    success: true,
    data: {
      imported: false,
      previewCount: analysis.parsedLeads?.length || 0,
      message:
        "Lead intake foundation is preview-only. No records were inserted or changed.",
      confirmedAt: new Date().toISOString(),
    },
  };
}
