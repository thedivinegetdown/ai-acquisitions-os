import { analyzeRuleBasedDealIntelligence } from "./ruleBasedIntelligenceProvider";

const defaultProvider = {
  analyzeDealIntelligence: analyzeRuleBasedDealIntelligence,
};

export function analyzeDealIntelligence(input = {}, provider = defaultProvider) {
  return provider.analyzeDealIntelligence(input);
}
