import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveResearchCommand,
  saveSupportingEvidenceCommand,
} from "../../../services/repositories/researchRepository";
import { buildSupportingEvidenceAppendMutation } from "../../../services/research-intelligence/supportingEvidenceService";
import EvidenceAndProvenancePanel from "../EvidenceAndProvenancePanel";
import ResearchResolutionPanel from "../ResearchResolutionPanel";

vi.mock("../../../services/repositories/researchRepository", () => ({
  saveResearchCommand: vi.fn(),
  saveSupportingEvidenceCommand: vi.fn(),
}));
vi.mock("../../../supabaseClient", () => ({ supabase: {} }));

const deal = {
  id: "deal-1",
  organization_id: "org-1",
  tenant_id: "tenant-1",
  asset_type: "residential-home",
  price: 100000,
  asking_price: 100000,
  research_revision: 0,
  research_evidence: [],
};

const readModel = {
  assetStrategyContext: { assetType: "residential-home" },
  conflictReadModel: { activeConflicts: [], resolvedConflicts: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  saveResearchCommand.mockResolvedValue({ success: true, data: { ...deal, research_revision: 1 } });
  saveSupportingEvidenceCommand.mockResolvedValue({ success: true, data: { ...deal, research_revision: 1 } });
});

describe("ResearchResolutionPanel supporting evidence mode", () => {
  it("exposes a separate supporting workflow and sends its structured command only to the append boundary", async () => {
    const onSaved = vi.fn();
    render(<ResearchResolutionPanel deal={deal} onSaved={onSaved} readModel={readModel} />);

    expect(screen.getByLabelText("Research fact")).toBeInTheDocument();
    expect(screen.queryByLabelText("Evidence category")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Research workflow"), { target: { value: "supporting" } });

    expect(screen.queryByLabelText("Research fact")).not.toBeInTheDocument();
    expect(screen.getByText("Supporting evidence does not change canonical deal facts.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Evidence category"), { target: { value: "ownership_title" } });
    fireEvent.change(screen.getByLabelText("Finding / value"), { target: { value: "Record owner is Ben Aviv." } });
    fireEvent.change(screen.getByLabelText("Source name"), { target: { value: "Orange County Comptroller" } });
    fireEvent.change(screen.getByLabelText("Source URL (optional)"), { target: { value: "https://example.gov/records/123" } });
    fireEvent.change(screen.getByLabelText("Source reference (optional)"), { target: { value: "Instrument 2024012345" } });
    fireEvent.change(screen.getByLabelText("Source date/time (optional)"), { target: { value: "2024-07-17T08:00" } });
    fireEvent.change(screen.getByLabelText("Retrieved at"), { target: { value: "2026-10-02T09:45" } });
    fireEvent.change(screen.getByLabelText("Evidence status"), { target: { value: "VERIFIED" } });
    fireEvent.change(screen.getByLabelText("Resolution state"), { target: { value: "SUPPORTING" } });
    fireEvent.change(screen.getByLabelText("Parcel identifier (optional)"), { target: { value: "27-22-27-8894-01-140" } });
    fireEvent.change(screen.getByLabelText("Owner / party name (optional)"), { target: { value: "Ben Aviv" } });
    fireEvent.change(screen.getByLabelText("Notes / limitations (optional)"), { target: { value: "Exact parcel and grantee linkage." } });
    fireEvent.click(screen.getByRole("button", { name: "Add supporting evidence" }));

    await waitFor(() => expect(saveSupportingEvidenceCommand).toHaveBeenCalledWith(deal, {
      category: "ownership_title",
      fact: "Record owner is Ben Aviv.",
      sourceName: "Orange County Comptroller",
      sourceUrl: "https://example.gov/records/123",
      sourceReference: "Instrument 2024012345",
      sourceDate: "2024-07-17T08:00",
      retrievedAt: "2026-10-02T09:45",
      status: "VERIFIED",
      resolutionState: "SUPPORTING",
      parcelIdentifier: "27-22-27-8894-01-140",
      ownerPartyName: "Ben Aviv",
      notes: "Exact parcel and grantee linkage.",
    }));
    expect(saveResearchCommand).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Canonical deal facts were not changed");
  });

  it("retains the canonical Resolve Research behavior in its original path", async () => {
    render(<ResearchResolutionPanel deal={deal} onSaved={vi.fn()} readModel={readModel} />);

    fireEvent.change(screen.getByLabelText("Researched value"), { target: { value: "125000" } });
    fireEvent.change(screen.getByLabelText("Source reference"), { target: { value: "Seller statement" } });
    fireEvent.click(screen.getByRole("button", { name: "Save researched fact" }));

    await waitFor(() => expect(saveResearchCommand).toHaveBeenCalledWith(deal, expect.objectContaining({
      type: "record",
      field: "deal.askingPrice",
      value: "125000",
      source: "Seller statement",
    })));
    expect(saveSupportingEvidenceCommand).not.toHaveBeenCalled();
  });

  it("renders saved supporting provenance, exact status, linkage, and unresolved state in existing evidence views", () => {
    const command = {
      category: "bankruptcy_probate",
      fact: "Bankruptcy and probate status not verified.",
      sourceName: "Public records review",
      sourceUrl: "https://example.gov/search/abc",
      sourceReference: "Search ref ABC",
      sourceDate: "2026-10-01T12:00:00.000Z",
      retrievedAt: "2026-10-02T13:45:00.000Z",
      status: "UNKNOWN",
      resolutionState: "UNRESOLVED",
      parcelIdentifier: "27-22-27-8894-01-140",
      ownerPartyName: "Ben Aviv",
      notes: "A professional title update is still required.",
    };
    const mutation = buildSupportingEvidenceAppendMutation({ deal, command, actorReference: "operator-1" });
    const evidenceRecord = mutation.research_evidence[0];
    const dealWithEvidence = { ...deal, ...mutation };

    const { unmount } = render(<ResearchResolutionPanel deal={dealWithEvidence} onSaved={vi.fn()} readModel={readModel} />);
    fireEvent.change(screen.getByLabelText("Research workflow"), { target: { value: "supporting" } });
    expect(screen.getByRole("list", { name: "Saved supporting evidence" })).toHaveTextContent("UNKNOWN");
    expect(screen.getByRole("list", { name: "Saved supporting evidence" })).toHaveTextContent("UNRESOLVED");
    expect(screen.getByRole("link", { name: "Source URL" })).toHaveAttribute("href", command.sourceUrl);
    unmount();

    render(<EvidenceAndProvenancePanel
      coverage={{ limitationCodes: [], counts: { representedFields: 0, fieldsWithConflicts: 0 } }}
      lineage={{ outputs: [] }}
      registry={{
        evidenceRecords: [evidenceRecord],
        evaluatedTimestamp: command.retrievedAt,
        counts: { total: 1, supporting: 0, challenging: 0, contextual: 1, limited: 1 },
      }}
    />);
    expect(screen.getByRole("heading", { name: "Supporting: Bankruptcy Probate" })).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("UNRESOLVED", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: command.sourceUrl })).toHaveAttribute("href", command.sourceUrl);
    expect(screen.getByText(command.parcelIdentifier)).toBeInTheDocument();
    expect(screen.getByText(command.ownerPartyName)).toBeInTheDocument();
    expect(screen.getByText(command.notes)).toBeInTheDocument();
  });
});
