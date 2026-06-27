import { useEffect, useMemo, useState } from "react";
import {
  analyzePropertyIntelligence,
  buildInitialPropertyInputs,
  EXIT_STRATEGIES,
} from "../services/property";
import {
  getPropertyAddressFromDeal,
  lookupPropertyData,
} from "../services/propertyData";
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

function ValueLine({ label, value }) {
  return (
    <div style={{ color: "#334155", fontSize: 13 }}>
      <strong>{label}:</strong> {value || "Not available"}
    </div>
  );
}

export default function PropertyIntelligencePanel({ deal }) {
  const initialInputs = useMemo(() => buildInitialPropertyInputs(deal), [deal]);
  const initialAddress = useMemo(() => getPropertyAddressFromDeal(deal), [deal]);
  const [inputs, setInputs] = useState(initialInputs);
  const [propertyLookup, setPropertyLookup] = useState({
    address: initialAddress,
    providerId: "manual",
    loading: false,
    error: "",
    result: null,
  });

  useEffect(() => {
    setInputs(initialInputs);
    setPropertyLookup((current) => ({
      ...current,
      address: initialAddress,
      error: "",
      result: null,
    }));
  }, [initialAddress, initialInputs]);

  const analysis = useMemo(
    () => analyzePropertyIntelligence({ deal, inputs }),
    [deal, inputs]
  );

  function updateInput(field, value) {
    setInputs((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handlePropertyLookup() {
    setPropertyLookup((current) => ({
      ...current,
      loading: true,
      error: "",
      result: null,
    }));

    const result = await lookupPropertyData({
      address: propertyLookup.address,
      deal,
      providerId: propertyLookup.providerId,
    });

    if (!result.success) {
      setPropertyLookup((current) => ({
        ...current,
        loading: false,
        error:
          result.error?.message ||
          "Property data lookup is not available right now.",
        result: null,
      }));
      return;
    }

    setPropertyLookup((current) => ({
      ...current,
      loading: false,
      error: "",
      result: result.data,
    }));
  }

  function applyPropertyDataToInputs() {
    const valuation = propertyLookup.result?.valuation;
    if (!valuation) return;

    setInputs((current) => ({
      ...current,
      estimatedArv: valuation.arvEstimate || valuation.estimatedValue || current.estimatedArv,
      estimatedRent: valuation.rentEstimate || current.estimatedRent,
      notes: [
        current.notes,
        "Property data foundation values applied for internal review.",
      ]
        .filter(Boolean)
        .join("\n"),
    }));
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
            Comps + Property Intelligence
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Manual Property Analysis
          </strong>
        </div>

        <span
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 999,
            color: "#9a3412",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Preliminary/manual analysis only.
        </span>
      </div>

      <div
        style={{
          ...cardStyle,
          borderColor: "#bae6fd",
          background: "#f0f9ff",
          marginBottom: 12,
        }}
      >
        <strong>
          Property data integration foundation - live provider not connected yet.
        </strong>
        <p style={{ color: "#334155", marginBottom: 10 }}>
          Use manual or mock provider output to prepare for future ownership, tax,
          valuation, and comp integrations.
        </p>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "minmax(220px, 2fr) minmax(160px, 1fr) auto",
            alignItems: "end",
            marginBottom: 10,
          }}
        >
          <Field label="Address Search">
            <input
              value={propertyLookup.address}
              onChange={(event) =>
                setPropertyLookup((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder="Enter property address"
              style={fieldStyle}
            />
          </Field>
          <Field label="Provider">
            <select
              value={propertyLookup.providerId}
              onChange={(event) =>
                setPropertyLookup((current) => ({
                  ...current,
                  providerId: event.target.value,
                  result: null,
                  error: "",
                }))
              }
              style={fieldStyle}
            >
              <option value="manual">Manual</option>
              <option value="mock">Mock</option>
            </select>
          </Field>
          <button
            type="button"
            onClick={handlePropertyLookup}
            disabled={propertyLookup.loading}
            style={{
              background: "#0f172a",
              border: "1px solid #0f172a",
              borderRadius: 8,
              color: "#ffffff",
              cursor: propertyLookup.loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              padding: "10px 12px",
            }}
          >
            {propertyLookup.loading ? "Looking up..." : "Lookup"}
          </button>
        </div>

        {propertyLookup.error && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>
            {propertyLookup.error}
          </div>
        )}

        {propertyLookup.result ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            }}
          >
            <div style={cardStyle}>
              <strong>Normalized Address</strong>
              <ValueLine
                label="Address"
                value={propertyLookup.result.property?.normalizedAddress}
              />
              <ValueLine label="Confidence" value={propertyLookup.result.confidence} />
              <ValueLine label="Source" value={propertyLookup.result.source} />
            </div>
            <div style={cardStyle}>
              <strong>Owner Placeholder</strong>
              <ValueLine
                label="Owner"
                value={propertyLookup.result.owner?.ownerName}
              />
              <ValueLine
                label="Mailing"
                value={propertyLookup.result.owner?.mailingAddress}
              />
            </div>
            <div style={cardStyle}>
              <strong>Tax Placeholder</strong>
              <ValueLine
                label="Assessed"
                value={
                  propertyLookup.result.tax?.assessedValue
                    ? formatNonNegativeUsd(propertyLookup.result.tax.assessedValue)
                    : ""
                }
              />
              <ValueLine
                label="Annual Taxes"
                value={
                  propertyLookup.result.tax?.annualTaxes
                    ? formatNonNegativeUsd(propertyLookup.result.tax.annualTaxes)
                    : ""
                }
              />
            </div>
            <div style={cardStyle}>
              <strong>Valuation Placeholder</strong>
              <ValueLine
                label="Estimated Value"
                value={
                  propertyLookup.result.valuation?.estimatedValue
                    ? formatNonNegativeUsd(
                        propertyLookup.result.valuation.estimatedValue
                      )
                    : ""
                }
              />
              <ValueLine
                label="ARV"
                value={
                  propertyLookup.result.valuation?.arvEstimate
                    ? formatNonNegativeUsd(
                        propertyLookup.result.valuation.arvEstimate
                      )
                    : ""
                }
              />
              <ValueLine
                label="Rent"
                value={
                  propertyLookup.result.valuation?.rentEstimate
                    ? formatNonNegativeUsd(
                        propertyLookup.result.valuation.rentEstimate
                      )
                    : ""
                }
              />
            </div>
            <div style={cardStyle}>
              <strong>Comps Placeholder</strong>
              <ValueLine
                label="Comparable Sales"
                value={`${propertyLookup.result.comps.length}`}
              />
              <ValueLine
                label="Missing Data"
                value={propertyLookup.result.missingData.join(", ")}
              />
            </div>
            <div style={cardStyle}>
              <strong>Connect to Property Intelligence</strong>
              <p style={{ color: "#334155", marginBottom: 8 }}>
                Apply available valuation data to the manual ARV/rent fields for
                internal review.
              </p>
              <button
                type="button"
                onClick={applyPropertyDataToInputs}
                disabled={!propertyLookup.result.valuation}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  color: "#0f172a",
                  cursor: propertyLookup.result.valuation
                    ? "pointer"
                    : "not-allowed",
                  fontWeight: 800,
                  padding: "8px 10px",
                }}
              >
                Apply valuation
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            No provider data loaded yet. Manual property intelligence remains available below.
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Estimated ARV">
          <input
            type="number"
            value={inputs.estimatedArv}
            onChange={(event) => updateInput("estimatedArv", event.target.value)}
            style={fieldStyle}
          />
        </Field>

        <Field label="Estimated Repairs">
          <input
            type="number"
            value={inputs.estimatedRepairs}
            onChange={(event) =>
              updateInput("estimatedRepairs", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Estimated Rent">
          <input
            type="number"
            value={inputs.estimatedRent}
            onChange={(event) =>
              updateInput("estimatedRent", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Property Condition">
          <select
            value={inputs.propertyCondition}
            onChange={(event) =>
              updateInput("propertyCondition", event.target.value)
            }
            style={fieldStyle}
          >
            <option>Unknown</option>
            <option>Excellent</option>
            <option>Good</option>
            <option>Fair</option>
            <option>Poor</option>
          </select>
        </Field>

        <Field label="Occupancy Status">
          <select
            value={inputs.occupancyStatus}
            onChange={(event) =>
              updateInput("occupancyStatus", event.target.value)
            }
            style={fieldStyle}
          >
            <option>Unknown</option>
            <option>Vacant</option>
            <option>Owner occupied</option>
            <option>Tenant occupied</option>
          </select>
        </Field>

        <Field label="Neighborhood Quality">
          <select
            value={inputs.neighborhoodQuality}
            onChange={(event) =>
              updateInput("neighborhoodQuality", event.target.value)
            }
            style={fieldStyle}
          >
            <option>Unknown</option>
            <option>Strong</option>
            <option>Average</option>
            <option>Emerging</option>
            <option>Weak</option>
          </select>
        </Field>

        <Field label="Exit Strategy">
          <select
            value={inputs.exitStrategy}
            onChange={(event) => updateInput("exitStrategy", event.target.value)}
            style={fieldStyle}
          >
            <option>Review manually</option>
            {EXIT_STRATEGIES.map((strategy) => (
              <option key={strategy}>{strategy}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={inputs.notes}
          onChange={(event) => updateInput("notes", event.target.value)}
          rows="4"
          style={{
            ...fieldStyle,
            resize: "vertical",
            marginBottom: 12,
          }}
        />
      </Field>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Property Score"
          value={`${analysis.propertyScore}/100`}
        />
        <MetricCard label="ARV Confidence" value={analysis.arvConfidence} />
        <MetricCard label="Repair Risk" value={analysis.repairRisk} />
        <MetricCard label="Rent Potential" value={analysis.rentPotential} />
        <MetricCard
          label="Neighborhood"
          value={analysis.neighborhoodStrength}
        />
        <MetricCard
          label="Recommended Exit"
          value={analysis.recommendedExitStrategy}
        />
      </div>

      <div
        style={{
          ...cardStyle,
          color: "#334155",
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        <strong>Summary:</strong> {analysis.summary}
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
          title="Risks"
          items={analysis.risks}
          emptyText="No major property risks detected yet."
        />
        <DetailList
          title="Opportunities"
          items={analysis.opportunities}
          emptyText="No property opportunities detected yet."
        />
        <DetailList
          title="Missing Data"
          items={analysis.missingData}
          emptyText="No major missing property data."
        />
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        Suggested Exit Strategies
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {analysis.exitStrategyOptions.map((option) => (
          <div
            key={option.strategy}
            style={{
              ...cardStyle,
              border:
                option.strategy === analysis.recommendedExitStrategy
                  ? "2px solid #0f172a"
                  : cardStyle.border,
            }}
          >
            <strong>{option.strategy}</strong>
            <div
              style={{
                color: "#64748b",
                fontSize: 12,
                marginTop: 6,
              }}
            >
              Fit score: {option.score}/100
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          marginTop: 12,
        }}
      >
        ARV:{" "}
        {inputs.estimatedArv
          ? formatNonNegativeUsd(inputs.estimatedArv)
          : "Missing"}{" "}
        • Repairs:{" "}
        {inputs.estimatedRepairs
          ? formatNonNegativeUsd(inputs.estimatedRepairs)
          : "Missing"}{" "}
        • Rent:{" "}
        {inputs.estimatedRent
          ? formatNonNegativeUsd(inputs.estimatedRent)
          : "Missing"}
      </div>
    </div>
  );
}
