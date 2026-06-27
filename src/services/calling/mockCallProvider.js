import { createSuccess } from "../api/serviceResult";

export const mockCallProvider = {
  id: "mock",
  label: "Mock call provider",
  configured: true,
  async placeCall({ phone = "" } = {}) {
    return createSuccess({
      callId: `mock-call-${Date.now()}`,
      provider: "mock",
      status: "provider-unavailable",
      message: `Mock call prepared for ${phone || "seller"}. No live call was placed.`,
    });
  },
};
