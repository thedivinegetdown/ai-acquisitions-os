import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationSettingsPanel from "../OrganizationSettingsPanel";
import {
  loadOrganizationProviderPolicies,
  loadOrganizationSettings,
  saveOrganizationSettings,
} from "../../services/repositories";

vi.mock("../../services/repositories", () => ({
  loadOrganizationProviderPolicies: vi.fn(),
  loadOrganizationSettings: vi.fn(),
  saveOrganizationSettings: vi.fn(),
}));

describe("OrganizationSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadOrganizationSettings.mockResolvedValue({
      success: true,
      data: { default_market: "Phoenix", default_timezone: "America/Phoenix" },
    });
    loadOrganizationProviderPolicies.mockResolvedValue({
      success: true,
      data: [{ provider: "openai", enabled: false }],
    });
    saveOrganizationSettings.mockResolvedValue({
      success: true,
      data: { default_market: "Tampa" },
    });
  });

  it("reloads persisted organization settings and saves operational defaults", async () => {
    render(<OrganizationSettingsPanel />);

    const market = await screen.findByLabelText("Default Market");
    expect(market).toHaveValue("Phoenix");
    expect(screen.getByText("OpenAI: disabled")).toBeInTheDocument();

    fireEvent.change(market, { target: { value: "Tampa" } });
    fireEvent.click(screen.getByRole("button", { name: "Save organization defaults" }));

    await waitFor(() => {
      expect(saveOrganizationSettings).toHaveBeenCalledWith(
        expect.objectContaining({ default_market: "Tampa" })
      );
    });
    expect(await screen.findByText("Operational defaults saved for this organization.")).toBeInTheDocument();
  });
});
