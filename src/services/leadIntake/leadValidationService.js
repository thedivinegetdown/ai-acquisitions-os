import {
  hasText,
  isOptionalEmail,
  isOptionalPhone,
} from "../../utils/validation";

export function validateLead(lead = {}) {
  const warnings = [];

  if (!hasText(lead.sellerName)) warnings.push("missing seller name");
  if (!hasText(lead.phone) && !hasText(lead.email)) warnings.push("missing phone/email");
  if (!isOptionalPhone(lead.phone)) warnings.push("invalid phone");
  if (!isOptionalEmail(lead.email)) warnings.push("invalid email");
  if (!hasText(lead.propertyAddress)) warnings.push("missing property address");
  if (!hasText(lead.leadSource)) warnings.push("missing lead source");
  if (!hasText(lead.market)) warnings.push("missing market");

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export function validateLeads(leads = []) {
  return leads.map((lead, index) => {
    const validation = validateLead(lead);

    return {
      ...lead,
      rowNumber: index + 1,
      valid: validation.valid,
      warnings: validation.warnings,
    };
  });
}
