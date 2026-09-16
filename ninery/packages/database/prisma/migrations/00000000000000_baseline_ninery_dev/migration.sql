-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FamilyMemberRole" AS ENUM ('owner', 'guardian', 'viewer');

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('baseball', 'softball');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "Handedness" AS ENUM ('left', 'right');

-- CreateEnum
CREATE TYPE "BattingSide" AS ENUM ('left', 'right', 'switch');

-- CreateEnum
CREATE TYPE "CompetitionLevel" AS ENUM ('recreational', 'school', 'travel', 'elite', 'unknown');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('bat', 'glove', 'cleat', 'helmet', 'catcher_gear');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('active', 'coming_soon', 'legacy', 'archived');

-- CreateEnum
CREATE TYPE "EquipmentCertification" AS ENUM ('USA', 'USSSA', 'BBCOR', 'none', 'unknown');

-- CreateEnum
CREATE TYPE "CertificationLevel" AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- CreateEnum
CREATE TYPE "DNAProfileStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('internal_review', 'manufacturer_specs', 'field_testing', 'validated_outcomes');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('low', 'medium', 'high', 'validated');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('manufacturer_specs', 'internal_review', 'third_party_review', 'field_testing', 'user_feedback', 'performance_data', 'validated_outcomes');

-- CreateEnum
CREATE TYPE "EvidenceReliability" AS ENUM ('low', 'medium', 'high', 'verified');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('collected', 'in_review', 'approved', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "EquipmentFitType" AS ENUM ('player_stage', 'swing_profile', 'opportunity_profile', 'preference', 'transition');

-- CreateEnum
CREATE TYPE "ComparisonConfidence" AS ENUM ('low', 'medium', 'high', 'validated');

-- CreateEnum
CREATE TYPE "PlayerDNAProfileStatus" AS ENUM ('generated', 'archived');

-- CreateEnum
CREATE TYPE "PreferredSwingFeel" AS ENUM ('light', 'balanced', 'slightly_end_loaded', 'end_loaded', 'unknown');

-- CreateEnum
CREATE TYPE "DevelopmentStage" AS ENUM ('foundation', 'developing', 'competitive', 'performance', 'advanced');

-- CreateEnum
CREATE TYPE "PrimaryHittingGoal" AS ENUM ('improve_contact', 'improve_power', 'improve_bat_control', 'increase_swing_speed', 'build_confidence', 'prepare_for_transition', 'maintain_current_fit', 'unknown');

-- CreateEnum
CREATE TYPE "GrowthStatus" AS ENUM ('stable', 'moderate_growth', 'rapid_growth', 'insufficient_data');

-- CreateEnum
CREATE TYPE "ProfileConfidenceLevel" AS ENUM ('low', 'medium', 'high', 'validated');

-- CreateEnum
CREATE TYPE "PlayerTimelineEventType" AS ENUM ('player_created', 'profile_updated', 'growth_measurement_added', 'equipment_added', 'batmatch_started', 'batmatch_completed', 'player_dna_generated', 'recommendation_generated', 'decision_book_created', 'outcome_recorded', 'milestone_added');

-- CreateEnum
CREATE TYPE "PlatformEventType" AS ENUM ('user_registered', 'family_created', 'player_created', 'player_profile_updated', 'growth_measurement_added', 'equipment_created', 'equipment_dna_published', 'batmatch_started', 'batmatch_answer_submitted', 'batmatch_completed', 'player_dna_generated', 'recommendation_generated', 'decision_book_created', 'decision_book_shared', 'ai_response_generated', 'outcome_recorded');

-- CreateEnum
CREATE TYPE "ReferenceDataType" AS ENUM ('manufacturer', 'position', 'competition_level', 'certification', 'equipment_category', 'development_stage');

-- CreateEnum
CREATE TYPE "BatMatchSessionStatus" AS ENUM ('started', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "BatMatchSessionType" AS ENUM ('first_batmatch', 'follow_up', 'growth_review', 'annual_review');

-- CreateEnum
CREATE TYPE "BatMatchSection" AS ENUM ('player_goals', 'current_equipment', 'swing_feel', 'performance_confidence', 'development_growth', 'preferences');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('single_select', 'multi_select', 'text', 'number', 'boolean', 'scale');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('draft', 'generated', 'accepted', 'dismissed', 'archived');

-- CreateEnum
CREATE TYPE "DecisionBookStatus" AS ENUM ('draft', 'generated', 'shared', 'archived');

-- CreateEnum
CREATE TYPE "DecisionBookSectionType" AS ENUM ('cover', 'executive_summary', 'about_player', 'what_we_learned', 'opportunity_profiles', 'equipment_readiness', 'recommended_equipment', 'why_this_recommendation', 'equipment_dna', 'tradeoffs', 'alternatives', 'development_roadmap', 'next_steps', 'ai_assistant');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "FamilyMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickname" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "graduationYear" INTEGER,
    "sport" "Sport" NOT NULL,
    "photoUrl" TEXT,
    "status" "PlayerStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "throwingHand" "Handedness",
    "battingSide" "BattingSide",
    "primaryPosition" TEXT,
    "secondaryPosition" TEXT,
    "competitionLevel" "CompetitionLevel" NOT NULL DEFAULT 'unknown',
    "teamName" TEXT,
    "practiceFrequency" TEXT,
    "experienceYears" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_measurements" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "confidence" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelYear" INTEGER,
    "category" "EquipmentCategory" NOT NULL,
    "certification" "EquipmentCertification" NOT NULL DEFAULT 'unknown',
    "material" TEXT,
    "construction" TEXT,
    "barrelDiameter" DECIMAL(4,2),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_variants" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "lengthInches" DECIMAL(4,1),
    "weightOunces" DECIMAL(4,1),
    "dropWeight" INTEGER,
    "msrp" DECIMAL(8,2),
    "sku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_characteristics" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_dna_profiles" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "certificationLevel" "CertificationLevel" NOT NULL,
    "confidenceScore" "ConfidenceLevel" NOT NULL DEFAULT 'medium',
    "status" "DNAProfileStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "equipment_dna_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_dna_scores" (
    "id" UUID NOT NULL,
    "dnaProfileId" UUID NOT NULL,
    "characteristicId" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "rationale" TEXT,
    "evidenceLevel" "EvidenceLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_dna_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_specifications" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "specificationCode" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(12,4),
    "unit" TEXT,
    "source" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_evidence" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "dnaProfileId" UUID,
    "dnaScoreId" UUID,
    "evidenceType" "EvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceReference" TEXT,
    "reliability" "EvidenceReliability" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'collected',
    "collectedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_fit_profiles" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "dnaProfileId" UUID NOT NULL,
    "fitType" "EquipmentFitType" NOT NULL,
    "fitCode" TEXT NOT NULL,
    "strength" INTEGER NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "rationale" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_fit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_personalities" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "dnaProfileId" UUID NOT NULL,
    "personalityCode" TEXT NOT NULL,
    "personalityName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "confidence" "ConfidenceLevel" NOT NULL,
    "derivationVersion" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_personalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_comparisons" (
    "id" UUID NOT NULL,
    "sourceEquipmentId" UUID NOT NULL,
    "targetEquipmentId" UUID NOT NULL,
    "similarityScore" DECIMAL(5,4) NOT NULL,
    "sharedStrengths" JSONB NOT NULL,
    "primaryDifferences" JSONB NOT NULL,
    "sourceBestFor" TEXT,
    "targetBestFor" TEXT,
    "confidence" "ComparisonConfidence" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bat_match_sessions" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "status" "BatMatchSessionStatus" NOT NULL DEFAULT 'started',
    "type" "BatMatchSessionType" NOT NULL DEFAULT 'first_batmatch',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confidenceScore" DECIMAL(5,4),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bat_match_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_dna_profiles" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "batMatchSessionId" UUID,
    "version" TEXT NOT NULL,
    "status" "PlayerDNAProfileStatus" NOT NULL DEFAULT 'generated',
    "batControl" DECIMAL(5,2) NOT NULL,
    "swingSpeed" DECIMAL(5,2) NOT NULL,
    "powerPotential" DECIMAL(5,2) NOT NULL,
    "contactConsistency" DECIMAL(5,2) NOT NULL,
    "physicalStrength" DECIMAL(5,2) NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "transitionReadiness" DECIMAL(5,2) NOT NULL,
    "growthStability" DECIMAL(5,2) NOT NULL,
    "equipmentAwareness" DECIMAL(5,2) NOT NULL,
    "profileCompleteness" DECIMAL(5,2) NOT NULL,
    "preferredSwingFeel" "PreferredSwingFeel" NOT NULL DEFAULT 'unknown',
    "developmentStage" "DevelopmentStage" NOT NULL,
    "primaryHittingGoal" "PrimaryHittingGoal" NOT NULL DEFAULT 'unknown',
    "currentEquipmentAssessment" TEXT,
    "growthStatus" "GrowthStatus" NOT NULL DEFAULT 'insufficient_data',
    "profileConfidenceLevel" "ProfileConfidenceLevel" NOT NULL,
    "scoringRuleVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "regenerationReason" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_dna_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bat_match_questions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "section" "BatMatchSection" NOT NULL,
    "questionText" TEXT NOT NULL,
    "helperText" TEXT,
    "answerType" "AnswerType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "confidenceWeight" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bat_match_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bat_match_answers" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bat_match_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_signals" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "signalCode" TEXT NOT NULL,
    "signalName" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "sourceAnswerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "batMatchSessionId" UUID,
    "playerDNAProfileId" UUID,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'draft',
    "overallConfidence" DECIMAL(5,4),
    "recommendationConfidence" DECIMAL(5,2),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionMatrixVersion" TEXT NOT NULL,
    "equipmentDnaVersion" TEXT NOT NULL,
    "knowledgeGraphVersion" TEXT NOT NULL,
    "inputHash" TEXT,
    "inputSnapshot" JSONB,
    "scoreBreakdown" JSONB,
    "recommendationTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_items" (
    "id" UUID NOT NULL,
    "recommendationId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "matchScore" DECIMAL(8,4) NOT NULL,
    "equipmentReadinessScore" DECIMAL(8,4),
    "recommendationConfidence" DECIMAL(5,4) NOT NULL,
    "matchBand" TEXT,
    "confidenceBand" TEXT,
    "reasonSummary" TEXT,
    "explanationSummary" TEXT,
    "scoreBreakdown" JSONB,
    "recommendationTrace" JSONB,
    "eligibilityStatus" JSONB,
    "tradeoffs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentVariantId" UUID,

    CONSTRAINT "recommendation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_profiles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultPriority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_opportunity_profiles" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "recommendationId" UUID,
    "opportunityProfileId" UUID NOT NULL,
    "priorityScore" DECIMAL(8,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_opportunity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_books" (
    "id" UUID NOT NULL,
    "recommendationId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DecisionBookStatus" NOT NULL DEFAULT 'draft',
    "webUrl" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_book_sections" (
    "id" UUID NOT NULL,
    "decisionBookId" UUID NOT NULL,
    "sectionType" "DecisionBookSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_book_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_timeline_events" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "eventType" "PlayerTimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_events" (
    "id" UUID NOT NULL,
    "eventType" "PlatformEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_data" (
    "id" UUID NOT NULL,
    "type" "ReferenceDataType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "families_createdByUserId_idx" ON "families"("createdByUserId");

-- CreateIndex
CREATE INDEX "family_members_familyId_idx" ON "family_members"("familyId");

-- CreateIndex
CREATE INDEX "family_members_userId_idx" ON "family_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_familyId_userId_key" ON "family_members"("familyId", "userId");

-- CreateIndex
CREATE INDEX "players_familyId_idx" ON "players"("familyId");

-- CreateIndex
CREATE INDEX "players_graduationYear_idx" ON "players"("graduationYear");

-- CreateIndex
CREATE INDEX "players_status_idx" ON "players"("status");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_playerId_key" ON "player_profiles"("playerId");

-- CreateIndex
CREATE INDEX "player_profiles_playerId_idx" ON "player_profiles"("playerId");

-- CreateIndex
CREATE INDEX "growth_measurements_playerId_idx" ON "growth_measurements"("playerId");

-- CreateIndex
CREATE INDEX "growth_measurements_measuredAt_idx" ON "growth_measurements"("measuredAt");

-- CreateIndex
CREATE INDEX "equipment_manufacturer_idx" ON "equipment"("manufacturer");

-- CreateIndex
CREATE INDEX "equipment_model_idx" ON "equipment"("model");

-- CreateIndex
CREATE INDEX "equipment_modelYear_idx" ON "equipment"("modelYear");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE INDEX "equipment_certification_idx" ON "equipment"("certification");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_variants_sku_key" ON "equipment_variants"("sku");

-- CreateIndex
CREATE INDEX "equipment_variants_equipmentId_idx" ON "equipment_variants"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_characteristics_code_key" ON "equipment_characteristics"("code");

-- CreateIndex
CREATE INDEX "equipment_dna_profiles_equipmentId_idx" ON "equipment_dna_profiles"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_dna_profiles_status_idx" ON "equipment_dna_profiles"("status");

-- CreateIndex
CREATE INDEX "equipment_dna_scores_dnaProfileId_idx" ON "equipment_dna_scores"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_dna_scores_characteristicId_idx" ON "equipment_dna_scores"("characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_dna_scores_dnaProfileId_characteristicId_key" ON "equipment_dna_scores"("dnaProfileId", "characteristicId");

-- CreateIndex
CREATE INDEX "equipment_specifications_equipmentId_idx" ON "equipment_specifications"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_specifications_specificationCode_idx" ON "equipment_specifications"("specificationCode");

-- CreateIndex
CREATE INDEX "equipment_specifications_verifiedAt_idx" ON "equipment_specifications"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_specifications_equipmentId_specificationCode_key" ON "equipment_specifications"("equipmentId", "specificationCode");

-- CreateIndex
CREATE INDEX "equipment_evidence_equipmentId_idx" ON "equipment_evidence"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_evidence_dnaProfileId_idx" ON "equipment_evidence"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_evidence_dnaScoreId_idx" ON "equipment_evidence"("dnaScoreId");

-- CreateIndex
CREATE INDEX "equipment_evidence_evidenceType_idx" ON "equipment_evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "equipment_evidence_reliability_idx" ON "equipment_evidence"("reliability");

-- CreateIndex
CREATE INDEX "equipment_evidence_status_idx" ON "equipment_evidence"("status");

-- CreateIndex
CREATE INDEX "equipment_evidence_collectedAt_idx" ON "equipment_evidence"("collectedAt");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_equipmentId_idx" ON "equipment_fit_profiles"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_dnaProfileId_idx" ON "equipment_fit_profiles"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_fitType_idx" ON "equipment_fit_profiles"("fitType");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_fitCode_idx" ON "equipment_fit_profiles"("fitCode");

-- CreateIndex
CREATE INDEX "equipment_fit_profiles_confidence_idx" ON "equipment_fit_profiles"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_fit_profiles_dnaProfileId_fitType_fitCode_version_key" ON "equipment_fit_profiles"("dnaProfileId", "fitType", "fitCode", "version");

-- CreateIndex
CREATE INDEX "equipment_personalities_equipmentId_idx" ON "equipment_personalities"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_personalities_dnaProfileId_idx" ON "equipment_personalities"("dnaProfileId");

-- CreateIndex
CREATE INDEX "equipment_personalities_personalityCode_idx" ON "equipment_personalities"("personalityCode");

-- CreateIndex
CREATE INDEX "equipment_personalities_isPrimary_idx" ON "equipment_personalities"("isPrimary");

-- CreateIndex
CREATE INDEX "equipment_personalities_confidence_idx" ON "equipment_personalities"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_personalities_dnaProfileId_personalityCode_deriva_key" ON "equipment_personalities"("dnaProfileId", "personalityCode", "derivationVersion");

-- CreateIndex
CREATE INDEX "equipment_comparisons_sourceEquipmentId_idx" ON "equipment_comparisons"("sourceEquipmentId");

-- CreateIndex
CREATE INDEX "equipment_comparisons_targetEquipmentId_idx" ON "equipment_comparisons"("targetEquipmentId");

-- CreateIndex
CREATE INDEX "equipment_comparisons_similarityScore_idx" ON "equipment_comparisons"("similarityScore");

-- CreateIndex
CREATE INDEX "equipment_comparisons_confidence_idx" ON "equipment_comparisons"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_comparisons_sourceEquipmentId_targetEquipmentId_v_key" ON "equipment_comparisons"("sourceEquipmentId", "targetEquipmentId", "version");

-- CreateIndex
CREATE INDEX "bat_match_sessions_playerId_idx" ON "bat_match_sessions"("playerId");

-- CreateIndex
CREATE INDEX "bat_match_sessions_status_idx" ON "bat_match_sessions"("status");

-- CreateIndex
CREATE INDEX "bat_match_sessions_type_idx" ON "bat_match_sessions"("type");

-- CreateIndex
CREATE INDEX "player_dna_profiles_playerId_idx" ON "player_dna_profiles"("playerId");

-- CreateIndex
CREATE INDEX "player_dna_profiles_batMatchSessionId_idx" ON "player_dna_profiles"("batMatchSessionId");

-- CreateIndex
CREATE INDEX "player_dna_profiles_generatedAt_idx" ON "player_dna_profiles"("generatedAt");

-- CreateIndex
CREATE INDEX "player_dna_profiles_status_idx" ON "player_dna_profiles"("status");

-- CreateIndex
CREATE INDEX "player_dna_profiles_scoringRuleVersion_idx" ON "player_dna_profiles"("scoringRuleVersion");

-- CreateIndex
CREATE INDEX "player_dna_profiles_inputHash_idx" ON "player_dna_profiles"("inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "bat_match_questions_code_key" ON "bat_match_questions"("code");

-- CreateIndex
CREATE INDEX "bat_match_questions_section_idx" ON "bat_match_questions"("section");

-- CreateIndex
CREATE INDEX "bat_match_questions_active_idx" ON "bat_match_questions"("active");

-- CreateIndex
CREATE INDEX "bat_match_answers_sessionId_idx" ON "bat_match_answers"("sessionId");

-- CreateIndex
CREATE INDEX "bat_match_answers_questionId_idx" ON "bat_match_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "bat_match_answers_sessionId_questionId_key" ON "bat_match_answers"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "decision_signals_sessionId_idx" ON "decision_signals"("sessionId");

-- CreateIndex
CREATE INDEX "decision_signals_playerId_idx" ON "decision_signals"("playerId");

-- CreateIndex
CREATE INDEX "decision_signals_signalCode_idx" ON "decision_signals"("signalCode");

-- CreateIndex
CREATE INDEX "recommendations_playerId_idx" ON "recommendations"("playerId");

-- CreateIndex
CREATE INDEX "recommendations_batMatchSessionId_idx" ON "recommendations"("batMatchSessionId");

-- CreateIndex
CREATE INDEX "recommendations_playerDNAProfileId_idx" ON "recommendations"("playerDNAProfileId");

-- CreateIndex
CREATE INDEX "recommendations_status_idx" ON "recommendations"("status");

-- CreateIndex
CREATE INDEX "recommendations_generatedAt_idx" ON "recommendations"("generatedAt");

-- CreateIndex
CREATE INDEX "recommendations_inputHash_idx" ON "recommendations"("inputHash");

-- CreateIndex
CREATE INDEX "recommendation_items_recommendationId_idx" ON "recommendation_items"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendation_items_equipmentId_idx" ON "recommendation_items"("equipmentId");

-- CreateIndex
CREATE INDEX "recommendation_items_rank_idx" ON "recommendation_items"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_items_recommendationId_rank_key" ON "recommendation_items"("recommendationId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_profiles_code_key" ON "opportunity_profiles"("code");

-- CreateIndex
CREATE INDEX "opportunity_profiles_active_idx" ON "opportunity_profiles"("active");

-- CreateIndex
CREATE INDEX "player_opportunity_profiles_playerId_idx" ON "player_opportunity_profiles"("playerId");

-- CreateIndex
CREATE INDEX "player_opportunity_profiles_recommendationId_idx" ON "player_opportunity_profiles"("recommendationId");

-- CreateIndex
CREATE INDEX "player_opportunity_profiles_opportunityProfileId_idx" ON "player_opportunity_profiles"("opportunityProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_books_recommendationId_key" ON "decision_books"("recommendationId");

-- CreateIndex
CREATE INDEX "decision_books_recommendationId_idx" ON "decision_books"("recommendationId");

-- CreateIndex
CREATE INDEX "decision_books_playerId_idx" ON "decision_books"("playerId");

-- CreateIndex
CREATE INDEX "decision_books_status_idx" ON "decision_books"("status");

-- CreateIndex
CREATE INDEX "decision_book_sections_decisionBookId_idx" ON "decision_book_sections"("decisionBookId");

-- CreateIndex
CREATE INDEX "decision_book_sections_sortOrder_idx" ON "decision_book_sections"("sortOrder");

-- CreateIndex
CREATE INDEX "player_timeline_events_playerId_idx" ON "player_timeline_events"("playerId");

-- CreateIndex
CREATE INDEX "player_timeline_events_eventType_idx" ON "player_timeline_events"("eventType");

-- CreateIndex
CREATE INDEX "player_timeline_events_eventDate_idx" ON "player_timeline_events"("eventDate");

-- CreateIndex
CREATE INDEX "player_timeline_events_relatedEntityType_idx" ON "player_timeline_events"("relatedEntityType");

-- CreateIndex
CREATE INDEX "platform_events_eventType_idx" ON "platform_events"("eventType");

-- CreateIndex
CREATE INDEX "platform_events_entityType_idx" ON "platform_events"("entityType");

-- CreateIndex
CREATE INDEX "platform_events_entityId_idx" ON "platform_events"("entityId");

-- CreateIndex
CREATE INDEX "platform_events_createdAt_idx" ON "platform_events"("createdAt");

-- CreateIndex
CREATE INDEX "reference_data_type_idx" ON "reference_data"("type");

-- CreateIndex
CREATE INDEX "reference_data_active_idx" ON "reference_data"("active");

-- CreateIndex
CREATE UNIQUE INDEX "reference_data_type_code_key" ON "reference_data"("type", "code");

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_measurements" ADD CONSTRAINT "growth_measurements_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_variants" ADD CONSTRAINT "equipment_variants_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_profiles" ADD CONSTRAINT "equipment_dna_profiles_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_scores" ADD CONSTRAINT "equipment_dna_scores_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_dna_scores" ADD CONSTRAINT "equipment_dna_scores_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "equipment_characteristics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_evidence" ADD CONSTRAINT "equipment_evidence_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_evidence" ADD CONSTRAINT "equipment_evidence_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_evidence" ADD CONSTRAINT "equipment_evidence_dnaScoreId_fkey" FOREIGN KEY ("dnaScoreId") REFERENCES "equipment_dna_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_fit_profiles" ADD CONSTRAINT "equipment_fit_profiles_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_fit_profiles" ADD CONSTRAINT "equipment_fit_profiles_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_personalities" ADD CONSTRAINT "equipment_personalities_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_personalities" ADD CONSTRAINT "equipment_personalities_dnaProfileId_fkey" FOREIGN KEY ("dnaProfileId") REFERENCES "equipment_dna_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_comparisons" ADD CONSTRAINT "equipment_comparisons_sourceEquipmentId_fkey" FOREIGN KEY ("sourceEquipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_comparisons" ADD CONSTRAINT "equipment_comparisons_targetEquipmentId_fkey" FOREIGN KEY ("targetEquipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bat_match_sessions" ADD CONSTRAINT "bat_match_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_dna_profiles" ADD CONSTRAINT "player_dna_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_dna_profiles" ADD CONSTRAINT "player_dna_profiles_batMatchSessionId_fkey" FOREIGN KEY ("batMatchSessionId") REFERENCES "bat_match_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bat_match_answers" ADD CONSTRAINT "bat_match_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bat_match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bat_match_answers" ADD CONSTRAINT "bat_match_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "bat_match_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bat_match_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_signals" ADD CONSTRAINT "decision_signals_sourceAnswerId_fkey" FOREIGN KEY ("sourceAnswerId") REFERENCES "bat_match_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_batMatchSessionId_fkey" FOREIGN KEY ("batMatchSessionId") REFERENCES "bat_match_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_playerDNAProfileId_fkey" FOREIGN KEY ("playerDNAProfileId") REFERENCES "player_dna_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_opportunity_profiles" ADD CONSTRAINT "player_opportunity_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_opportunity_profiles" ADD CONSTRAINT "player_opportunity_profiles_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_opportunity_profiles" ADD CONSTRAINT "player_opportunity_profiles_opportunityProfileId_fkey" FOREIGN KEY ("opportunityProfileId") REFERENCES "opportunity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_books" ADD CONSTRAINT "decision_books_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_books" ADD CONSTRAINT "decision_books_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_book_sections" ADD CONSTRAINT "decision_book_sections_decisionBookId_fkey" FOREIGN KEY ("decisionBookId") REFERENCES "decision_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_timeline_events" ADD CONSTRAINT "player_timeline_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

