import { useMemo, useState } from "react";
import {
  FOLLOW_UP_CADENCE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  OFFER_FORMULA_OPTIONS,
  PIPELINE_STAGE_OPTIONS,
  analyzeSettingsFoundation,
  buildInitialOrganizationSettings,
  buildInitialPreferences,
} from "../services/settings";

const fieldStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  width: "100%",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

function Field({ label, children }) {
  return (
    <label>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

export default function OrganizationSettingsPanel() {
  const [organization, setOrganization] = useState(() =>
    buildInitialOrganizationSettings()
  );
  const [preferences, setPreferences] = useState(() => buildInitialPreferences());
  const [leadSources, setLeadSources] = useState(
    () => buildInitialPreferences().leadSources
  );

  const analysis = useMemo(
    () =>
      analyzeSettingsFoundation({
        organization,
        preferences,
        leadSources,
      }),
    [organization, preferences, leadSources]
  );

  function updateOrganization(field, value) {
    setOrganization((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePreference(field, value) {
    setPreferences((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleLeadSource(source) {
    setLeadSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source]
    );
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            Settings / Organization
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            SaaS Settings Foundation
          </strong>
        </div>

        <span
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 999,
            color: "#1d4ed8",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Settings foundation - not all settings are enforced yet.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Active Markets"
          value={analysis.marketSettings.activeMarkets.length}
        />
        <MetricCard
          label="Lead Sources"
          value={
            Object.values(analysis.leadSourceSettings).filter(Boolean).length
          }
        />
        <MetricCard
          label="Default Stage"
          value={analysis.systemPreferences.defaultPipelineStage}
        />
        <MetricCard
          label="AI Assistance"
          value={analysis.systemPreferences.aiAssistanceEnabled ? "Enabled" : "Disabled"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Organization Name">
          <input
            value={organization.organizationName}
            onChange={(event) =>
              updateOrganization("organizationName", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Business Phone">
          <input
            value={organization.businessPhone}
            onChange={(event) =>
              updateOrganization("businessPhone", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Business Email">
          <input
            type="email"
            value={organization.businessEmail}
            onChange={(event) =>
              updateOrganization("businessEmail", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Website">
          <input
            value={organization.website}
            onChange={(event) => updateOrganization("website", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Default Market">
          <input
            value={organization.defaultMarket}
            onChange={(event) =>
              updateOrganization("defaultMarket", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Active Markets">
          <input
            value={organization.activeMarkets}
            onChange={(event) =>
              updateOrganization("activeMarkets", event.target.value)
            }
            placeholder="Phoenix, Tucson, Dallas"
            style={fieldStyle}
          />
        </Field>
        <Field label="Default Acquisitions Rep">
          <input
            value={organization.defaultAcquisitionsRep}
            onChange={(event) =>
              updateOrganization("defaultAcquisitionsRep", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Default Dispositions Rep">
          <input
            value={organization.defaultDispositionsRep}
            onChange={(event) =>
              updateOrganization("defaultDispositionsRep", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Default Title Company">
          <input
            value={organization.defaultTitleCompany}
            onChange={(event) =>
              updateOrganization("defaultTitleCompany", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Default Closing Timeline">
          <input
            value={organization.defaultClosingTimeline}
            onChange={(event) =>
              updateOrganization("defaultClosingTimeline", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
      </div>

      <Field label="Organization Notes">
        <textarea
          value={organization.notes}
          onChange={(event) => updateOrganization("notes", event.target.value)}
          rows={3}
          style={{ ...fieldStyle, resize: "vertical", marginBottom: 12 }}
        />
      </Field>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <strong>Lead Source Settings</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {LEAD_SOURCE_OPTIONS.map((source) => {
            const active = leadSources.includes(source);

            return (
              <button
                type="button"
                key={source}
                onClick={() => toggleLeadSource(source)}
                style={{
                  border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
                  background: active ? "#0f172a" : "#ffffff",
                  borderRadius: 999,
                  color: active ? "#ffffff" : "#334155",
                  cursor: "pointer",
                  fontWeight: 800,
                  padding: "7px 10px",
                }}
              >
                {source}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Default Follow-Up Cadence">
          <select
            value={preferences.defaultFollowUpCadence}
            onChange={(event) =>
              updatePreference("defaultFollowUpCadence", event.target.value)
            }
            style={fieldStyle}
          >
            {FOLLOW_UP_CADENCE_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Default Offer Formula">
          <select
            value={preferences.defaultOfferFormula}
            onChange={(event) =>
              updatePreference("defaultOfferFormula", event.target.value)
            }
            style={fieldStyle}
          >
            {OFFER_FORMULA_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Assignment Fee Target">
          <input
            type="number"
            value={preferences.defaultAssignmentFeeTarget}
            onChange={(event) =>
              updatePreference("defaultAssignmentFeeTarget", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Repair Estimate Buffer %">
          <input
            type="number"
            value={preferences.defaultRepairEstimateBuffer}
            onChange={(event) =>
              updatePreference("defaultRepairEstimateBuffer", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="New Lead Stage">
          <select
            value={preferences.defaultPipelineStage}
            onChange={(event) =>
              updatePreference("defaultPipelineStage", event.target.value)
            }
            style={fieldStyle}
          >
            {PIPELINE_STAGE_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Default Timezone">
          <input
            value={preferences.defaultTimezone}
            onChange={(event) =>
              updatePreference("defaultTimezone", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="AI Assistance">
          <select
            value={preferences.aiAssistanceEnabled ? "enabled" : "disabled"}
            onChange={(event) =>
              updatePreference(
                "aiAssistanceEnabled",
                event.target.value === "enabled"
              )
            }
            style={fieldStyle}
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Missing Data"
          items={analysis.missingData}
          emptyText="No missing settings identified."
        />
        <DetailList
          title="Risks"
          items={analysis.risks}
          emptyText="No settings risks identified."
        />
      </div>

      <div style={cardStyle}>
        <strong>Recommended Next Action</strong>
        <p style={{ color: "#334155", marginBottom: 6 }}>
          {analysis.recommendedNextAction}
        </p>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {analysis.summary} No billing, org switching, or enforcement has been enabled.
        </div>
      </div>
    </section>
  );
}
