import { lazy, Suspense, useMemo, useState } from "react";
import LazyPanelFallback from "../../components/LazyPanelFallback";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  StatusBadge,
  Tabs,
} from "../../design-system";
import {
  ASSET_CAPABILITY_IDS,
  ASSET_STRATEGY_SUPPORT_STATES,
  buildAssetStrategyContext,
  canRunAssetCapability,
} from "../../services/asset-strategy";
import {
  buildCompatibilityDecisionReadModel,
  canPresentPursuitScore,
} from "../../services/decision-intelligence";
import { getDealIdFromRoute } from "../../navigation/workspaces";
import { formatSafeDate } from "../../utils/dates";
import { getDealAliasText } from "../../utils/dealFields";
import MissingInformationAutopilot from "./MissingInformationAutopilot";

const AIInsights = lazy(() => import("../../components/AIInsights"));
const ActivityTimeline = lazy(() => import("../../components/ActivityTimeline"));
const BuyerBlast = lazy(() => import("../../components/BuyerBlast"));
const BuyerMatches = lazy(() => import("../../components/BuyerMatches"));
const CloseoutPanel = lazy(() => import("../../components/CloseoutPanel"));
const CompsEngine = lazy(() => import("../../components/CompsEngine"));
const DealAnalyzer = lazy(() => import("../../components/DealAnalyzer"));
const DealTimeline = lazy(() => import("./DealTimeline"));
const DocumentContractPrepPanel = lazy(() => import("../../components/DocumentContractPrepPanel"));
const DocumentVault = lazy(() => import("../../components/DocumentVault"));
const MessageCenter = lazy(() => import("../../components/MessageCenter"));
const NegotiationTracker = lazy(() => import("../../components/NegotiationTracker"));
const OfferEngine = lazy(() => import("../../components/OfferEngine"));
const OfferReadinessSummary = lazy(() => import("./OfferReadinessSummary"));
const PropertyIntelligencePanel = lazy(() => import("../../components/PropertyIntelligencePanel"));
const PursuitScoreSummary = lazy(() => import("./PursuitScoreSummary"));
const ResidentialStrategySummary = lazy(() => import("./ResidentialStrategySummary"));
const VacantLandStrategySummary = lazy(() => import("./VacantLandStrategySummary"));
const SequenceEngine = lazy(() => import("../../components/SequenceEngine"));
const TaskPanel = lazy(() => import("../../components/TaskPanel"));
const TeamPanel = lazy(() => import("../../components/TeamPanel"));

const SECTION_IDS = [
  "decision",
  "seller",
  "property",
  "numbers",
  "communication",
  "activity",
  "documents",
  "closing",
];

const SECTION_LABELS = {
  decision: "Decision",
  seller: "Seller",
  property: "Property",
  numbers: "Numbers",
  communication: "Communication",
  activity: "Activity",
  documents: "Documents",
  closing: "Closing",
};

const EMPTY_DECISION_CONTEXT = Object.freeze({});

const LIFECYCLE_STATUS = {
  Identify: "neutral",
  Verify: "warning",
  Decide: "info",
  Act: "info",
  Learn: "success",
};

const STRATEGY_SUPPORT_STATUS = {
  [ASSET_STRATEGY_SUPPORT_STATES.COMPATIBILITY_ONLY]: "info",
  [ASSET_STRATEGY_SUPPORT_STATES.CONTRACT_READY]: "warning",
  [ASSET_STRATEGY_SUPPORT_STATES.DEFERRED]: "warning",
  [ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED]: "success",
  [ASSET_STRATEGY_SUPPORT_STATES.UNASSIGNED]: "neutral",
  [ASSET_STRATEGY_SUPPORT_STATES.UNSUPPORTED]: "warning",
};

const PRIMARY_FACTS = [
  { id: "property", label: "Property", value: (deal) => getDealAliasText(deal, "address") || "Unknown property" },
  { id: "seller", label: "Seller", value: (deal) => getDealAliasText(deal, "ownerName") || "Unknown seller" },
  { id: "stage", label: "Current stage", value: (deal) => getDealAliasText(deal, "stage") || "New Lead" },
  { id: "assigned", label: "Assigned user", value: (deal) => deal.owner_name || deal.acquisitions_rep || "Unassigned" },
  { id: "status", label: "Current status", value: (deal) => deal.status || deal.negotiation_status || "Needs review" },
];

function getDealId(deal = {}) {
  return getDealAliasText(deal, "id") || "";
}

