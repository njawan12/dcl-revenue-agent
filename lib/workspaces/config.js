import { DEFAULT_SCORING_CONFIG } from '../scoring.js';

export const DCL_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';

export const DEFAULT_WORKSPACE_CONFIG = Object.freeze({
  workspaceId: DCL_WORKSPACE_ID,
  services: [],
  targetCountries: DEFAULT_SCORING_CONFIG.targetCountries,
  targetIndustries: DEFAULT_SCORING_CONFIG.targetIndustries,
  scoring: DEFAULT_SCORING_CONFIG,
  buyerRoleRules: {},
  salesMotionRules: {},
  outreachRules: {
    requireReasonToContact: true,
    requireVerifiedEmail: true,
    requireHumanApproval: true,
  },
});

export function normalizeWorkspaceConfig(raw = {}) {
  const nestedScoring = raw.scoring ?? {};
  const fitWeights = raw.fitWeights ?? raw.fit_weights ?? nestedScoring.fitWeights ?? {};
  const needWeights = raw.needWeights ?? raw.need_weights ?? nestedScoring.needWeights ?? {};
  const intentWeights = raw.intentWeights ?? raw.intent_weights ?? nestedScoring.intentWeights ?? {};
  const opportunityWeights = raw.opportunityWeights ?? raw.opportunity_weights ?? nestedScoring.opportunityWeights ?? {};
  const thresholds = raw.thresholds ?? nestedScoring.thresholds ?? {};
  const targetCountries = raw.targetCountries ?? raw.target_countries ?? nestedScoring.targetCountries ?? DEFAULT_SCORING_CONFIG.targetCountries;
  const targetIndustries = raw.targetIndustries ?? raw.target_industries ?? nestedScoring.targetIndustries ?? DEFAULT_SCORING_CONFIG.targetIndustries;
  return {
    workspaceId: raw.workspaceId ?? raw.workspace_id ?? DCL_WORKSPACE_ID,
    services: raw.services ?? [],
    targetCountries,
    targetIndustries,
    scoring: {
      ...DEFAULT_SCORING_CONFIG,
      ...nestedScoring,
      targetCountries,
      targetIndustries,
      fitWeights: { ...DEFAULT_SCORING_CONFIG.fitWeights, ...fitWeights },
      needWeights: { ...DEFAULT_SCORING_CONFIG.needWeights, ...needWeights },
      intentWeights: { ...DEFAULT_SCORING_CONFIG.intentWeights, ...intentWeights },
      opportunityWeights: { ...DEFAULT_SCORING_CONFIG.opportunityWeights, ...opportunityWeights },
      thresholds: { ...DEFAULT_SCORING_CONFIG.thresholds, ...thresholds },
      employeeMin: raw.employeeMin ?? raw.employee_min ?? nestedScoring.employeeMin ?? DEFAULT_SCORING_CONFIG.employeeMin,
      employeeMax: raw.employeeMax ?? raw.employee_max ?? nestedScoring.employeeMax ?? DEFAULT_SCORING_CONFIG.employeeMax,
    },
    buyerRoleRules: raw.buyerRoleRules ?? raw.buyer_role_rules ?? {},
    salesMotionRules: raw.salesMotionRules ?? raw.sales_motion_rules ?? {},
    outreachRules: {
      ...DEFAULT_WORKSPACE_CONFIG.outreachRules,
      ...(raw.outreachRules ?? raw.outreach_rules ?? {}),
    },
  };
}
