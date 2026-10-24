import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExternalLandResearchIntake from "../ExternalLandResearchIntake";

const service = vi.hoisted(() => ({ review: vi.fn(), confirm: vi.fn(), append: vi.fn() }));
vi.mock("../../services/leadIntake/externalLandIntakeService", () => ({ reviewExternalLandCandidate: service.review, confirmExternalLandCandidate: service.confirm, appendExternalLandEvidence: service.append }));
const review = {
  identity: { authoritativeParcelId: "5844315" },
  verification: { parcel: { propertyUse: { description: "VACANT RES" } } },
  commands: [
    { fact: "County zoning: A-4", status: "VERIFIED", resolutionState: "CONFLICTING", sourceName: "Volusia County", sourceUrl: "https://www.volusia.org", retrievedAt: "2026-10-24T12:00:00Z" },
    { fact: "Listing zoning claim: A-3", status: "INDICATIVE", resolutionState: "CONFLICTING", sourceName: "Listing source", sourceUrl: "https://example.com/land", retrievedAt: "2026-10-23T12:00:00Z" },
  ],
};
async function openReview() {
  fireEvent.click(screen.getByText("External property research → Vacant land"));
  fireEvent.change(screen.getByLabelText("Listing source name"), { target: { value: "Listing" } });
  fireEvent.change(screen.getByLabelText("Listing source URL"), { target: { value: "https://example.com/land" } });
  fireEvent.change(screen.getByLabelText("Listing retrieval date"), { target: { value: "2026-10-24T12:00" } });
  fireEvent.change(screen.getByLabelText("Official Volusia PARID (seven digits)"), { target: { value: "5844315" } });
  fireEvent.change(screen.getByLabelText("Address / location"), { target: { value: "1964 South Farm Rd" } });
  await act(async () => fireEvent.submit(screen.getByRole("button", { name: /Verify Official Parcel/ }).closest("form")));
}
beforeEach(() => {
  vi.clearAllMocks();
  service.review.mockResolvedValue(review);
  service.confirm.mockResolvedValue({ status: "imported", deal: { id: "land-1" } });
});

describe("owner external land intake", () => {
  it("reviews before explicit save, displays sourced zoning conflict, then opens saved lead", async () => {
    const refresh = vi.fn(); const navigateToDeal = vi.fn();
    render(<ExternalLandResearchIntake refresh={refresh} navigateToDeal={navigateToDeal} />);
    await openReview();
    expect(screen.getByText(/No seller contact is required/)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate status: no active lead/)).toBeInTheDocument();
    expect(screen.getByText("County zoning: A-4")).toBeInTheDocument();
    expect(screen.getByText("Listing zoning claim: A-3")).toBeInTheDocument();
    expect(service.confirm).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm Save Research Lead" })));
    expect(service.confirm).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open Saved Lead" }));
    expect(navigateToDeal).toHaveBeenCalledWith("land-1");
    expect(screen.queryByRole("button", { name: /Append Reviewed/ })).not.toBeInTheDocument();
  });

  it("returns the existing deal without silently appending, and requires a second confirmation", async () => {
    const existingDeal = { id: "existing" };
    service.review.mockResolvedValue({ ...review, existingDeal });
    service.confirm.mockResolvedValue({ status: "existing", deal: existingDeal });
    service.append.mockResolvedValue({ success: true, data: existingDeal });
    render(<ExternalLandResearchIntake />);
    await openReview();
    expect(screen.getByText(/Duplicate status: an active lead already exists/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm Existing Lead" })));
    expect(service.append).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm Append Reviewed Evidence to Existing Lead" })));
    expect(service.append).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Canonical facts and operating scope were preserved/)).toBeInTheDocument();
  });

  it("leaves failed verification unsaved and does not claim persistence on failed admission", async () => {
    service.review.mockRejectedValueOnce(new Error("Ambiguous official match"));
    render(<ExternalLandResearchIntake />);
    await openReview();
    expect(screen.getByRole("alert")).toHaveTextContent("Ambiguous official match");
    expect(screen.queryByRole("button", { name: "Confirm Save Research Lead" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Address / location")).toHaveValue("1964 South Farm Rd");
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: /Verify Official Parcel/ }).closest("form")));
    service.confirm.mockRejectedValue(new Error("Admission failed"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm Save Research Lead" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Admission failed");
    expect(screen.queryByRole("button", { name: "Open Saved Lead" })).not.toBeInTheDocument();
  });
});