function findDealByRoute(deals = [], route = "") {
  const routeDealId = getDealIdFromRoute(route);
  if (!routeDealId) return null;

  return deals.find((deal) => String(getDealId(deal)) === String(routeDealId)) || null;
}

function getPhone(deal = {}) {
  return getDealAliasText(deal, "phone") || deal.phone_number || "";
}

function getDecisionRoomCapabilityGates(assetStrategyContext) {
  return {
    propertyIntelligence: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_PROPERTY_INTELLIGENCE
    ),
    comps: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_COMPS
    ),
    underwriting: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING
    ),
    offerGeneration: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_GENERATION
    ),
    negotiationCalculations: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_NEGOTIATION_CALCULATIONS
    ),
    buyerMatching: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_MATCHING
    ),
    buyerBlast: canRunAssetCapability(
      assetStrategyContext,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_BLAST
    ),
  };
}

function PanelSection({ children, description, title }) {
  return (
    <Card className="decision-room__section">
      <SectionHeader description={description} title={title} />
      <div className="decision-room__section-body">{children}</div>
    </Card>
  );
}

function LazySection({ children, label }) {
  return <Suspense fallback={<LazyPanelFallback label={label} />}>{children}</Suspense>;
}

// New component reason: compose the shared EmptyState with consistent, safe
// Decision Room navigation whenever an asset capability is unavailable.
function StrategyCapabilityState({ gate, onNavigateSection, title }) {
  return (
    <EmptyState
      action={
        <div className="decision-room__actions">
          <Button onClick={() => onNavigateSection("decision")} variant="secondary">
            Review Decision
          </Button>
          <Button onClick={() => onNavigateSection("seller")} variant="secondary">
            Review Seller
          </Button>
        </div>
      }
      description={gate.explanation}
      title={title}
    />
  );
}

