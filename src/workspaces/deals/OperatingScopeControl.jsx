import { useEffect, useState } from "react";
import { Button, Card, SectionHeader, Select } from "../../design-system";
import { requireActiveOrganizationContext } from "../../services/organizations";
import { saveDealOperatingScope } from "../../services/repositories/dealRepository";
import { getOperatingScopePolicy, OPERATING_SCOPES, RESEARCH_ONLY_NOTICE } from "../../services/deals/operatingScopePolicy";

// Owner operating intent has its own save boundary, separate from classification.
export default function OperatingScopeControl({ deal, onSaved }) {
  const policy = getOperatingScopePolicy(deal);
  const [selection, setSelection] = useState(policy.scope || "");
  const [owner, setOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let current = true;
    setOwner(false);
    if (deal.organization_id) {
      requireActiveOrganizationContext().then((context) => {
        if (current) setOwner(context.role === "owner" && context.organizationId === deal.organization_id);
      }).catch(() => { if (current) setOwner(false); });
    }
    return () => { current = false; };
  }, [deal.organization_id]);

  async function save() {
    if (!owner || !selection || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const result = await saveDealOperatingScope(deal, selection);
      if (!result.success) { setStatus(result.error?.message || "Operating scope could not be saved."); return; }
      onSaved(result.data);
      setStatus("Operating scope saved.");
    } catch { setStatus("Operating scope could not be saved. Reload and try again."); }
    finally { setSaving(false); }
  }

  return <Card className="workspace__stack">
    <SectionHeader title="Operating scope" description="The owner sets the operating intent for this deal independently of stage, classification, and readiness." />
    <p>Research only: {RESEARCH_ONLY_NOTICE}</p>
    {!policy.supported && <p role="alert">{policy.explanation}</p>}
    <Select label="Operating scope" value={selection} disabled={saving || !owner} onChange={(event) => { setSelection(event.target.value); setStatus(""); }}>
      {!policy.supported && <option value="">Unsupported scope — review required</option>}
      <option value={OPERATING_SCOPES.ACTIVE_ACQUISITION}>Active acquisition</option>
      <option value={OPERATING_SCOPES.RESEARCH_ONLY}>Research only</option>
    </Select>
    <Button disabled={saving || !owner || !deal.updated_at || !selection || selection === policy.scope} onClick={save}>Save operating scope</Button>
    <p>Active acquisition retains existing workflows and approval requirements. Scope does not authorize an individual purchase or outreach action.</p>
    {!owner && <p>Only an organization owner can change operating scope.</p>}
    {status && <p role="status">{status}</p>}
  </Card>;
}
