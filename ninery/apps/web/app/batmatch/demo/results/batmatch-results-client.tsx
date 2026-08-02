"use client";

import { useCallback, useEffect, useState } from "react";
import { getDemoRecommendation } from "../../../../lib/batmatch/recommendation-api";
import { hasRecommendationContent } from "../../../../lib/batmatch/recommendation-adapter";
import { recommendationCtaLabels } from "../../../../lib/batmatch/recommendation-copy";
import type { DecisionConversation } from "../../../../lib/batmatch/decision-conversation-types";
import type { RecommendationCardViewModel, RecommendationResultsViewModel } from "../../../../lib/batmatch/recommendation-types";
import styles from "./batmatch-results.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; data: RecommendationResultsViewModel }
  | { status: "error"; message: string };

export function BatMatchResultsClient() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadRecommendation = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await getDemoRecommendation();
      setState({ status: "loaded", data });
    } catch {
      setState({ status: "error", message: "We couldn't load this recommendation." });
    }
  }, []);

  useEffect(() => {
    void loadRecommendation();
  }, [loadRecommendation]);

  if (state.status === "loading") return <RecommendationLoadingState />;
  if (state.status === "error") {
    return <RecommendationErrorState message={state.message} onRetry={loadRecommendation} />;
  }
  if (!hasRecommendationContent(state.data)) return <RecommendationEmptyState onRetry={loadRecommendation} />;

  return <RecommendationResultsContent viewModel={state.data} onRefresh={loadRecommendation} />;
}

export function RecommendationResultsContent({
  viewModel,
  onRefresh
}: Readonly<{
  viewModel: RecommendationResultsViewModel;
  onRefresh: () => void;
}>) {
  const [fullExplanationOpen, setFullExplanationOpen] = useState(false);
  const [playerDnaOpen, setPlayerDnaOpen] = useState(false);
  const [expandedAlternativeId, setExpandedAlternativeId] = useState<string | null>(null);
  const primary = viewModel.primaryRecommendation;

  if (!primary) return <RecommendationEmptyState onRetry={onRefresh} />;

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="results-title">
        <div>
          <p className={styles.kicker}>BatMatch Demo</p>
          <h1 id="results-title">BatMatch Results</h1>
          <p className={styles.context}>
            Based on {viewModel.player.firstName ?? viewModel.player.name}&apos;s profile, current bat, competition level,
            and BatMatch responses.
          </p>
        </div>
        <div className={styles.playerPanel} aria-label="Player context">
          <span>{viewModel.player.name}</span>
          <strong>{viewModel.player.displayContext}</strong>
          {viewModel.player.currentBatParts.length > 0 ? (
            <small>
              <span>Current bat</span>
              {viewModel.player.currentBatParts.join(" - ")}
            </small>
          ) : null}
        </div>
      </section>

      <section className={styles.resultsGrid} aria-label="Recommendation results">
        <PrimaryRecommendationCard
          recommendation={primary}
          reassurance={viewModel.reassurance}
          decisionConversation={viewModel.decisionConversation}
          expanded={fullExplanationOpen}
          onToggle={() => setFullExplanationOpen((open) => !open)}
        />

        <aside className={styles.sideColumn} aria-label="Recommendation context">
          <ConfidencePanel confidence={viewModel.overallConfidence} traceSummary={viewModel.traceSummary} />
          <DecisionSnapshot rows={viewModel.decisionSnapshot} />
          <MissingInformationPanel missingInformation={viewModel.missingInformation} />
        </aside>
      </section>

      <section className={styles.section} aria-labelledby="alternatives-title">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Other strong options</p>
          <h2 id="alternatives-title">Also Worth Considering</h2>
        </div>
        {viewModel.alternatives.length > 0 ? (
          <div className={styles.alternatives}>
            {viewModel.alternatives.map((alternative) => (
              <AlternativeRecommendationCard
                key={alternative.id}
                recommendation={alternative}
                expanded={expandedAlternativeId === alternative.id}
                onToggle={() =>
                  setExpandedAlternativeId((current) => (current === alternative.id ? null : alternative.id))
                }
              />
            ))}
          </div>
        ) : (
          <p className={styles.softText}>No alternative bats were returned for this demo run.</p>
        )}
      </section>

      <PlayerDNASummary
        playerFirstName={viewModel.player.firstName}
        groups={viewModel.playerDNAGroups}
        additionalAttributes={viewModel.additionalPlayerDNA}
        expanded={playerDnaOpen}
        onToggle={() => setPlayerDnaOpen((open) => !open)}
      />

      <section className={styles.trustStatement} aria-labelledby="trust-title">
        <div>
          <p className={styles.kicker}>Trust first</p>
          <h2 id="trust-title">Why Parents Can Trust Ninery</h2>
          <p>
            Every recommendation is built using player characteristics, equipment data, league requirements, and
            development goals. Ninery explains every recommendation so families understand not only what is recommended,
            but why.
          </p>
        </div>
        <button type="button" onClick={onRefresh}>
          {recommendationCtaLabels.runDemo}
        </button>
      </section>
    </main>
  );
}

