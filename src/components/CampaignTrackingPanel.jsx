import { useMemo, useState } from "react";
import {
  CAMPAIGN_CHANNELS,
  analyzeCampaignPerformance,
  buildDefaultCampaign,
} from "../services/campaigns";
import { formatNonNegativeUsd } from "../utils/currency";

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

function Metric({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
        {label}
      </div>
      <strong style={{ color: "#0f172a", fontSize: 20 }}>{value}</strong>
    </div>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ color: "#64748b", marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ color: "#334155", marginBottom: 0, paddingLeft: 18 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatMetricMoney(value) {
  return value === null || value === undefined
    ? "Insufficient data"
    : formatNonNegativeUsd(value);
}

function formatPercent(value) {
  return value === null || value === undefined
    ? "Insufficient data"
    : `${value}%`;
}

export default function CampaignTrackingPanel({ deals = [] }) {
  const [campaigns, setCampaigns] = useState(() => [
    {
      ...buildDefaultCampaign(),
      campaignName: "Direct Mail Test Campaign",
      leadSource: "Direct mail",
      market: "Primary market",
      channel: "Direct mail",
    },
  ]);
  const [activeCampaignId, setActiveCampaignId] = useState(campaigns[0]?.id);
  const activeCampaign =
    campaigns.find((campaign) => campaign.id === activeCampaignId) || campaigns[0];
  const analysis = useMemo(
    () => analyzeCampaignPerformance({ campaigns, deals }),
    [campaigns, deals]
  );
  const activeAnalysis =
    analysis.campaigns.find((campaign) => campaign.id === activeCampaign?.id) ||
    analysis.campaigns[0];

  function updateCampaign(field, value) {
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === activeCampaign.id
          ? {
              ...campaign,
              [field]: value,
            }
          : campaign
      )
    );
  }

  function addCampaign() {
    const next = buildDefaultCampaign();
    setCampaigns((current) => [...current, next]);
    setActiveCampaignId(next.id);
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        marginBottom: 24,
        padding: 18,
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Campaign / Lead Source
          </div>
          <h2 style={{ color: "#0f172a", margin: "4px 0 0" }}>
            Campaign Tracking
          </h2>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Campaign tracking foundation - manual/internal attribution only.
          </p>
        </div>
        <button
          type="button"
          onClick={addCampaign}
          style={{
            background: "#0f172a",
            border: "1px solid #0f172a",
            borderRadius: 8,
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 800,
            padding: "10px 14px",
          }}
        >
          Add Campaign
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Metric label="Campaigns" value={analysis.campaigns.length} />
        <Metric
          label="Attribution Coverage"
          value={`${analysis.attributionSummary.attributionCoverage}%`}
        />
        <Metric
          label="Best Source"
          value={analysis.performanceMetrics.bestPerformingSource}
        />
        <Metric
          label="Underperforming"
          value={analysis.performanceMetrics.underperformingSource}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "minmax(180px, 0.8fr) minmax(260px, 2fr)",
          marginBottom: 12,
        }}
      >
        <div style={{ ...cardStyle, display: "grid", gap: 8 }}>
          <strong>Campaigns</strong>
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => setActiveCampaignId(campaign.id)}
              style={{
                background:
                  campaign.id === activeCampaign?.id ? "#0f172a" : "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                color: campaign.id === activeCampaign?.id ? "#ffffff" : "#334155",
                cursor: "pointer",
                fontWeight: 800,
                padding: "9px 10px",
                textAlign: "left",
              }}
            >
              {campaign.campaignName || "Untitled campaign"}
            </button>
          ))}
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              marginBottom: 10,
            }}
          >
            <Field label="Campaign Name">
              <input
                value={activeCampaign.campaignName}
                onChange={(event) => updateCampaign("campaignName", event.target.value)}
                style={fieldStyle}
              />
            </Field>
            <Field label="Lead Source">
              <input
                value={activeCampaign.leadSource}
                onChange={(event) => updateCampaign("leadSource", event.target.value)}
                style={fieldStyle}
              />
            </Field>
            <Field label="Market">
              <input
                value={activeCampaign.market}
                onChange={(event) => updateCampaign("market", event.target.value)}
                style={fieldStyle}
              />
            </Field>
            <Field label="Channel">
              <select
                value={activeCampaign.channel}
                onChange={(event) => updateCampaign("channel", event.target.value)}
                style={fieldStyle}
              >
                {CAMPAIGN_CHANNELS.map((channel) => (
                  <option key={channel}>{channel}</option>
                ))}
              </select>
            </Field>
            <Field label="Start Date">
              <input
                type="date"
                value={activeCampaign.startDate}
                onChange={(event) => updateCampaign("startDate", event.target.value)}
                style={fieldStyle}
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                value={activeCampaign.endDate}
                onChange={(event) => updateCampaign("endDate", event.target.value)}
                style={fieldStyle}
              />
            </Field>
            {[
              ["budget", "Budget"],
              ["leadsGenerated", "Leads Generated"],
              ["qualifiedLeads", "Qualified Leads"],
              ["offersMade", "Offers Made"],
              ["contractsSigned", "Contracts Signed"],
              ["dealsClosed", "Deals Closed"],
              ["estimatedRevenue", "Estimated Revenue"],
            ].map(([field, label]) => (
              <Field key={field} label={label}>
                <input
                  type="number"
                  value={activeCampaign[field]}
                  onChange={(event) => updateCampaign(field, event.target.value)}
                  style={fieldStyle}
                />
              </Field>
            ))}
          </div>
          <Field label="Notes">
            <textarea
              value={activeCampaign.notes}
              onChange={(event) => updateCampaign("notes", event.target.value)}
              rows={3}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
          </Field>
        </div>
      </div>

      {activeAnalysis && (
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            marginBottom: 12,
          }}
        >
          <Metric
            label="Cost Per Lead"
            value={formatMetricMoney(activeAnalysis.metrics.costPerLead)}
          />
          <Metric
            label="Cost / Qualified"
            value={formatMetricMoney(activeAnalysis.metrics.costPerQualifiedLead)}
          />
          <Metric
            label="Offer Rate"
            value={formatPercent(activeAnalysis.metrics.offerRate)}
          />
          <Metric
            label="Contract Rate"
            value={formatPercent(activeAnalysis.metrics.contractRate)}
          />
          <Metric
            label="Close Rate"
            value={formatPercent(activeAnalysis.metrics.closeRate)}
          />
          <Metric
            label="Estimated ROI"
            value={formatPercent(activeAnalysis.metrics.estimatedRoi)}
          />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <DetailList
          title="Risks"
          items={analysis.risks}
          emptyText="No campaign risks detected."
        />
        <DetailList
          title="Missing Data"
          items={analysis.missingData}
          emptyText="No missing campaign data."
        />
        <DetailList
          title="Recommended Next Action"
          items={[analysis.recommendedNextAction]}
          emptyText="No next action."
        />
      </div>

      <div style={{ ...cardStyle, color: "#334155", marginTop: 12 }}>
        <strong>Summary:</strong> {analysis.summary} Attribution is manual and
        local for now; no paid ad platforms are connected.
      </div>
    </section>
  );
}