function FactGrid({ deal }) {
  return (
    <dl className="decision-room__facts" aria-label="Deal summary facts">
      {PRIMARY_FACTS.map((fact) => (
        <div key={fact.id}>
          <dt>{fact.label}</dt>
          <dd>{fact.value(deal)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrimaryActions({ actions, onAction }) {
  const actionById = Object.fromEntries(actions.map((action) => [action.id, action]));

  function runAction(actionId) {
    const action = actionById[actionId];
    if (!action?.enabled) return;
    onAction(actionId === "view-conversation" ? "conversation" : action.targetSection);
  }

  return (
    <div className="decision-room__actions" aria-label="Decision Room primary actions">
      <Button
        disabled={!actionById["prepare-offer"]?.enabled}
        onClick={() => runAction("prepare-offer")}
        title={actionById["prepare-offer"]?.disabledReason || undefined}
      >
        Prepare Offer
      </Button>
      <Button
        disabled={!actionById["follow-up"]?.enabled}
        onClick={() => runAction("follow-up")}
        variant="secondary"
      >
        Follow Up
      </Button>
      <Button
        disabled={!actionById.assign?.enabled}
        onClick={() => runAction("assign")}
        variant="secondary"
      >
        Assign
      </Button>
      <Button
        disabled={!actionById["view-conversation"]?.enabled}
        onClick={() => runAction("view-conversation")}
        variant="secondary"
      >
        View Conversation
      </Button>
      <Button
        disabled
        title="Mark Waiting is not connected to a current safe workflow yet."
        variant="secondary"
      >
        Mark Waiting
      </Button>
      <Button disabled title="Archive is intentionally deferred to avoid changing CRM records." variant="secondary">
        Archive
      </Button>
    </div>
  );
}

function DecisionOverview({ deal, decisionResult, onAction, onNavigateWorkspace }) {
  if (!decisionResult?.success) {
    return (
      <Card>
        <SectionHeader
          description="The existing deal remains available, but its deterministic decision summary failed."
          title="Decision Snapshot"
        />
        <ErrorState
          description={
            decisionResult?.error?.message ||
            "Decision information could not be evaluated from the current record."
          }
          title="Decision information unavailable"
        />
      </Card>
    );
  }

  const readModel = decisionResult.data;
  const readiness = readModel.metricsById["offer-readiness"];
  const pursuitScoreMetric = readModel.metricsById["pursuit-score"];
  const showPursuitScore = canPresentPursuitScore({
    assetStrategyContext: readModel.assetStrategyContext,
    metric: pursuitScoreMetric,
    result: readModel.pursuitScoreResult,
  });
  const approval = readModel.approvalSummary;
  const assetStrategyContext = readModel.assetStrategyContext;
  const insightGate = canRunAssetCapability(
    assetStrategyContext,
    ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING
  );

  return (
    <div className="decision-room__decision">
      <Card>
        <SectionHeader
          description="Deterministic decision summary from the currently loaded, evidence-linked CRM fields."
          title="Decision Snapshot"
        />
        <div className="decision-room__decision-statuses" aria-label="Current decision states">
          <StatusBadge status={LIFECYCLE_STATUS[readModel.lifecycle.state] || "neutral"}>
            Lifecycle: {readModel.lifecycle.state || "Not evaluated"}
          </StatusBadge>
          {readiness?.evaluationState === "evaluated" ? (
            <StatusBadge status={readiness.value === "ready-for-offer-preparation" ? "success" : "warning"}>
              Offer readiness: {readiness.displayValue}
            </StatusBadge>
          ) : null}
          <StatusBadge
            status={
              STRATEGY_SUPPORT_STATUS[
                assetStrategyContext.strategySupportState
              ] || "neutral"
            }
          >
            {assetStrategyContext.statusSummary}
          </StatusBadge>
          <Badge>
            {assetStrategyContext.residentialStrategyEligibility
              ? "Deterministic Residential Strategy"
              : assetStrategyContext.landStrategyEligibility
                ? "Deterministic Vacant Land Strategy"
              : assetStrategyContext.compatibilityAnalysisEligibility
                ? "Deterministic compatibility"
              : "Deterministic decision context"}
          </Badge>
        </div>
        <dl
          aria-label="Asset Strategy status"
          className="decision-room__decision-meta"
        >
          <div>
            <dt>Asset Type</dt>
            <dd>{assetStrategyContext.assetTypeLabel}</dd>
          </div>
          <div>
            <dt>Classification State</dt>
            <dd>{assetStrategyContext.classificationLabel}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{assetStrategyContext.strategyLabel}</dd>
          </div>
          <div>
            <dt>Strategy Support</dt>
            <dd>{assetStrategyContext.strategySupportLabel}</dd>
          </div>
          {assetStrategyContext.residentialStrategyEligibility ? (
            <div>
              <dt>Strategy Mode</dt>
              <dd>Residential Acquisition Strategy v1</dd>
            </div>
          ) : assetStrategyContext.landStrategyEligibility ? (
            <div>
              <dt>Strategy Mode</dt>
              <dd>Vacant Land Acquisition Strategy v1</dd>
            </div>
          ) : assetStrategyContext.compatibilityAnalysisEligibility ? (
            <div>
              <dt>Compatibility Mode</dt>
              <dd>Residential Compatibility Analysis</dd>
            </div>
          ) : null}
          {assetStrategyContext.residentialStrategyEligibility ? (
            <div>
              <dt>Offer Readiness</dt>
              <dd>Implemented</dd>
            </div>
          ) : assetStrategyContext.landStrategyEligibility ? (
            <div>
              <dt>Offer Readiness</dt>
              <dd>Implemented</dd>
            </div>
          ) : null}
        </dl>
        <FactGrid deal={deal} />
        <div className="decision-room__recommendation">
          <span>Current lifecycle</span>
          <strong>{readModel.lifecycle.state || "Not evaluated"}</strong>
          <p>{readModel.lifecycle.reason || "No lifecycle reason is available."}</p>
          <span>Recommended Next Action</span>
          <strong>{readModel.recommendation.label || "Needs review"}</strong>
          <p>{readModel.recommendation.explanation}</p>
        </div>
        <dl className="decision-room__decision-meta">
          <div>
            <dt>Approval context</dt>
            <dd>{approval.status === "unavailable" ? "Not supplied" : approval.status}</dd>
          </div>
          <div>
            <dt>Last evaluated</dt>
            <dd>{formatSafeDate(readModel.lifecycle.evaluatedTimestamp, "Not available")}</dd>
          </div>
        </dl>
        {readModel.sourceStatus === "partial" ? (
          <p className="decision-room__partial-warning" role="status">
            Decision basis is partial. Review the source and compatibility warnings below.
          </p>
        ) : null}
        <PrimaryActions actions={readModel.availableActions} onAction={onAction} />
      </Card>
      {showPursuitScore ? (
        <LazySection label="Loading Pursuit Score explanation...">
          <PursuitScoreSummary
            assetStrategyContext={assetStrategyContext}
            metric={pursuitScoreMetric}
            result={readModel.pursuitScoreResult}
          />
        </LazySection>
      ) : null}
      <LazySection label="Loading Offer Readiness gates...">
        <OfferReadinessSummary
          onNavigateSection={onAction}
          onNavigateWorkspace={onNavigateWorkspace}
          result={readModel.readinessResult}
        />
      </LazySection>
      {readModel.residentialStrategyResult?.eligible ? (
        <LazySection label="Loading Residential Strategy summary...">
          <ResidentialStrategySummary result={readModel.residentialStrategyResult} />
        </LazySection>
      ) : null}
      {readModel.vacantLandStrategyResult?.eligible ? (
        <LazySection label="Loading Vacant Land Strategy summary...">
          <VacantLandStrategySummary result={readModel.vacantLandStrategyResult} />
        </LazySection>
      ) : null}
      <MissingInformationAutopilot
        onNavigateSection={onAction}
        readModel={readModel.missingInformationReadModel}
      />
      <Card className="decision-room__basis" muted>
        <details>
          <summary>Decision Basis</summary>
          <div className="decision-room__basis-content">
            <dl className="decision-room__decision-meta">
              <div>
                <dt>Ruleset</dt>
                <dd>
                  {readModel.ruleset.rulesetId} / {readModel.ruleset.rulesetVersion}
                </dd>
              </div>
              <div>
                <dt>Source mode</dt>
                <dd>
                  {readModel.residentialStrategyResult?.eligible
                    ? "Deterministic strategy with compatibility Evidence"
                    : readModel.vacantLandStrategyResult?.eligible
                      ? "Deterministic land strategy with compatibility Evidence"
                    : "Deterministic compatibility"}
                </dd>
              </div>
              <div>
                <dt>Source freshness</dt>
                <dd>{readModel.sourceFreshness.state}</dd>
              </div>
              <div>
                <dt>Latest source timestamp</dt>
                <dd>
                  {formatSafeDate(
                    readModel.sourceFreshness.latestSourceTimestamp,
                    "Not available"
                  )}
                </dd>
              </div>
              <div>
                <dt>Classification field</dt>
                <dd>
                  {assetStrategyContext.classificationSource.sourceValues
                    .map((sourceValue) => sourceValue.field)
                    .join(", ") || "Not available"}
                </dd>
              </div>
              <div>
                <dt>Classification reason</dt>
                <dd>
                  {assetStrategyContext.classificationSource.reasonCode ||
                    "Not available"}
                </dd>
              </div>
              <div>
                <dt>Classification source</dt>
                <dd>{assetStrategyContext.classificationSource.label}</dd>
              </div>
              <div>
                <dt>Manual review required</dt>
                <dd>
                  {assetStrategyContext.manualReviewRequired ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt>Strategy support state</dt>
                <dd>{assetStrategyContext.strategySupportState}</dd>
              </div>
              <div>
                <dt>Strategy version</dt>
                <dd>{readModel.residentialStrategyResult?.strategyVersion || readModel.vacantLandStrategyResult?.strategyVersion || "Not available"}</dd>
              </div>
              <div>
                <dt>Pursuit Scoring Framework</dt>
                <dd>
                  {assetStrategyContext.pursuitScoring.frameworkAvailable
                    ? "Available"
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Production Strategy Profile</dt>
                <dd>
                  {assetStrategyContext.pursuitScoring
                    .productionProfileAvailable
                    ? assetStrategyContext.pursuitScoring.profileId
                    : "Not yet implemented"}
                </dd>
              </div>
              <div>
                <dt>Underwriting policy</dt>
                <dd>{readModel.residentialStrategyResult?.underwriting?.policyVersion || readModel.vacantLandStrategyResult?.valuation?.policyVersion || "Not available"}</dd>
              </div>
              <div>
                <dt>Scoring ruleset</dt>
                <dd>{readModel.residentialStrategyResult?.scoringRulesetVersion || readModel.vacantLandStrategyResult?.scoringRulesetVersion || "Not available"}</dd>
              </div>
              <div>
                <dt>Offer readiness capability</dt>
                <dd>{readModel.residentialStrategyResult?.capabilitySupport?.offerReadiness || readModel.vacantLandStrategyResult?.capabilitySupport?.offerReadiness || "Not available"}</dd>
              </div>
            </dl>
            <h3>Classification sources</h3>
            {assetStrategyContext.classificationSource.sourceValues.length ? (
              <ul className="decision-room__evidence-list">
                {assetStrategyContext.classificationSource.sourceValues.map(
                  (sourceValue) => (
                    <li key={`${sourceValue.field}:${sourceValue.rawValue}`}>
                      <strong>{sourceValue.field}</strong>
                      <span>Stored value: {sourceValue.rawValue}</span>
                      <span>
                        Mapped value: {sourceValue.mappedAssetType || "No canonical mapping"}
                      </span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p>No explicit asset classification value is stored on this record.</p>
            )}
            <h3>Evidence and Provenance</h3>
            {readModel.evidenceReferences.length ? (
              <ul className="decision-room__evidence-list">
                {readModel.evidenceReferences.map((entry) => (
                  <li key={entry.evidenceId}>
                    <strong>{entry.sourceSystem}</strong>
                    <span>
                      {entry.sourceType}
                      {entry.sourceField ? ` / ${entry.sourceField}` : ""}
                    </span>
                    <span>{entry.valueSummary || "Current field is present"}</span>
                    <span>
                      Source timestamp: {formatSafeDate(entry.sourceTimestamp, "Not available")};
                      verification: {entry.verificationState}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No source evidence is available for this compatibility record.</p>
            )}
            <h3>Classification conflicts</h3>
            {assetStrategyContext.classificationConflicts.length ? (
              <ul className="decision-room__evidence-list">
                {assetStrategyContext.classificationConflicts.map((conflict) => (
                  <li key={conflict.conflictId}>{conflict.summary}</li>
                ))}
              </ul>
            ) : (
              <p>No explicit classification conflicts were found.</p>
            )}
            <h3>Capability availability</h3>
            {assetStrategyContext.blockedCapabilityReasons.length ? (
              <ul className="decision-room__evidence-list">
                {assetStrategyContext.blockedCapabilityReasons.map((gate) => (
                  <li key={gate.capabilityId}>
                    <strong>{gate.capabilityId}</strong>
                    <span>{gate.explanation}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No registered residential capability is blocked by classification.</p>
            )}
            {readModel.residentialStrategyResult?.eligible ? (
              <>
                <h3>Residential Strategy assumptions</h3>
                <p>{readModel.residentialStrategyResult.underwriting?.assumptionDisclosure}</p>
                <p>{readModel.residentialStrategyResult.underwriting?.excludedCostDisclosure}</p>
              </>
            ) : null}
            {readModel.vacantLandStrategyResult?.eligible ? (
              <>
                <h3>Vacant Land Strategy basis</h3>
                <p>Valuation source: {readModel.vacantLandStrategyResult.valuation?.valuationSource || "Not available"}</p>
                <p>Valid stored land comps: {readModel.vacantLandStrategyResult.valuation?.comparableCount || 0}</p>
                <p>{readModel.vacantLandStrategyResult.valuation?.operatorDisclosure}</p>
              </>
            ) : null}
            {assetStrategyContext.compatibilityWarning ? (
              <p className="decision-room__partial-warning" role="status">
                {assetStrategyContext.compatibilityWarning}
              </p>
            ) : null}
            {assetStrategyContext.manualReviewRequired ? (
              <p className="decision-room__partial-warning" role="status">
                Update the CRM record through an approved persistent path before
                running strategy-specific analysis.
              </p>
            ) : null}
            {readModel.sourceWarnings.length ? (
              <div className="decision-room__source-warnings">
                <h3>Source warnings</h3>
                <ul>
                  {readModel.sourceWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </Card>
      <Card className="decision-room__ai-separation" muted>
        <SectionHeader
          description={
            insightGate.allowed
              ? "This existing optional panel remains separate from deterministic Residential Strategy underwriting and Pursuit Scoring."
              : "Asset classification controls whether the existing residential insight panel can run."
          }
          eyebrow={insightGate.allowed ? "Optional" : "Asset Strategy"}
          title={
            insightGate.allowed
              ? "AI-assisted insight"
              : "Residential analysis unavailable"
          }
        />
        {insightGate.allowed ? (
          <>
            <Badge>Optional AI - Not Used by Residential Strategy</Badge>
            <LazySection label="Loading existing insights...">
              <AIInsights deal={deal} />
            </LazySection>
          </>
        ) : (
          <StrategyCapabilityState
            gate={insightGate}
            onNavigateSection={onAction}
            title={assetStrategyContext.statusSummary}
          />
        )}
      </Card>
    </div>
  );
}

function SellerSection({ deal, refresh }) {
  return (
    <PanelSection
      description="Seller identity, ownership, tasking, and assignment context."
      title="Seller"
    >
      <FactGrid deal={deal} />
      <LazySection label="Loading seller tasks...">
        <TaskPanel deal={deal} refresh={refresh} />
      </LazySection>
      <LazySection label="Loading team assignment...">
        <TeamPanel deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

function PropertySection({
  assetStrategyContext,
  capabilityGates,
  deal,
  onNavigateSection,
  refresh,
  vacantLandStrategyResult,
}) {
  const blockedPropertyGate = [
    capabilityGates.propertyIntelligence,
    capabilityGates.comps,
  ].find((gate) => !gate.allowed);

  return (
    <PanelSection
      description="Property identity and classification, with compatible analysis when available."
      title={vacantLandStrategyResult?.eligible ? "Parcel" : "Property"}
    >
      <FactGrid deal={deal} />
      {vacantLandStrategyResult?.eligible ? (
        <LazySection label="Loading parcel strategy context...">
          <VacantLandStrategySummary compact result={vacantLandStrategyResult} />
        </LazySection>
      ) : !blockedPropertyGate ? (
        <>
          <Badge>Residential Property Intelligence - Compatibility Only</Badge>
          <LazySection label="Loading property intelligence...">
            <PropertyIntelligencePanel deal={deal} />
          </LazySection>
          <LazySection label="Loading comps...">
            <CompsEngine deal={deal} refresh={refresh} />
          </LazySection>
        </>
      ) : (
        <StrategyCapabilityState
          gate={blockedPropertyGate}
          onNavigateSection={onNavigateSection}
          title={assetStrategyContext.statusSummary}
        />
      )}
    </PanelSection>
  );
}

function NumbersSection({
  assetStrategyContext,
  capabilityGates,
  deal,
  onNavigateSection,
  refresh,
  residentialStrategyResult,
  vacantLandStrategyResult,
}) {
  const numbersGates = [
    capabilityGates.underwriting,
    capabilityGates.offerGeneration,
    capabilityGates.negotiationCalculations,
  ];
  const blockedGate = numbersGates.find((gate) => !gate.allowed);

  return (
    <PanelSection
      description="Asset-compatible underwriting, offer, and negotiation tools."
      title={vacantLandStrategyResult?.eligible ? "Land Analysis" : "Numbers"}
    >
      {vacantLandStrategyResult?.eligible ? (
        <LazySection label="Loading land valuation context...">
          <VacantLandStrategySummary result={vacantLandStrategyResult} />
        </LazySection>
      ) : !blockedGate ? (
        <>
          <Badge>Residential Acquisition Strategy v1</Badge>
          <LazySection label="Loading deal analyzer...">
            <DealAnalyzer deal={deal} refresh={refresh} />
          </LazySection>
          <LazySection label="Loading offer engine...">
            <OfferEngine deal={deal} strategyResult={residentialStrategyResult} />
          </LazySection>
          <Badge>Negotiation Tracking - Compatibility Only</Badge>
          <LazySection label="Loading negotiation tracker...">
            <NegotiationTracker deal={deal} refresh={refresh} />
          </LazySection>
        </>
      ) : (
        <StrategyCapabilityState
          gate={blockedGate}
          onNavigateSection={onNavigateSection}
          title={assetStrategyContext.statusSummary}
        />
      )}
    </PanelSection>
  );
}

function CommunicationSection({ deal, selectedPhone }) {
  return (
    <PanelSection
      description="Seller messages and follow-up sequencing."
      title="Communication"
    >
      <LazySection label="Loading messages...">
        <MessageCenter deal={deal} />
      </LazySection>
      <LazySection label="Loading follow-up sequence...">
        <SequenceEngine deal={deal} />
      </LazySection>
      <LazySection label="Loading seller activity...">
        <ActivityTimeline deal={deal} selectedPhone={selectedPhone} />
      </LazySection>
    </PanelSection>
  );
}

function ActivitySection({ deal, onOpenContext, refresh }) {
  return (
    <PanelSection
      description="Activity, ownership, and follow-up operating history."
      title="Activity"
    >
      <LazySection label="Loading activity timeline...">
        <DealTimeline deal={deal} onOpenContext={onOpenContext} />
      </LazySection>
      <LazySection label="Loading task panel...">
        <TaskPanel deal={deal} refresh={refresh} />
      </LazySection>
      <LazySection label="Loading team panel...">
        <TeamPanel deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

function DocumentsSection({ deal }) {
  return (
    <PanelSection
      description="Document storage and existing contract-preparation checklist."
      title="Documents"
    >
      <LazySection label="Loading document prep...">
        <DocumentContractPrepPanel deal={deal} />
      </LazySection>
      <LazySection label="Loading document vault...">
        <DocumentVault deal={deal} />
      </LazySection>
    </PanelSection>
  );
}

function ClosingSection({
  assetStrategyContext,
  capabilityGates,
  deal,
  onNavigateSection,
  refresh,
  residentialStrategyResult,
}) {
  const buyerGates = [
    capabilityGates.buyerMatching,
    capabilityGates.buyerBlast,
  ];
  const blockedBuyerGate = buyerGates.find((gate) => !gate.allowed);

  return (
    <PanelSection
      description="Compatible buyer disposition tools and generic operational closeout records."
      title="Closing"
    >
      {!blockedBuyerGate ? (
        <>
          <Badge>Residential Buyer Tools - Compatibility Only</Badge>
          <LazySection label="Loading buyer matches...">
            <BuyerMatches deal={deal} />
          </LazySection>
          <LazySection label="Loading buyer blast...">
            <BuyerBlast deal={deal} strategyResult={residentialStrategyResult} />
          </LazySection>
        </>
      ) : (
        <StrategyCapabilityState
          gate={blockedBuyerGate}
          onNavigateSection={onNavigateSection}
          title={assetStrategyContext.statusSummary}
        />
      )}
      <Badge>Generic Closeout Records</Badge>
      <LazySection label="Loading closeout...">
        <CloseoutPanel deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

// New component reason: the existing DealModal has the right business panels,
// but cannot provide route-level navigation, breadcrumbs, or section ownership.
export default function DealDecisionRoom({
  currentPath = "",
  decisionContext = EMPTY_DECISION_CONTEXT,
  deals = [],
  loading = false,
  onNavigateWorkspace,
  refresh,
  selectedPhone,
  setSelectedPhone,
}) {
  const [activeSection, setActiveSection] = useState("decision");
  const deal = useMemo(() => findDealByRoute(deals, currentPath), [currentPath, deals]);
  const decisionResult = useMemo(
    () =>
      deal
        ? buildCompatibilityDecisionReadModel({
            ...decisionContext,
            deal,
          })
        : null,
    [deal, decisionContext]
  );
  const assetStrategyContext = useMemo(() => {
    if (decisionResult?.success) {
      return decisionResult.data.assetStrategyContext;
    }
    return deal ? buildAssetStrategyContext(deal) : null;
  }, [deal, decisionResult]);
  const capabilityGates = useMemo(
    () => getDecisionRoomCapabilityGates(assetStrategyContext),
    [assetStrategyContext]
  );

  function handlePrimaryAction(action) {
    if (action === "conversation") {
      const phone = getPhone(deal);
      if (phone) setSelectedPhone?.(phone);
      if (onNavigateWorkspace) {
        onNavigateWorkspace("inbox");
      } else {
        setActiveSection("communication");
      }
      return;
    }

    if (SECTION_IDS.includes(action)) {
      setActiveSection(action);
    }
  }

  function handleTimelineContext(event) {
    const action = event?.availableActions?.[0];
    if (!action) return;

    if (action.targetWorkspace === "inbox") {
      const phone = event.sellerReference?.phone || getPhone(deal);
      if (phone) setSelectedPhone?.(phone);
      onNavigateWorkspace?.("inbox");
      return;
    }

    if (
      action.targetWorkspace &&
      action.targetWorkspace !== "deal-decision-room"
    ) {
      onNavigateWorkspace?.(action.targetWorkspace);
      return;
    }

    if (SECTION_IDS.includes(action.targetSection)) {
      setActiveSection(action.targetSection);
    }
  }

  if (loading) {
    return (
      <section className="workspace decision-room">
        <PageHeader description="Loading the selected opportunity." title="Deal Decision Room" />
        <Card>Loading deal...</Card>
      </section>
    );
  }

  if (!deal) {
    return (
      <section className="workspace decision-room">
        <PageHeader
          actions={
            <Button onClick={() => onNavigateWorkspace?.("deals")} variant="secondary">
              Back to Deals
            </Button>
          }
          description="The requested deal route does not match a currently loaded deal."
          title="Deal not found"
        />
        <ErrorState
          description="Refresh deal data or return to Deals to choose an available record."
          title="Unable to open Decision Room"
        />
      </section>
    );
  }

  const address = getDealAliasText(deal, "address") || "Unknown property";
  const seller = getDealAliasText(deal, "ownerName") || "Unknown seller";
  const stage = getDealAliasText(deal, "stage") || "New Lead";
  const decisionReadModel = decisionResult?.success ? decisionResult.data : null;
  const readiness = decisionReadModel?.metricsById["offer-readiness"];
  const missingCount =
    decisionReadModel?.missingInformationReadModel?.counts?.open || 0;

  function renderActiveSection(sectionId) {
    if (sectionId !== activeSection) return null;

    if (sectionId === "decision") {
      return (
        <DecisionOverview
          deal={deal}
          decisionResult={decisionResult}
          onAction={handlePrimaryAction}
          onNavigateWorkspace={onNavigateWorkspace}
        />
      );
    }

    if (sectionId === "seller") return <SellerSection deal={deal} refresh={refresh} />;
    if (sectionId === "property") {
      return (
        <PropertySection
          assetStrategyContext={assetStrategyContext}
          capabilityGates={capabilityGates}
          deal={deal}
          onNavigateSection={handlePrimaryAction}
          refresh={refresh}
          vacantLandStrategyResult={decisionReadModel?.vacantLandStrategyResult}
        />
      );
    }
    if (sectionId === "numbers") {
      return (
        <NumbersSection
          assetStrategyContext={assetStrategyContext}
          capabilityGates={capabilityGates}
          deal={deal}
          onNavigateSection={handlePrimaryAction}
          refresh={refresh}
          residentialStrategyResult={decisionReadModel?.residentialStrategyResult}
          vacantLandStrategyResult={decisionReadModel?.vacantLandStrategyResult}
        />
      );
    }
    if (sectionId === "communication") return <CommunicationSection deal={deal} selectedPhone={selectedPhone} />;
    if (sectionId === "activity") {
      return (
        <ActivitySection
          deal={deal}
          onOpenContext={handleTimelineContext}
          refresh={refresh}
        />
      );
    }
    if (sectionId === "documents") return <DocumentsSection deal={deal} />;

    return (
      <ClosingSection
        assetStrategyContext={assetStrategyContext}
        capabilityGates={capabilityGates}
        deal={deal}
        onNavigateSection={handlePrimaryAction}
        refresh={refresh}
        residentialStrategyResult={decisionReadModel?.residentialStrategyResult}
      />
    );
  }

  const tabs = SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    label:
      assetStrategyContext?.landStrategyEligibility && sectionId === "property"
        ? "Parcel"
        : assetStrategyContext?.landStrategyEligibility && sectionId === "numbers"
          ? "Land Analysis"
          : SECTION_LABELS[sectionId],
    content: renderActiveSection(sectionId),
  }));

  return (
    <section className="workspace decision-room">
      <PageHeader
        actions={
          <Button onClick={() => onNavigateWorkspace?.("deals")} variant="secondary">
            Back to Deals
          </Button>
        }
        description="One guided workspace for deciding, communicating, and moving this opportunity forward."
        eyebrow="Deals / Decision Room"
        title={address}
      />
      <nav aria-label="Breadcrumb" className="decision-room__breadcrumb">
        <button onClick={() => onNavigateWorkspace?.("deals")} type="button">
          Deals
        </button>
        <span aria-hidden="true">/</span>
        <span>{address}</span>
      </nav>

      <Card className="decision-room__hero">
        <div>
          <h2>{address}</h2>
          <p>{seller}</p>
        </div>
        <div className="decision-room__hero-badges">
          <StatusBadge status="info">{stage}</StatusBadge>
          {readiness?.evaluationState === "evaluated" ? (
            <StatusBadge status={readiness.value === "ready-for-offer-preparation" ? "success" : "warning"}>
              {readiness.displayValue}
            </StatusBadge>
          ) : null}
          {assetStrategyContext ? (
            <StatusBadge
              status={
                STRATEGY_SUPPORT_STATUS[
                  assetStrategyContext.strategySupportState
                ] || "neutral"
              }
            >
              {assetStrategyContext.statusSummary}
            </StatusBadge>
          ) : null}
          {decisionReadModel ? <Badge>{missingCount} information needs</Badge> : null}
        </div>
      </Card>

      {deals.length === 0 ? (
        <EmptyState
          description="No deal records are loaded, so the Decision Room cannot resolve this route."
          title="No deals loaded"
        />
      ) : (
        <Card className="decision-room__tabs">
          <Tabs
            activeId={activeSection}
            ariaLabel="Deal Decision Room sections"
            onChange={setActiveSection}
            tabs={tabs}
          />
        </Card>
      )}
    </section>
  );
}