function PrimaryRecommendationCard({
  recommendation,
  reassurance,
  decisionConversation,
  expanded,
  onToggle
}: Readonly<{
  recommendation: RecommendationCardViewModel;
  reassurance: RecommendationResultsViewModel["reassurance"];
  decisionConversation: DecisionConversation;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const summaryReasons = [
    decisionConversation.recommendationSummary.primaryReason,
    ...decisionConversation.recommendationSummary.supportingReasons
  ];
  const visibleReasons = expanded ? summaryReasons : summaryReasons.slice(0, 3);

  return (
    <article className={styles.primaryCard} aria-labelledby="best-match-title">
      <div className={styles.cardTopline}>
        <span className={styles.badge}>Your Best Match</span>
        {recommendation.leagueApprovalLabel ? <span className={styles.legalBadge}>{recommendation.leagueApprovalLabel}</span> : null}
      </div>
      <div className={styles.recommendationHero}>
        <div>
          <p className={styles.brand}>{recommendation.brand}</p>
          <h2 id="best-match-title">{recommendation.displayName}</h2>
          {recommendation.size ? <p className={styles.sizeLine}>{recommendation.size}</p> : null}
        </div>
        <div className={styles.heroScoreGroup}>
          <RecommendationScore recommendation={recommendation} />
          {recommendation.heroRecommendationCopy ? <p>{recommendation.heroRecommendationCopy}</p> : null}
        </div>
      </div>
      {recommendation.matchContext ? <p className={styles.matchContext}>{recommendation.matchContext}</p> : null}

      <section className={styles.reassurance} aria-labelledby="reassurance-title">
        <div>
          <h3 id="reassurance-title">Why You Can Feel Confident</h3>
          <strong>{reassurance.lead}</strong>
          <p>{reassurance.body}</p>
        </div>
      </section>

      <section className={styles.whyChosen} aria-labelledby="why-chosen-title">
        <h3 id="why-chosen-title">{decisionConversation.recommendationSummary.heading}</h3>
        <p>{decisionConversation.recommendationSummary.summary}</p>
      </section>

      <div className={styles.metrics} aria-label="Match and confidence explanations">
        <div>
          <span>Match Score</span>
          <strong>How closely this bat fits</strong>
          <small>Based on current needs, goals, equipment preferences, and league requirements.</small>
        </div>
        <div>
          <span>League Requirement</span>
          <strong>{recommendation.leagueApprovalLabel ?? "Confirm league rules"}</strong>
          <small>Equipment eligibility is checked before performance fit. Families should still confirm local league and tournament rules.</small>
        </div>
      </div>

      <RecommendationReasons title="Primary Reason" reasons={visibleReasons} />

      <DecisionConversationPreview conversation={decisionConversation} />

      <button
        className={styles.textButton}
        type="button"
        aria-expanded={expanded}
        aria-controls="full-recommendation-explanation"
        onClick={onToggle}
      >
        {expanded ? recommendationCtaLabels.hideAnalysis : recommendationCtaLabels.showAnalysis}
      </button>

      <div id="full-recommendation-explanation" hidden={!expanded}>
        <DecisionConversationDetails conversation={decisionConversation} />
      </div>
    </article>
  );
}

function DecisionSnapshot({ rows }: Readonly<{ rows: RecommendationResultsViewModel["decisionSnapshot"] }>) {
  if (rows.length === 0) return null;

  return (
    <section className={styles.contextCard} aria-labelledby="decision-snapshot-title">
      <p className={styles.kicker}>Decision Snapshot</p>
      <h2 id="decision-snapshot-title">Decision Snapshot</h2>
      <dl className={styles.snapshotList}>
        {rows.slice(0, 5).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DecisionConversationPreview({ conversation }: Readonly<{ conversation: DecisionConversation }>) {
  const topTradeoff = conversation.tradeoffSummary.compromises[0] ?? conversation.tradeoffSummary.summary;

  return (
    <section className={styles.conversationPreview} aria-labelledby="conversation-preview-title">
      <h3 id="conversation-preview-title">Decision Conversation</h3>
      <div>
        <span>Confidence</span>
        <strong>{conversation.confidenceExplanation.label}</strong>
      </div>
      <div>
        <span>Top Tradeoff</span>
        <p>{topTradeoff}</p>
      </div>
      <div>
        <span>Future Guidance</span>
        <p>{conversation.futureGuidance.summary}</p>
      </div>
    </section>
  );
}

function DecisionConversationDetails({ conversation }: Readonly<{ conversation: DecisionConversation }>) {
  return (
    <section className={styles.conversationDetails} aria-labelledby="complete-analysis-title">
      <h3 id="complete-analysis-title">Complete Analysis</h3>
      <NarrativeBlock title={conversation.playerFit.heading} body={conversation.playerFit.summary} />
      <EvidenceList title="Strengths Used" items={conversation.playerFit.strengthsUsed} />
      <EvidenceList title="Developing Areas Supported" items={conversation.playerFit.developingAreasSupported} />
      <NarrativeBlock title={conversation.tradeoffSummary.heading} body={conversation.tradeoffSummary.summary} />
      <TextList title="Expected Benefits" items={conversation.tradeoffSummary.expectedBenefits} />
      <TextList
        title="Compromises"
        items={conversation.tradeoffSummary.compromises}
        emptyText="No major compromise was identified from the information currently available."
      />
      <TextList title="Unknowns" items={conversation.tradeoffSummary.unknowns ?? []} />
      {conversation.alternativeExplanations.length > 0 ? (
        <section className={styles.narrativeBlock} aria-labelledby="alternative-explanations-title">
          <h4 id="alternative-explanations-title">Why Alternatives Ranked Lower</h4>
          <div className={styles.alternativeExplanations}>
            {conversation.alternativeExplanations.map((alternative) => (
              <article key={alternative.equipmentId}>
                <span>{alternative.matchLabel}</span>
                <h5>{alternative.equipmentName}</h5>
                <p>{alternative.summary}</p>
                <p>
                  <strong>Why it is strong:</strong> {alternative.whyItIsStrong}
                </p>
                <p>
                  <strong>Why it was not selected:</strong> {alternative.whyItWasNotSelected}
                </p>
                {alternative.bestFor ? (
                  <p>
                    <strong>Best for:</strong> {alternative.bestFor}
                  </p>
                ) : null}
                {alternative.reconsiderWhen ? (
                  <p>
                    <strong>Reconsider when:</strong> {alternative.reconsiderWhen}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <NarrativeBlock title={conversation.confidenceExplanation.heading} body={conversation.confidenceExplanation.summary} />
      <EvidenceList title="Supporting Evidence" items={conversation.confidenceExplanation.supportingEvidence} />
      <EvidenceList
        title="Limiting Factors"
        items={conversation.confidenceExplanation.limitingFactors}
        emptyText="No major limiting factor was identified from the current information."
      />
      <NarrativeBlock title={conversation.futureGuidance.heading} body={conversation.futureGuidance.summary} />
      <EvidenceList title="Keep Doing" items={conversation.futureGuidance.keepDoing} />
      <EvidenceList title="Watch For" items={conversation.futureGuidance.watchFor} />
      <ReassessmentList items={conversation.futureGuidance.reassessWhen} />
      {conversation.futureGuidance.longTermOutlook ? <p className={styles.smallNote}>{conversation.futureGuidance.longTermOutlook}</p> : null}
      {conversation.uncertaintyDisclosure ? (
        <section className={styles.narrativeBlock} aria-labelledby="uncertainty-title">
          <h4 id="uncertainty-title">{conversation.uncertaintyDisclosure.heading}</h4>
          <p>{conversation.uncertaintyDisclosure.summary}</p>
          <TextList title="Missing Information" items={conversation.uncertaintyDisclosure.missingInformation} />
          {conversation.uncertaintyDisclosure.closeDecisionExplanation ? <p>{conversation.uncertaintyDisclosure.closeDecisionExplanation}</p> : null}
        </section>
      ) : null}
    </section>
  );
}

function NarrativeBlock({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <section className={styles.narrativeBlock}>
      <h4>{title}</h4>
      <p>{body}</p>
    </section>
  );
}

function EvidenceList({
  title,
  items,
  emptyText
}: Readonly<{ title: string; items: Array<{ label: string; explanation: string }>; emptyText?: string }>) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <section className={styles.narrativeBlock}>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul className={styles.evidenceList}>
          {items.map((item) => (
            <li key={`${title}-${item.label}`}>
              <strong>{item.label}</strong>
              <span>{item.explanation}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function TextList({ title, items, emptyText }: Readonly<{ title: string; items: string[]; emptyText?: string }>) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <section className={styles.narrativeBlock}>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function ReassessmentList({ items }: Readonly<{ items: DecisionConversation["futureGuidance"]["reassessWhen"] }>) {
  return (
    <section className={styles.narrativeBlock}>
      <h4>Reassess When</h4>
      <ul className={styles.evidenceList}>
        {items.map((item) => (
          <li key={item.type}>
            <strong>{item.label}</strong>
            <span>{item.explanation}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlternativeRecommendationCard({
  recommendation,
  expanded,
  onToggle
}: Readonly<{
  recommendation: RecommendationCardViewModel;
  expanded: boolean;
  onToggle: () => void;
}>) {
  return (
    <article className={styles.alternativeCard}>
      <div className={styles.altHeader}>
        <div>
          <p className={styles.brand}>{recommendation.brand}</p>
          <h3>{recommendation.model}</h3>
          {recommendation.size ? <p>{recommendation.size}</p> : null}
        </div>
        <RecommendationScore recommendation={recommendation} compact />
      </div>
      <p>{recommendation.summary}</p>
      <button className={styles.textButton} type="button" aria-expanded={expanded} onClick={onToggle}>
        {expanded ? "Hide ranking details" : "See Why It Ranked"}
      </button>
      {expanded ? <RecommendationReasons title="Why it ranked" reasons={recommendation.reasons.slice(0, 3)} /> : null}
    </article>
  );
}

function RecommendationScore({
  recommendation,
  compact = false
}: Readonly<{ recommendation: RecommendationCardViewModel; compact?: boolean }>) {
  const scoreText = recommendation.matchPresentation ? `${recommendation.matchPresentation.roundedScore} / 100` : "Score unavailable";
  const label = recommendation.matchPresentation?.label ?? "Match score unavailable";

  return (
    <div className={compact ? styles.scoreCompact : styles.scoreBlock} aria-label={`${scoreText}: ${label}`}>
      <strong>{scoreText}</strong>
      <span>{label}</span>
    </div>
  );
}

function RecommendationReasons({ title, reasons }: Readonly<{ title: string; reasons: string[] }>) {
  if (reasons.length === 0) return null;
  return (
    <section className={styles.reasonBlock} aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>
      <h3 id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h3>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}

function RecommendationTradeoffs({ tradeoffs }: Readonly<{ tradeoffs: string[] }>) {
  return (
    <section className={styles.tradeoffs} aria-labelledby="tradeoffs-title">
      <h3 id="tradeoffs-title">Tradeoffs to Consider</h3>
      {tradeoffs.length > 0 ? (
        <ul>
          {tradeoffs.map((tradeoff) => (
            <li key={tradeoff}>{tradeoff}</li>
          ))}
        </ul>
      ) : (
        <p>No major tradeoffs were returned for this demo recommendation. Final size should still be validated before purchase.</p>
      )}
    </section>
  );
}

function ConfidencePanel({
  confidence,
  traceSummary
}: Readonly<{
  confidence?: RecommendationResultsViewModel["overallConfidence"];
  traceSummary?: RecommendationResultsViewModel["traceSummary"];
}>) {
  return (
    <section className={styles.contextCard} aria-labelledby="confidence-title">
      <p className={styles.kicker}>Recommendation confidence</p>
      <h2 id="confidence-title">How Confident Is Ninery?</h2>
      <strong>{confidence?.label ?? "Confidence unavailable"}</strong>
      {confidence?.score !== undefined ? <small>{confidence.score} confidence score</small> : null}
      {confidence?.explanation ? <p>{confidence.explanation}</p> : null}
      <p className={styles.smallNote}>
        Confidence reflects the amount and quality of player and equipment information available. It is not another fit score.
      </p>
      {traceSummary ? (
        <p className={styles.smallNote}>
          {traceSummary.eligibleCount ?? 0} eligible bats reviewed
          {traceSummary.filteredCount !== undefined ? `, ${traceSummary.filteredCount} filtered out` : ""}.
        </p>
      ) : null}
    </section>
  );
}

export function MissingInformationPanel({ missingInformation }: Readonly<{ missingInformation: string[] }>) {
  if (missingInformation.length === 0) return null;
  return (
    <section className={styles.contextCard} aria-labelledby="missing-info-title">
      <p className={styles.kicker}>Improve the recommendation</p>
      <h2 id="missing-info-title">Help Ninery Improve This Recommendation</h2>
      <ul>
        {missingInformation.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function PlayerDNASummary({
  playerFirstName,
  groups,
  additionalAttributes,
  expanded,
  onToggle
}: Readonly<{
  playerFirstName?: string;
  groups: RecommendationResultsViewModel["playerDNAGroups"];
  additionalAttributes: RecommendationResultsViewModel["additionalPlayerDNA"];
  expanded: boolean;
  onToggle: () => void;
}>) {
  const title = playerFirstName ? `What Ninery Learned About ${playerFirstName}` : "What Ninery Learned About This Player";

  return (
    <section className={styles.section} aria-labelledby="player-dna-title">
      <div className={styles.sectionHeader}>
        <p className={styles.kicker}>Player before brand</p>
        <h2 id="player-dna-title">{title}</h2>
      </div>
      <div className={styles.dnaStoryGrid}>
        {groups.map((group) => (
          <article className={styles.dnaStoryGroup} key={group.key}>
            <h3>{group.title}</h3>
            <div className={styles.dnaCardList}>
              {group.attributes.map((attribute) => (
                <PlayerDNAAttributeCard attribute={attribute} key={attribute.key} />
              ))}
            </div>
          </article>
        ))}
      </div>
      {expanded && additionalAttributes.length > 0 ? (
        <div className={styles.dnaDetailsGrid}>
          {additionalAttributes.map((attribute) => (
            <PlayerDNAAttributeCard attribute={attribute} key={attribute.key} />
          ))}
        </div>
      ) : null}
      {additionalAttributes.length > 0 ? (
        <button className={styles.textButton} type="button" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? "Hide player details" : "Show more player details"}
        </button>
      ) : null}
    </section>
  );
}

function PlayerDNAAttributeCard({
  attribute
}: Readonly<{ attribute: RecommendationResultsViewModel["playerDNA"][number] }>) {
  return (
    <article className={styles.dnaCard}>
      <span>{attribute.label}</span>
      {attribute.score !== undefined ? <strong>{attribute.score}</strong> : null}
      {attribute.confidence ? <small>{attribute.confidence} confidence</small> : null}
      {attribute.summary ? <p>{attribute.summary}</p> : null}
    </article>
  );
}

export function RecommendationLoadingState() {
  return (
    <main className={styles.page} aria-busy="true">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>BatMatch Demo</p>
          <h1>Building the player&apos;s recommendation...</h1>
          <p className={styles.context}>Reviewing player fit, confidence, and league requirements.</p>
        </div>
        <div className={`${styles.playerPanel} ${styles.skeleton}`} />
      </section>
      <section className={styles.resultsGrid}>
        <div className={`${styles.primaryCard} ${styles.skeletonCard}`} />
        <div className={styles.sideColumn}>
          <div className={`${styles.contextCard} ${styles.skeletonCard}`} />
          <div className={`${styles.contextCard} ${styles.skeletonCard}`} />
        </div>
      </section>
    </main>
  );
}

export function RecommendationErrorState({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <main className={styles.page}>
      <section className={styles.statePanel} role="alert">
        <p className={styles.kicker}>Recommendation unavailable</p>
        <h1>{message}</h1>
        <p>Confirm that the Ninery API is running on port 3001, then try again.</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    </main>
  );
}

export function RecommendationEmptyState({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main className={styles.page}>
      <section className={styles.statePanel}>
        <p className={styles.kicker}>More player context needed</p>
        <h1>We need a little more player information before we can recommend a bat.</h1>
        <p>Run the demo seed again or complete more BatMatch answers to improve the recommendation.</p>
        <button type="button" onClick={onRetry}>
          {recommendationCtaLabels.runDemo}
        </button>
      </section>
    </main>
  );
}
