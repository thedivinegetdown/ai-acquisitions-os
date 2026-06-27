import {
  HEALTH_STATUSES,
  getIntegrationStatuses,
  getMissingEnvironmentVariables,
} from "./integrationStatusService";
import { getRecentSystemEvents } from "./systemEventService";
import { analyzeUsageHealth } from "./usageHealthService";

function statusWeight(status) {
  if (status === HEALTH_STATUSES.HEALTHY) return 100;
  if (status === HEALTH_STATUSES.WARNING) return 70;
  if (status === HEALTH_STATUSES.UNKNOWN) return 60;
  if (status === HEALTH_STATUSES.NOT_CONFIGURED) return 35;
  if (status === HEALTH_STATUSES.ERROR) return 10;
  return 50;
}

function labelFromScore(score) {
  if (score >= 85) return HEALTH_STATUSES.HEALTHY;
  if (score >= 65) return HEALTH_STATUSES.WARNING;
  if (score >= 40) return HEALTH_STATUSES.UNKNOWN;
  return HEALTH_STATUSES.ERROR;
}

function buildKnownWarnings({ statuses, usageHealth }) {
  return [
    ...statuses.flatMap((status) => status.warnings || []),
    ...usageHealth.warnings,
  ].filter(Boolean);
}

function buildRecommendedActions({ statuses, missingEnv, usageHealth }) {
  const actions = [];

  if (missingEnv.length > 0) {
    actions.push("Configure missing client environment variables before deployment.");
  }

  if (statuses.some((status) => status.status === HEALTH_STATUSES.UNKNOWN)) {
    actions.push("Verify server-side secrets in Netlify for Twilio, OpenAI, and Stripe.");
  }

  if (usageHealth.completenessScore < 90) {
    actions.push("Review Data Health Center and clean missing deal fields.");
  }

  actions.push("Run npm run test:run and npm run build before production deploys.");

  return [...new Set(actions)];
}

export function analyzeSystemHealth({ deals = [] } = {}) {
  const integrationStatuses = getIntegrationStatuses();
  const missingEnv = getMissingEnvironmentVariables(integrationStatuses);
  const usageHealth = analyzeUsageHealth({ deals });
  const integrationScore = Math.round(
    integrationStatuses.reduce(
      (total, integration) => total + statusWeight(integration.status),
      0
    ) / Math.max(integrationStatuses.length, 1)
  );
  const overallScore = Math.round(
    integrationScore * 0.7 + usageHealth.completenessScore * 0.3
  );
  const knownWarnings = buildKnownWarnings({
    statuses: integrationStatuses,
    usageHealth,
  });

  return {
    overallStatus: labelFromScore(overallScore),
    overallScore,
    integrationScore,
    usageHealth,
    integrationStatuses,
    missingEnv,
    recentEvents: getRecentSystemEvents(),
    knownWarnings,
    recommendedActions: buildRecommendedActions({
      statuses: integrationStatuses,
      missingEnv,
      usageHealth,
    }),
    generatedAt: new Date().toISOString(),
  };
}
