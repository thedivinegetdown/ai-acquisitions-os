import { useState } from "react";
import { Button, TextArea } from "../design-system";
import { formatUsd } from "../utils/currency";
import { getDealAlias, getDealAliasText } from "../utils/dealFields";

export default function BuyerBlast({ deal, strategyResult = null }) {
  const [status, setStatus] = useState("");
  const reviewPaths = (strategyResult?.exitCandidates || [])
    .filter((candidate) => ["candidate", "reviewable"].includes(candidate.state))
    .map((candidate) => candidate.label);
  const text = `New residential opportunity

Property: ${getDealAliasText(deal, "address") || "Not available"}
Asking: ${formatUsd(getDealAlias(deal, "askingPrice"), "Not available")}
ARV estimate: ${formatUsd(getDealAlias(deal, "arv"), "Not evaluated")}
Repair estimate: ${formatUsd(getDealAlias(deal, "repairs"), "Not evaluated")}
Review paths: ${reviewPaths.join(", ") || "Manual review required"}

Reply if interested.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Buyer campaign draft copied.");
    } catch {
      setStatus("Buyer campaign draft could not be copied.");
    }
  }

  return (
    <section aria-labelledby="buyer-blast-title" className="buyer-blast-review">
      <h3 id="buyer-blast-title">Buyer campaign preparation</h3>
      <TextArea label="Review-only buyer campaign draft" readOnly rows="9" value={text} />
      <Button onClick={copy} variant="secondary">Copy Draft</Button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </section>
  );
}
