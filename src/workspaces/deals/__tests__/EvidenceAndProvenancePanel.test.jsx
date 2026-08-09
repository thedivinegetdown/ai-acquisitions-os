import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EvidenceAndProvenancePanel from "../EvidenceAndProvenancePanel";

function record(overrides = {}) {
  return {
    evidenceId: "evidence:asking",
    relatedCanonicalField: "deal.askingPrice",
    valueSummary: "$100,000",
    relationship: "supports",
    evidenceStatus: "limited",
    sourceKind: "compatibility",
    sourceType: "crm-current-state",
    sourceSystem: "Deal record",
    sourceRecordId: "deal-1",
    sourceField: "asking_price",
    verificationState: "unknown",
    freshnessState: "unknown",
    extractionMethod: "compatibility-adapter",
    limitationCodes: ["compatibility-only", "verification-unknown"],
    compatibility: true,
    parentEvidenceIds: [],
    derivedFromEvidenceIds: [],
    ...overrides,
  };
}

function props(overrides = {}) {
  return {
    registry: {
      evidenceRecords: [record()],
      evaluatedTimestamp: "2026-08-09T12:00:00.000Z",
      counts: { total: 1, supporting: 1, challenging: 0, contextual: 0, limited: 1 },
    },
    coverage: {
      limitationCodes: ["compatibility-only"],
      counts: { representedFields: 1, fieldsWithConflicts: 0 },
    },
    lineage: { outputs: [] },
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("EvidenceAndProvenancePanel", () => {
  it("does not render an irrelevant empty panel", () => {
    const { container } = render(<EvidenceAndProvenancePanel coverage={{ limitationCodes: [] }} registry={{ evidenceRecords: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows descriptive counts, provenance, limitations, and no reliability grade", () => {
    render(<EvidenceAndProvenancePanel {...props()} />);
    expect(screen.getByRole("heading", { name: "Evidence and Provenance" })).toBeInTheDocument();
    expect(screen.getByText("deal.askingPrice", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText(/Compatibility Only, Verification Unknown/i)).toBeInTheDocument();
    expect(screen.queryByText(/high reliability|medium reliability|low reliability|confidence percentage/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark verified|resolve conflict|edit provenance/i })).not.toBeInTheDocument();
  });

  it("groups by source kind and exposes bounded derived lineage", () => {
    render(<EvidenceAndProvenancePanel {...props({
      registry: { ...props().registry, evidenceRecords: [record({ derivedFromEvidenceIds: ["evidence:source"] })] },
      lineage: { outputs: [{ outputId: "offer-readiness", label: "Offer Readiness", derivedFromEvidenceIds: ["evidence:asking"] }] },
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "Source Kind" }));
    expect(screen.getByText("compatibility", { selector: "h3" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Derived From"));
    expect(screen.getByText("evidence:source")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Derived decision outputs"));
    expect(screen.getByText("Offer Readiness")).toBeInTheDocument();
  });

  it("offers safe copy and conflict navigation only", async () => {
    const onNavigateSection = vi.fn();
    Object.defineProperty(globalThis.navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
    render(<EvidenceAndProvenancePanel {...props({
      onNavigateSection,
      registry: { ...props().registry, evidenceRecords: [record({ relationship: "challenges" })] },
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Conflict Review" }));
    expect(onNavigateSection).toHaveBeenCalledWith("decision");
    fireEvent.click(screen.getByRole("button", { name: "Copy Evidence ID" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("copied"));
  });
});
