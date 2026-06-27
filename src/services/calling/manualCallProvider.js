import { createSuccess } from "../api/serviceResult";

export const manualCallProvider = {
  id: "manual",
  label: "Manual call provider",
  configured: true,
  async placeCall() {
    return createSuccess({
      provider: "manual",
      status: "provider-unavailable",
      message:
        "Calling foundation only - live calling is not active yet. Log call notes manually.",
    });
  },
};
