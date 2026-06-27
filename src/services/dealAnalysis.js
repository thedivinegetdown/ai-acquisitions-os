function getNumber(deal, keys) {
for (const key of keys) {
  const value = deal?.[key];
  const numberValue = Number(value);

  if (value !== null && value !== undefined && value !== "" && numberValue > 0) {
    return numberValue;
  }
}

return null;
}

function getText(deal, keys) {
for (const key of keys) {
  const value = deal?.[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
}

return "";
}

function getGrade(score) {
if (score >= 90) return "A";
if (score >= 80) return "B";
if (score >= 65) return "C";
if (score >= 50) return "D";

return "F";
}

function getIndicator(score) {
if (score >= 85) return "Excellent";
if (score >= 70) return "Good";
if (score >= 50) return "Fair";

return "Poor";
}

function clampScore(score) {
return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeDeal(deal) {
const motivation = getNumber(deal, ["motivation_score", "motivation"]);
const askingPrice = getNumber(deal, ["price", "asking_price", "askingPrice"]);
const arv = getNumber(deal, ["arv", "after_repair_value", "afterRepairValue"]);
const repairs = getNumber(deal, [
"repairs",
"estimated_repairs",
"repairs_needed",
"repair_estimate",
]);
const mortgageBalance = getNumber(deal, [
"mortgage_balance",
"mortgage",
"loan_balance",
]);
const timeline = getText(deal, [
"seller_timeline",
"timeline",
"timeline_to_sell",
]);
const occupancy = getText(deal, ["occupancy_status", "occupancy"]);
const condition = getText(deal, ["property_condition", "condition"]);
const leadScore = getNumber(deal, ["lead_score"]);
const maxOffer = arv ? arv * 0.7 - (repairs ?? 0) : null;
const readinessItems = [
askingPrice,
condition,
motivation,
timeline,
mortgageBalance,
repairs,
occupancy,
arv,
];
const offerReadinessScore = Math.round(
  (readinessItems.filter(Boolean).length / readinessItems.length) * 100
);
let score = 35;
const strengths = [];
const weaknesses = [];
const risks = [];
const opportunities = [];
const missingInformation = [];

if (motivation && motivation >= 8) {
  score += 14;
  strengths.push("Seller motivation appears high.");
} else if (motivation && motivation >= 5) {
  score += 8;
  strengths.push("Seller motivation is workable.");
} else if (!motivation) {
  missingInformation.push("Seller motivation");
  weaknesses.push("Motivation level is not confirmed.");
}

if (leadScore && leadScore >= 8) {
  score += 10;
  strengths.push("Lead score indicates a strong opportunity.");
} else if (leadScore && leadScore >= 5) {
  score += 5;
}

if (arv) {
  score += 12;
  strengths.push("ARV/comps data is available.");
} else {
  missingInformation.push("ARV / comps");
  risks.push("Offer confidence is low until ARV or comps are available.");
}

if (repairs) {
  score += 10;
  strengths.push("Repair estimate is available.");
} else {
  missingInformation.push("Repairs");
  weaknesses.push("Repair estimates are missing.");
}

if (askingPrice && maxOffer) {
  if (askingPrice <= maxOffer) {
    score += 12;
    opportunities.push("Asking price appears compatible with the preliminary max offer.");
  } else if (askingPrice <= maxOffer * 1.15) {
    score += 4;
    risks.push("Asking price is slightly above the preliminary acquisition range.");
  } else {
    score -= 8;
    risks.push("Seller expectations may be high compared with the acquisition range.");
  }
} else if (!askingPrice) {
  missingInformation.push("Asking price");
}

if (timeline) {
  score += 6;
  strengths.push("Seller timeline is documented.");
} else {
  missingInformation.push("Seller timeline");
  weaknesses.push("Seller timeline is unclear.");
}

if (occupancy) {
  score += 5;
  if (occupancy.toLowerCase().includes("vacant")) {
    opportunities.push("Vacant occupancy may simplify closing logistics.");
  }
} else {
  missingInformation.push("Occupancy status");
}

if (condition) {
  score += 5;
} else {
  missingInformation.push("Property condition");
}

if (mortgageBalance) {
  score += 3;
  if (maxOffer && mortgageBalance > maxOffer) {
    risks.push("Mortgage balance may limit seller flexibility.");
  }
} else {
  missingInformation.push("Mortgage balance");
}

if (offerReadinessScore >= 75) {
  score += 10;
  strengths.push("Offer readiness is strong enough for deeper analysis.");
} else if (offerReadinessScore < 40) {
  score -= 6;
  weaknesses.push("Offer readiness is still early.");
}

const finalScore = clampScore(score);
const indicator = getIndicator(finalScore);
const summaryParts = [];

if (motivation && motivation >= 7) {
  summaryParts.push("The seller appears motivated");
} else {
  summaryParts.push("The seller motivation level is still developing");
}

if (maxOffer && askingPrice && askingPrice <= maxOffer) {
  summaryParts.push("and the estimated acquisition range is reasonable");
} else if (maxOffer && askingPrice) {
  summaryParts.push("but seller expectations may be above the current acquisition range");
} else {
  summaryParts.push("and offer confidence depends on more pricing data");
}

if (missingInformation.length > 0) {
  summaryParts.push(
    `However, ${missingInformation.slice(0, 3).join(", ")} ${
      missingInformation.length > 3 ? "and other details are" : "is"
    } missing`
  );
  summaryParts.push(
    "Gathering this information should significantly improve confidence before preparing an offer."
  );
} else {
  summaryParts.push(
    "The core deal inputs are available, so this lead is ready for deeper offer analysis."
  );
}

return {
score: finalScore,
grade: getGrade(finalScore),
indicator,
strengths: strengths.length ? strengths : ["No major strengths detected yet."],
weaknesses: weaknesses.length ? weaknesses : ["No major weaknesses detected yet."],
risks: risks.length ? risks : ["No major risks detected yet."],
opportunities: opportunities.length
  ? opportunities
  : ["More seller discovery may reveal additional opportunities."],
missingInformation: [...new Set(missingInformation)],
summary: `${summaryParts.join(". ")}.`,
offerReadinessScore,
offerConfidence:
  arv && repairs ? "High" : arv ? "Medium" : "Low",
};
}
