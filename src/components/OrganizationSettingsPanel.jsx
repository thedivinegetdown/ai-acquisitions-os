import { useEffect, useState } from "react";
import {
  FOLLOW_UP_CADENCE_OPTIONS,
  OFFER_FORMULA_OPTIONS,
  PIPELINE_STAGE_OPTIONS,
} from "../services/settings";
import {
  loadOrganizationProviderPolicies,
  loadOrganizationSettings,
  saveOrganizationSettings,
} from "../services/repositories";

const initialSettings = {
  default_market: "",
  default_lead_source: "Direct mail",
  default_pipeline_stage: "New Lead",
  default_follow_up_cadence: "Every 2 days",
  default_offer_formula: "70% ARV minus repairs",
  default_assignment_fee_target: 15000,
  default_repair_estimate_buffer: 10,
  default_timezone: "America/New_York",
};

const fieldStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  width: "100%",
};

function Field({ label, children }) {
  return (
    <label>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

export default function OrganizationSettingsPanel() {
  const [settings, setSettings] = useState(initialSettings);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([loadOrganizationSettings(), loadOrganizationProviderPolicies()])
      .then(([settingsResult, providersResult]) => {
        if (!active) return;
        if (!settingsResult.success) throw new Error(settingsResult.error?.message);
        setSettings((current) => ({ ...current, ...settingsResult.data }));
        if (providersResult.success) setProviders(providersResult.data);
      })
      .catch((loadError) => active && setError(loadError?.message || "Could not load organization settings."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function update(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const result = await saveOrganizationSettings(settings);
    if (result.success) {
      setSettings((current) => ({ ...current, ...result.data }));
      setMessage("Operational defaults saved for this organization.");
    } else {
      setError(result.error?.message || "Could not save organization settings.");
    }
    setSaving(false);
  }

  const openAi = providers.find((provider) => provider.provider === "openai");

  return (
    <section style={{ background: "#f8fafc", border: "1px solid #dbe3ef", borderRadius: 14, padding: 18, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Settings / Organization</div>
          <h2 style={{ color: "#0f172a", margin: "4px 0 0" }}>Pilot operational defaults</h2>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>Persisted for this organization; provider activation remains assisted-admin only.</p>
        </div>
        <span style={{ background: openAi?.enabled ? "#ecfdf5" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 999, color: "#334155", fontSize: 13, fontWeight: 800, padding: "7px 12px", height: "fit-content" }}>
          OpenAI: {openAi?.enabled ? `enabled (${openAi.monthly_request_cap}/month)` : "disabled"}
        </span>
      </div>

      {loading ? <p>Loading organization settings…</p> : (
        <>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", marginBottom: 12 }}>
            <Field label="Default Market"><input value={settings.default_market} onChange={(event) => update("default_market", event.target.value)} style={fieldStyle} /></Field>
            <Field label="Default Lead Source"><input value={settings.default_lead_source} onChange={(event) => update("default_lead_source", event.target.value)} style={fieldStyle} /></Field>
            <Field label="New Lead Stage"><select value={settings.default_pipeline_stage} onChange={(event) => update("default_pipeline_stage", event.target.value)} style={fieldStyle}>{PIPELINE_STAGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Follow-Up Cadence"><select value={settings.default_follow_up_cadence} onChange={(event) => update("default_follow_up_cadence", event.target.value)} style={fieldStyle}>{FOLLOW_UP_CADENCE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Offer Formula"><select value={settings.default_offer_formula} onChange={(event) => update("default_offer_formula", event.target.value)} style={fieldStyle}>{OFFER_FORMULA_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Assignment Fee Target"><input min="0" type="number" value={settings.default_assignment_fee_target} onChange={(event) => update("default_assignment_fee_target", Number(event.target.value))} style={fieldStyle} /></Field>
            <Field label="Repair Buffer %"><input min="0" type="number" value={settings.default_repair_estimate_buffer} onChange={(event) => update("default_repair_estimate_buffer", Number(event.target.value))} style={fieldStyle} /></Field>
            <Field label="Default Timezone"><input value={settings.default_timezone} onChange={(event) => update("default_timezone", event.target.value)} style={fieldStyle} /></Field>
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={save} disabled={saving} style={{ background: "#0f172a", border: 0, borderRadius: 8, color: "white", cursor: saving ? "wait" : "pointer", fontWeight: 800, padding: "10px 14px" }}>
              {saving ? "Saving…" : "Save organization defaults"}
            </button>
            {message && <span style={{ color: "#15803d", fontWeight: 700 }}>{message}</span>}
            {error && <span role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</span>}
          </div>
        </>
      )}
    </section>
  );
}
