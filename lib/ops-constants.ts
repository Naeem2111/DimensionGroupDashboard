import type {
  OpsPricingTier,
  OpsProjectComplexity,
  OpsProjectPhase,
  OpsProjectStatus,
  OpsTaskType,
  OpsUrgencyStatus,
} from "@prisma/client";

export const PRICING_TIER_LANE_GBP: Record<OpsPricingTier, number> = {
  tier_25: 2187,
  tier_30: 2041,
  tier_35: 1895,
  tier_40: 1750,
};

export const PROJECT_PHASE_LABELS: Record<OpsProjectPhase, string> = {
  survey_conversion: "Survey Conversion",
  existing_drawings: "Existing Drawings",
  proposed_drawings: "Proposed Drawings",
  planning_submission: "Planning / Submission",
  tender_construction_pack: "Tender / Construction Pack",
  construction: "Construction",
  housekeeping_internal: "Housekeeping / Internal",
};

/** Combined package label — survey conversion + existing drawings are one operational stage. */
export const SURVEY_EXISTING_DRAWINGS_LABEL = "Survey Conversion (Existing Drawings)";

/** Stage options for project create/edit (operations tracker, athlete projects). */
export const OPS_PROJECT_STAGE_OPTIONS: { value: OpsProjectPhase; label: string }[] = [
  { value: "survey_conversion", label: SURVEY_EXISTING_DRAWINGS_LABEL },
  { value: "proposed_drawings", label: PROJECT_PHASE_LABELS.proposed_drawings },
  { value: "planning_submission", label: PROJECT_PHASE_LABELS.planning_submission },
  { value: "tender_construction_pack", label: PROJECT_PHASE_LABELS.tender_construction_pack },
  { value: "construction", label: PROJECT_PHASE_LABELS.construction },
  { value: "housekeeping_internal", label: PROJECT_PHASE_LABELS.housekeeping_internal },
];

/** User-facing stage label; legacy existing_drawings shows as the combined package. */
export function displayProjectStageLabel(stage: OpsProjectPhase): string {
  if (stage === "survey_conversion" || stage === "existing_drawings") {
    return SURVEY_EXISTING_DRAWINGS_LABEL;
  }
  return PROJECT_PHASE_LABELS[stage];
}

/** Map legacy existing_drawings to the combined stage for dropdowns. */
export function projectStageSelectValue(stage: OpsProjectPhase): OpsProjectPhase {
  return stage === "existing_drawings" ? "survey_conversion" : stage;
}

export const TASK_TYPE_LABELS: Record<OpsTaskType, string> = {
  plans: "Plans",
  sections: "Sections",
  elevations: "Elevations",
  joinery_drawings: "Joinery Drawings",
  electrical_drawings: "Electrical Drawings",
  modelling_3d: "3D Modelling",
  rendering: "Rendering",
  coordination_markups: "Coordination / Markups",
  review_qa: "Review / QA",
  admin_housekeeping: "Admin / Housekeeping",
  other: "Other",
};

export const PROJECT_STATUS_LABELS: Record<OpsProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting_on_feedback: "Waiting on Feedback",
  zoom_required: "Zoom Required",
  blocked: "Blocked",
  completed: "Completed",
  handed_over: "Handed Over",
};

export const COMPLEXITY_LABELS: Record<OpsProjectComplexity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const URGENCY_LABELS: Record<OpsUrgencyStatus, string> = {
  normal: "Normal",
  critical: "Critical",
  completed: "Completed",
};

export const PRICING_TIER_LABELS: Record<OpsPricingTier, string> = {
  tier_25: "25%",
  tier_30: "30%",
  tier_35: "35%",
  tier_40: "40%",
};

export function laneCostForTier(tier: OpsPricingTier): number {
  return PRICING_TIER_LANE_GBP[tier];
}

/** Included production hours per lane per month (lane billing is fixed; hours track utilization). */
export const LANE_MONTHLY_HOURS = 160;

export function monthlyLaneRevenueGbp(laneCostGbp: number, activeLaneCount: number): number {
  return laneCostGbp * Math.max(0, activeLaneCount);
}

export function laneIncludedHours(activeLaneCount: number): number {
  return LANE_MONTHLY_HOURS * Math.max(0, activeLaneCount);
}

export function isOpsProjectPhase(v: string): v is OpsProjectPhase {
  return v in PROJECT_PHASE_LABELS;
}

export function isOpsTaskType(v: string): v is OpsTaskType {
  return v in TASK_TYPE_LABELS;
}

export function isOpsProjectStatus(v: string): v is OpsProjectStatus {
  return v in PROJECT_STATUS_LABELS;
}

export function isOpsProjectComplexity(v: string): v is OpsProjectComplexity {
  return v in COMPLEXITY_LABELS;
}

export function isOpsUrgencyStatus(v: string): v is OpsUrgencyStatus {
  return v in URGENCY_LABELS;
}

export function isOpsPricingTier(v: string): v is OpsPricingTier {
  return v in PRICING_TIER_LABELS;
}

export function clampTierPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.max(25, Math.min(40, Math.round(n)));
}

export function pricingTierForPercent(percent: number): OpsPricingTier {
  if (percent <= 27) return "tier_25";
  if (percent <= 32) return "tier_30";
  if (percent <= 37) return "tier_35";
  return "tier_40";
}
