import { useMemo, useState } from "react";

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

function buildScript(deal) {
const property = deal?.property_address || "the property";
const sellerName = deal?.owner_name || "there";
const arv = getNumber(deal, ["arv", "after_repair_value", "afterRepairValue"]);
const repairs = getNumber(deal, [
"repairs",
"estimated_repairs",
"repairs_needed",
"repair_estimate",
]);
const askingPrice = getNumber(deal, ["price", "asking_price", "askingPrice"]);
const motivation = getNumber(deal, ["motivation_score", "motivation"]);
const timeline = getText(deal, [
"seller_timeline",
"timeline",
"timeline_to_sell",
]);
const maxOffer = arv ? arv * 0.7 - (repairs ?? 0) : null;
const repairsMissing = !repairs;
const timelineMissing = !timeline;
const askingHigh = askingPrice && maxOffer && askingPrice > maxOffer * 1.1;
const highMotivation = motivation && motivation >= 7;
const readyToOffer = arv && repairs && askingPrice && motivation;

let openingLine =
  `Hi ${sellerName}, I wanted to follow up on ${property} and better understand what outcome would make sense for you.`;

if (highMotivation) {
  openingLine =
    `Hi ${sellerName}, I know timing may matter here, so I want to understand your situation clearly and move at a pace that works for you.`;
}

if (readyToOffer) {
  openingLine =
    `Hi ${sellerName}, based on what we know so far, I think we may be close to discussing a realistic first offer range.`;
}

const discoveryQuestions = [];

if (repairsMissing) {
  discoveryQuestions.push(
    "Can you walk me through the current condition and any repairs you already know about?"
  );
}

if (timelineMissing) {
  discoveryQuestions.push(
    "If everything lined up, what would be your ideal closing timeline?"
  );
}

discoveryQuestions.push(
  "What would make this a smooth and worthwhile sale for you?"
);

if (!askingPrice) {
  discoveryQuestions.push(
    "Have you thought about a number that would make sense for you?"
  );
}

const objectionPrompts = [];

if (askingHigh) {
  objectionPrompts.push(
    "I understand wanting to get the strongest number possible. My job is to be transparent about where cash buyers usually need to land after repairs, holding costs, and resale risk."
  );
}

if (repairsMissing) {
  objectionPrompts.push(
    "Before I talk numbers too firmly, I want to avoid guessing wrong on repairs and giving you a number that later changes."
  );
}

if (highMotivation) {
  objectionPrompts.push(
    "If speed and certainty are important, we can focus on a clean path with fewer moving parts instead of chasing the absolute highest retail number."
  );
}

if (objectionPrompts.length === 0) {
  objectionPrompts.push(
    "If my number is not where you hoped, I can explain exactly how I got there and what assumptions would need to change."
  );
}

let suggestedClose =
  "Would it be okay if I confirm a few details, run the numbers, and come back with a realistic range?";

if (readyToOffer) {
  suggestedClose =
    "If this range is close to what you had in mind, the next step would be to walk through a simple written offer together.";
}

return {
openingLine,
discoveryQuestions,
objectionPrompts,
suggestedClose,
};
}

function scriptToText(script) {
return [
"Opening line:",
script.openingLine,
"",
"Discovery questions:",
...script.discoveryQuestions.map((item) => `- ${item}`),
"",
"Objection-handling prompts:",
...script.objectionPrompts.map((item) => `- ${item}`),
"",
"Suggested close:",
script.suggestedClose,
].join("\n");
}

function Section({ title, children }) {
return (
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 10,
padding: 12,
}}
>
<div
style={{
color: "#64748b",
fontSize: 12,
fontWeight: 700,
marginBottom: 6,
textTransform: "uppercase",
}}
>
{title}
</div>
{children}
</div>
);
}

export default function NegotiationScript({ deal }) {
const [copyStatus, setCopyStatus] = useState("");
const script = useMemo(() => buildScript(deal), [deal]);

async function copyScript() {
setCopyStatus("");

try {
  await navigator.clipboard.writeText(scriptToText(script));
  setCopyStatus("Copied");
} catch (error) {
  console.error("[NegotiationScript] Copy failed:", error);
  setCopyStatus("Copy failed");
}
}

return (
<div
style={{
background: "#f8fafc",
border: "1px solid #dbe3ef",
borderRadius: 14,
padding: 18,
marginBottom: 18,
boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
flexWrap: "wrap",
marginBottom: 14,
}}
>
<div
  style={{
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  }}
>
  Negotiation Script
</div>

<button
  type="button"
  onClick={copyScript}
  style={{
  padding: "8px 12px",
  border: "1px solid #0f172a",
  borderRadius: 8,
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  }}
>
  Copy Script
</button>
</div>

<div
style={{
display: "grid",
gap: 10,
}}
>
<Section title="Opening line">
  <p style={{ margin: 0 }}>{script.openingLine}</p>
</Section>

<Section title="Discovery questions">
  <ul style={{ margin: 0, paddingLeft: 20 }}>
    {script.discoveryQuestions.map((question) => (
      <li key={question}>{question}</li>
    ))}
  </ul>
</Section>

<Section title="Objection-handling prompts">
  <ul style={{ margin: 0, paddingLeft: 20 }}>
    {script.objectionPrompts.map((prompt) => (
      <li key={prompt}>{prompt}</li>
    ))}
  </ul>
</Section>

<Section title="Suggested close">
  <p style={{ margin: 0 }}>{script.suggestedClose}</p>
</Section>
</div>

{copyStatus && (
  <p
    style={{
    color: copyStatus === "Copied" ? "#166534" : "#b91c1c",
    marginBottom: 0,
    }}
  >
    {copyStatus}
  </p>
)}
</div>
);
}
