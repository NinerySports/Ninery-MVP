BEGIN;
-- CreateTable
CREATE TABLE "capture_namespaces" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "capture_namespaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisition_participants" (
    "id" UUID NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "localKey" TEXT NOT NULL,
    "equipmentId" UUID,
    "equipmentVariantId" UUID,
    "registeredBy" TEXT NOT NULL,

    CONSTRAINT "acquisition_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_acquisitions" (
    "id" UUID NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "protocolFamily" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "equipmentId" UUID NOT NULL,
    "equipmentVariantId" UUID NOT NULL,

    CONSTRAINT "evidence_acquisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_acquisition_revisions" (
    "id" UUID NOT NULL,
    "acquisitionId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "predecessorId" UUID,
    "operation" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "commandFingerprint" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "fingerprintVersion" TEXT NOT NULL DEFAULT '1.0',
    "payload" JSONB NOT NULL,
    "expectedCount" INTEGER NOT NULL,
    "sealed" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "specimenId" UUID,
    "operatorId" UUID,
    "evaluatorId" UUID,

    CONSTRAINT "evidence_acquisition_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisition_evidence_bindings" (
    "evidenceId" UUID NOT NULL,
    "acquisitionId" UUID NOT NULL,

    CONSTRAINT "acquisition_evidence_bindings_pkey" PRIMARY KEY ("evidenceId")
);

-- CreateTable
CREATE TABLE "acquisition_evidence_members" (
    "revisionId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "acquisitionId" UUID NOT NULL,
    "memberKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "instrumentId" UUID,

    CONSTRAINT "acquisition_evidence_members_pkey" PRIMARY KEY ("revisionId","evidenceId")
);

-- CreateTable
CREATE TABLE "acquisition_input_declarations" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "evidenceId" UUID,
    "targetRevisionId" UUID,
    "declaration" JSONB NOT NULL,

    CONSTRAINT "acquisition_input_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acquisition_participants_namespaceId_kind_localKey_key" ON "acquisition_participants"("namespaceId", "kind", "localKey");

-- CreateIndex
CREATE INDEX "evidence_acquisitions_equipmentId_equipmentVariantId_idx" ON "evidence_acquisitions"("equipmentId", "equipmentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_acquisitions_namespaceId_protocolFamily_sessionKey_key" ON "evidence_acquisitions"("namespaceId", "protocolFamily", "sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_acquisition_revisions_predecessorId_key" ON "evidence_acquisition_revisions"("predecessorId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_acquisition_revisions_idempotencyKey_key" ON "evidence_acquisition_revisions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "evidence_acquisition_revisions_acquisitionId_ordinal_idx" ON "evidence_acquisition_revisions"("acquisitionId", "ordinal" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_acquisition_revisions_id_acquisitionId_key" ON "evidence_acquisition_revisions"("id", "acquisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_acquisition_revisions_acquisitionId_ordinal_key" ON "evidence_acquisition_revisions"("acquisitionId", "ordinal");

-- CreateIndex
CREATE INDEX "acquisition_evidence_bindings_acquisitionId_idx" ON "acquisition_evidence_bindings"("acquisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "acquisition_evidence_bindings_evidenceId_acquisitionId_key" ON "acquisition_evidence_bindings"("evidenceId", "acquisitionId");

-- CreateIndex
CREATE INDEX "acquisition_evidence_members_evidenceId_idx" ON "acquisition_evidence_members"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "acquisition_evidence_members_revisionId_memberKey_key" ON "acquisition_evidence_members"("revisionId", "memberKey");

-- CreateIndex
CREATE INDEX "acquisition_input_declarations_revisionId_idx" ON "acquisition_input_declarations"("revisionId");

-- CreateIndex
CREATE INDEX "acquisition_input_declarations_evidenceId_idx" ON "acquisition_input_declarations"("evidenceId");

-- CreateIndex
CREATE INDEX "acquisition_input_declarations_targetRevisionId_idx" ON "acquisition_input_declarations"("targetRevisionId");

-- AddForeignKey
ALTER TABLE "acquisition_participants" ADD CONSTRAINT "acquisition_participants_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "capture_namespaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_participants" ADD CONSTRAINT "acquisition_participants_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_participants" ADD CONSTRAINT "acquisition_participants_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisitions" ADD CONSTRAINT "evidence_acquisitions_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "capture_namespaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisitions" ADD CONSTRAINT "evidence_acquisitions_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisitions" ADD CONSTRAINT "evidence_acquisitions_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisition_revisions" ADD CONSTRAINT "evidence_acquisition_revisions_acquisitionId_fkey" FOREIGN KEY ("acquisitionId") REFERENCES "evidence_acquisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisition_revisions" ADD CONSTRAINT "evidence_acquisition_revisions_predecessorId_acquisitionId_fkey" FOREIGN KEY ("predecessorId", "acquisitionId") REFERENCES "evidence_acquisition_revisions"("id", "acquisitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisition_revisions" ADD CONSTRAINT "evidence_acquisition_revisions_specimenId_fkey" FOREIGN KEY ("specimenId") REFERENCES "acquisition_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisition_revisions" ADD CONSTRAINT "evidence_acquisition_revisions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "acquisition_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_acquisition_revisions" ADD CONSTRAINT "evidence_acquisition_revisions_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "acquisition_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_evidence_bindings" ADD CONSTRAINT "acquisition_evidence_bindings_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "equipment_dna_evidence_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_evidence_bindings" ADD CONSTRAINT "acquisition_evidence_bindings_acquisitionId_fkey" FOREIGN KEY ("acquisitionId") REFERENCES "evidence_acquisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_evidence_members" ADD CONSTRAINT "acquisition_evidence_members_revisionId_acquisitionId_fkey" FOREIGN KEY ("revisionId", "acquisitionId") REFERENCES "evidence_acquisition_revisions"("id", "acquisitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_evidence_members" ADD CONSTRAINT "acquisition_evidence_members_evidenceId_acquisitionId_fkey" FOREIGN KEY ("evidenceId", "acquisitionId") REFERENCES "acquisition_evidence_bindings"("evidenceId", "acquisitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_evidence_members" ADD CONSTRAINT "acquisition_evidence_members_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "acquisition_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_input_declarations" ADD CONSTRAINT "acquisition_input_declarations_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "evidence_acquisition_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_input_declarations" ADD CONSTRAINT "acquisition_input_declarations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "equipment_dna_evidence_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_input_declarations" ADD CONSTRAINT "acquisition_input_declarations_targetRevisionId_fkey" FOREIGN KEY ("targetRevisionId") REFERENCES "evidence_acquisition_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Registered provenance is append-only. Unsealed construction cannot survive commit.
ALTER TABLE acquisition_participants ADD CHECK (kind IN ('specimen','person','instrument') AND length(btrim("localKey"))>0 AND ((kind='specimen' AND "equipmentId" IS NOT NULL AND "equipmentVariantId" IS NOT NULL) OR (kind<>'specimen' AND "equipmentId" IS NULL AND "equipmentVariantId" IS NULL)));
ALTER TABLE evidence_acquisitions ADD CHECK ("protocolFamily" IN ('physical_measurement','human_calibration') AND length(btrim("sessionKey"))>0);
ALTER TABLE evidence_acquisition_revisions ADD CHECK (ordinal>0 AND "expectedCount">0 AND "fingerprintVersion"='1.0' AND operation IN ('capture','register_existing','correct','withdraw') AND length(fingerprint)=64 AND length("commandFingerprint")=64);
ALTER TABLE acquisition_input_declarations ADD CHECK ((kind='evidence' AND "evidenceId" IS NOT NULL AND "targetRevisionId" IS NULL) OR (kind='revision' AND "targetRevisionId" IS NOT NULL AND "evidenceId" IS NULL) OR (kind='unresolved' AND "evidenceId" IS NULL AND "targetRevisionId" IS NULL));
CREATE FUNCTION acquisition_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ACQUISITION_IMMUTABLE'; END $$;
CREATE TRIGGER acquisition_namespace_immutable BEFORE UPDATE OR DELETE ON capture_namespaces FOR EACH ROW EXECUTE FUNCTION acquisition_immutable();
CREATE TRIGGER acquisition_participant_immutable BEFORE UPDATE OR DELETE ON acquisition_participants FOR EACH ROW EXECUTE FUNCTION acquisition_immutable();
CREATE TRIGGER acquisition_root_immutable BEFORE UPDATE OR DELETE ON evidence_acquisitions FOR EACH ROW EXECUTE FUNCTION acquisition_immutable();
CREATE TRIGGER acquisition_binding_immutable BEFORE UPDATE OR DELETE ON acquisition_evidence_bindings FOR EACH ROW EXECUTE FUNCTION acquisition_immutable();
CREATE FUNCTION acquisition_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM equipment_variants WHERE id=NEW."equipmentVariantId" AND "equipmentId"=NEW."equipmentId") THEN RAISE EXCEPTION 'ACQUISITION_VARIANT_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acquisition_target_scope BEFORE INSERT ON evidence_acquisitions FOR EACH ROW EXECUTE FUNCTION acquisition_scope();
CREATE FUNCTION acquisition_specimen_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.kind='specimen' AND NOT EXISTS (SELECT 1 FROM equipment_variants WHERE id=NEW."equipmentVariantId" AND "equipmentId"=NEW."equipmentId") THEN RAISE EXCEPTION 'ACQUISITION_SPECIMEN_SCOPE'; END IF; RETURN NEW; END $$;
CREATE TRIGGER acquisition_specimen_scope BEFORE INSERT ON acquisition_participants FOR EACH ROW EXECUTE FUNCTION acquisition_specimen_scope();
CREATE FUNCTION acquisition_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p evidence_acquisition_revisions; a evidence_acquisitions;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ACQUISITION_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(OLD)-'sealed') IS DISTINCT FROM (to_jsonb(NEW)-'sealed') THEN RAISE EXCEPTION 'ACQUISITION_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO a FROM evidence_acquisitions WHERE id=NEW."acquisitionId" FOR UPDATE;
 IF NEW.sealed THEN RAISE EXCEPTION 'ACQUISITION_BUILD_REQUIRED'; END IF;
 IF NEW."predecessorId" IS NULL THEN
  IF NEW.ordinal<>1 OR NEW.operation NOT IN ('capture','register_existing') THEN RAISE EXCEPTION 'ACQUISITION_INITIAL_REVISION'; END IF;
 ELSE
  SELECT * INTO p FROM evidence_acquisition_revisions WHERE id=NEW."predecessorId";
  IF NOT FOUND OR p."acquisitionId"<>NEW."acquisitionId" OR NOT p.sealed OR p.operation='withdraw' OR NEW.ordinal<>p.ordinal+1 OR NEW.operation NOT IN ('correct','withdraw') THEN RAISE EXCEPTION 'ACQUISITION_INVALID_SUCCESSOR'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM acquisition_participants x WHERE x.id IN (NEW."specimenId",NEW."operatorId",NEW."evaluatorId") AND (x."namespaceId"<>a."namespaceId" OR (x.id=NEW."specimenId" AND (x.kind<>'specimen' OR x."equipmentId"<>a."equipmentId" OR x."equipmentVariantId"<>a."equipmentVariantId")) OR (x.id IN (NEW."operatorId",NEW."evaluatorId") AND x.kind<>'person'))) THEN RAISE EXCEPTION 'ACQUISITION_PARTICIPANT_SCOPE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acquisition_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON evidence_acquisition_revisions FOR EACH ROW EXECUTE FUNCTION acquisition_revision_guard();
-- Independently bind supplier input declarations, resolution metadata, and relational endpoints.
CREATE FUNCTION acquisition_input_shape(d jsonb, resolved boolean) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(d) k WHERE NOT k=ANY(CASE WHEN resolved THEN ARRAY['type','id','reference','basis','targetFingerprint'] ELSE ARRAY['type','id','reference','basis'] END))
 OR jsonb_typeof(d->'basis') IS DISTINCT FROM 'string' OR COALESCE(length(btrim(d->>'basis')),0)=0 OR d->>'basis'<>btrim(d->>'basis') OR position('<' in d->>'basis')>0 THEN RETURN false; END IF;
 IF d->>'type'='unresolved' THEN
  RETURN COALESCE(jsonb_typeof(d->'reference')='string' AND length(btrim(d->>'reference'))>0 AND d->>'reference'=btrim(d->>'reference') AND position('<' in d->>'reference')=0 AND NOT d ? 'id' AND NOT d ? 'targetFingerprint',false);
 END IF;
 RETURN COALESCE(d->>'type' IN ('evidence','revision') AND jsonb_typeof(d->'id')='string' AND d->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND NOT d ? 'reference'
 AND (NOT resolved OR jsonb_typeof(d->'targetFingerprint')='string' AND d->>'targetFingerprint' ~ '^[0-9a-f]{64}$'),false);
END $$;
CREATE FUNCTION acquisition_upstream_matches(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE u jsonb; declared jsonb; resolved jsonb; a jsonb; b jsonb;
BEGIN
 u:=p#>'{declaration,upstream}'; declared:=u->'inputs'; resolved:=p->'inputs';
 IF jsonb_typeof(u) IS DISTINCT FROM 'object' OR jsonb_typeof(declared) IS DISTINCT FROM 'array' OR jsonb_typeof(resolved) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(u) k WHERE k NOT IN ('state','rationale','inputs'))
 OR NOT COALESCE(u->>'state' IN ('not_declared','declared_inputs','declared_no_known_inputs'),false)
 OR jsonb_array_length(declared)>64 OR ((u->>'state'='declared_inputs') IS DISTINCT FROM (jsonb_array_length(declared)>0)) THEN RETURN false; END IF;
 IF u->>'state'='declared_no_known_inputs' AND (jsonb_typeof(u->'rationale') IS DISTINCT FROM 'string' OR COALESCE(length(btrim(u->>'rationale')),0)=0 OR u->>'rationale'<>btrim(u->>'rationale') OR position('<' in u->>'rationale')>0) THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(declared) v WHERE NOT acquisition_input_shape(v,false))
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(resolved) v WHERE NOT acquisition_input_shape(v,true)) THEN RETURN false; END IF;
 IF (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(declared) v) THEN RETURN false; END IF;
 SELECT COALESCE(jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) INTO a FROM jsonb_array_elements(declared) v;
 SELECT COALESCE(jsonb_agg(v-'targetFingerprint' ORDER BY (v-'targetFingerprint')::text COLLATE "C"),'[]'::jsonb) INTO b FROM jsonb_array_elements(resolved) v;
 RETURN a=b;
END $$;
CREATE FUNCTION acquisition_child_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r evidence_acquisition_revisions; a evidence_acquisitions; e equipment_dna_evidence_records;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'ACQUISITION_IMMUTABLE'; END IF;
 SELECT * INTO r FROM evidence_acquisition_revisions WHERE id=NEW."revisionId" FOR UPDATE;
 IF r.sealed THEN RAISE EXCEPTION 'ACQUISITION_MANIFEST_SEALED'; END IF;
 SELECT * INTO a FROM evidence_acquisitions WHERE id=r."acquisitionId";
 IF TG_TABLE_NAME='acquisition_evidence_members' THEN
  SELECT * INTO e FROM equipment_dna_evidence_records WHERE id=NEW."evidenceId";
  IF e."equipmentId" IS DISTINCT FROM a."equipmentId" OR e."equipmentVariantId" IS DISTINCT FROM a."equipmentVariantId" THEN RAISE EXCEPTION 'ACQUISITION_MEMBER_SCOPE'; END IF;
  IF NEW.snapshot->>'id' IS DISTINCT FROM e.id::text OR (NEW.snapshot-'sourceDate'-'retrievedAt') IS DISTINCT FROM (jsonb_build_object('id',e.id,'equipmentId',e."equipmentId",'equipmentVariantId',e."equipmentVariantId",'targetLevel',e."targetLevel",'attributeKey',e."attributeKey",'attributeDefinitionVersion',e."attributeDefinitionVersion",'sourceType',e."sourceType",'sourceName',e."sourceName",'sourceReference',e."sourceReference",'method',e.method,'rawValue',e."rawValue",'normalizedValue',e."normalizedValue",'unit',e.unit,'notes',e.notes,'evaluatorType',e."evaluatorType",'evaluatorReference',e."evaluatorReference")) THEN RAISE EXCEPTION 'ACQUISITION_SNAPSHOT_MISMATCH'; END IF;
  IF NEW."instrumentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acquisition_participants x WHERE x.id=NEW."instrumentId" AND x.kind='instrument' AND x."namespaceId"=a."namespaceId") THEN RAISE EXCEPTION 'ACQUISITION_INSTRUMENT_SCOPE'; END IF;
 ELSE
  IF NOT acquisition_input_shape(NEW.declaration,true) OR NEW.kind IS DISTINCT FROM NEW.declaration->>'type'
  OR (NEW.kind='evidence' AND (lower(NEW.declaration->>'id') IS DISTINCT FROM NEW."evidenceId"::text OR NEW."targetRevisionId" IS NOT NULL))
  OR (NEW.kind='revision' AND (lower(NEW.declaration->>'id') IS DISTINCT FROM NEW."targetRevisionId"::text OR NEW."evidenceId" IS NOT NULL))
  OR (NEW.kind='unresolved' AND (NEW."evidenceId" IS NOT NULL OR NEW."targetRevisionId" IS NOT NULL))
  THEN RAISE EXCEPTION 'ACQUISITION_INPUT_DECLARATION_MISMATCH'; END IF;
  IF NEW.kind='evidence' AND NOT EXISTS (SELECT 1 FROM equipment_dna_evidence_records WHERE id=NEW."evidenceId" AND "equipmentId"=a."equipmentId") THEN RAISE EXCEPTION 'ACQUISITION_INPUT_SCOPE'; END IF;
  IF NEW.kind='revision' AND NOT EXISTS (SELECT 1 FROM evidence_acquisition_revisions t JOIN evidence_acquisitions x ON x.id=t."acquisitionId" WHERE t.id=NEW."targetRevisionId" AND t.sealed AND x."equipmentId"=a."equipmentId" AND t.id<>r.id) THEN RAISE EXCEPTION 'ACQUISITION_INPUT_SCOPE'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acquisition_member_guard BEFORE INSERT OR UPDATE OR DELETE ON acquisition_evidence_members FOR EACH ROW EXECUTE FUNCTION acquisition_child_guard();
CREATE TRIGGER acquisition_input_guard BEFORE INSERT OR UPDATE OR DELETE ON acquisition_input_declarations FOR EACH ROW EXECUTE FUNCTION acquisition_child_guard();
-- Versioned protocol registries are enforced independently of caller-declared counts.
CREATE FUNCTION acquisition_required_keys(family text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE family
 WHEN 'physical_measurement' THEN ARRAY['actual_mass','overall_length','balance_point','barrel_diameter','handle_diameter']
 WHEN 'human_calibration' THEN ARRAY['startup_demand','rotational_demand','barrel_redirect_demand','directional_adjustment_control','barrel_path_repeatability','start_stop_redirect_control','center_response_baseline','handle_side_miss_tolerance','end_side_miss_tolerance','response_degradation','usable_contact_region_breadth','centered_response_consistency','near_center_response_consistency']
 ELSE ARRAY[]::text[] END
$$;
-- A declaration is resolved only through its matching immutable registry identity.
CREATE FUNCTION acquisition_participant_matches(d jsonb, participant_id uuid, expected_kind text, a evidence_acquisitions) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT COALESCE(CASE WHEN d IS NULL THEN participant_id IS NULL
 WHEN d->>'state'='unresolved' THEN d->>'kind'=expected_kind AND participant_id IS NULL
 WHEN d->>'state'='registered_declaration' THEN d->>'kind'=expected_kind AND length(btrim(d->>'key'))>0 AND EXISTS (
  SELECT 1 FROM acquisition_participants p WHERE p.id=participant_id AND p.kind=expected_kind AND p."namespaceId"=a."namespaceId" AND p."localKey"=d->>'key'
  AND (expected_kind<>'specimen' OR (p."equipmentId"=a."equipmentId" AND p."equipmentVariantId"=a."equipmentVariantId")))
 ELSE false END,false)
$$;
CREATE FUNCTION acquisition_sealed_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r evidence_acquisition_revisions; a evidence_acquisitions; n integer; actual jsonb; expected jsonb; required text[]; keys text[]; d jsonb;
BEGIN
 SELECT * INTO r FROM evidence_acquisition_revisions WHERE id=NEW.id;
 SELECT count(*),jsonb_agg(jsonb_build_object('evidenceId',"evidenceId",'memberKey',"memberKey",'fingerprint',fingerprint) ORDER BY "evidenceId"::text COLLATE "C") INTO n,actual FROM acquisition_evidence_members WHERE "revisionId"=r.id;
 IF NOT r.sealed OR n<>r."expectedCount" OR actual IS DISTINCT FROM r.payload->'manifest' THEN RAISE EXCEPTION 'ACQUISITION_INCOMPLETE'; END IF;
 -- The hashed audit document and relational lifecycle must describe the same revision.
 IF r.payload->'operation' IS DISTINCT FROM to_jsonb(r.operation)
 OR r.payload->'ordinal' IS DISTINCT FROM to_jsonb(r.ordinal)
 OR r.payload->'predecessorId' IS DISTINCT FROM COALESCE(to_jsonb(r."predecessorId"::text),'null'::jsonb)
 OR r.payload->'actorId' IS DISTINCT FROM to_jsonb(r."actorId")
 OR length(btrim(r."actorId"))=0
 THEN RAISE EXCEPTION 'ACQUISITION_LIFECYCLE_MISMATCH'; END IF;
 SELECT * INTO a FROM evidence_acquisitions WHERE id=r."acquisitionId";
 required:=acquisition_required_keys(a."protocolFamily");
 SELECT array_agg("memberKey" ORDER BY "memberKey" COLLATE "C") INTO keys FROM acquisition_evidence_members WHERE "revisionId"=r.id;
 IF cardinality(required)=0 OR r."expectedCount"<>cardinality(required) OR keys IS DISTINCT FROM (SELECT array_agg(k ORDER BY k COLLATE "C") FROM unnest(required) k)
 OR r.payload->>'version' IS DISTINCT FROM '1.0' OR r.payload->>'namespace' IS DISTINCT FROM a."namespaceId" OR r.payload->>'acquisitionId' IS DISTINCT FROM a.id::text
 OR r.payload#>>'{packet,protocol}' IS DISTINCT FROM a."protocolFamily"
 OR r.payload#>>'{packet,session,equipmentId}' IS DISTINCT FROM a."equipmentId"::text OR r.payload#>>'{packet,session,equipmentVariantId}' IS DISTINCT FROM a."equipmentVariantId"::text
 OR (a."protocolFamily"='physical_measurement' AND (r.payload#>>'{packet,session,protocolVersion}' IS DISTINCT FROM '1.0' OR r.payload#>>'{packet,session,protocol}' IS DISTINCT FROM 'ninery_physical_measurement' OR r.payload#>>'{packet,session,measurementSessionId}' IS DISTINCT FROM a."sessionKey"))
 OR (a."protocolFamily"='human_calibration' AND (r.payload#>>'{packet,session,protocolVersion}' IS DISTINCT FROM '1.1' OR r.payload#>>'{packet,session,questionnaireVersion}' IS DISTINCT FROM '1.1' OR r.payload#>>'{packet,session,sessionId}' IS DISTINCT FROM a."sessionKey"))
 THEN RAISE EXCEPTION 'ACQUISITION_PROTOCOL_MANIFEST_INCOMPLETE'; END IF;
 d:=r.payload->'declaration';
 IF d->'specimen' IS NULL OR (a."protocolFamily"='physical_measurement' AND d->'operator' IS NULL) OR (a."protocolFamily"='human_calibration' AND d->'evaluator' IS NULL)
 OR NOT acquisition_participant_matches(d->'specimen',r."specimenId",'specimen',a)
 OR NOT acquisition_participant_matches(d->'operator',r."operatorId",'person',a)
 OR NOT acquisition_participant_matches(d->'evaluator',r."evaluatorId",'person',a)
 OR jsonb_typeof(d->'instruments') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'ACQUISITION_PARTICIPANT_DECLARATION_MISMATCH'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(d->'instruments') k WHERE NOT k=ANY(required))
 OR EXISTS (SELECT 1 FROM acquisition_evidence_members m WHERE m."revisionId"=r.id AND (
  (a."protocolFamily"='physical_measurement' AND d->'instruments'->m."memberKey" IS NULL)
  OR NOT acquisition_participant_matches(d->'instruments'->m."memberKey",m."instrumentId",'instrument',a)))
 THEN RAISE EXCEPTION 'ACQUISITION_PARTICIPANT_DECLARATION_MISMATCH'; END IF;
 SELECT COALESCE(jsonb_agg(declaration ORDER BY declaration::text),'[]'::jsonb) INTO actual FROM acquisition_input_declarations WHERE "revisionId"=r.id;
 SELECT COALESCE(jsonb_agg(v ORDER BY v::text),'[]'::jsonb) INTO expected FROM jsonb_array_elements(r.payload->'inputs') v;
 IF actual IS DISTINCT FROM expected OR NOT acquisition_upstream_matches(r.payload) THEN RAISE EXCEPTION 'ACQUISITION_INPUT_MANIFEST_MISMATCH'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER acquisition_sealed_at_commit AFTER INSERT OR UPDATE ON evidence_acquisition_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acquisition_sealed_at_commit();
CREATE FUNCTION acquisition_root_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM evidence_acquisition_revisions WHERE "acquisitionId"=NEW.id AND sealed) THEN RAISE EXCEPTION 'ACQUISITION_EMPTY_ROOT'; END IF; RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER acquisition_root_at_commit AFTER INSERT ON evidence_acquisitions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acquisition_root_at_commit();
CREATE FUNCTION acquisition_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS (SELECT 1 FROM acquisition_evidence_bindings WHERE "evidenceId"=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'REGISTERED_EVIDENCE_IMMUTABLE'; END IF;
  IF (to_jsonb(OLD)-'status'-'updatedAt') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'updatedAt') THEN RAISE EXCEPTION 'REGISTERED_EVIDENCE_IMMUTABLE'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER acquisition_evidence_guard BEFORE UPDATE OR DELETE ON equipment_dna_evidence_records FOR EACH ROW EXECUTE FUNCTION acquisition_evidence_guard();


CREATE FUNCTION acquisition_member_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a evidence_acquisitions; e equipment_dna_evidence_records;
BEGIN
 SELECT x.* INTO a FROM evidence_acquisitions x WHERE x.id=NEW."acquisitionId";
 SELECT * INTO e FROM equipment_dna_evidence_records WHERE id=NEW."evidenceId";
 IF NOT NEW."memberKey"=ANY(acquisition_required_keys(a."protocolFamily"))
 OR (a."protocolFamily"='physical_measurement' AND (e."rawValue"->>'protocolVersion' IS DISTINCT FROM '1.0' OR e."rawValue"->>'protocol' IS DISTINCT FROM 'ninery_physical_measurement' OR e."rawValue"->>'measurementType' IS DISTINCT FROM NEW."memberKey" OR e."sourceType"::text IS DISTINCT FROM 'objective_measurement' OR e.method::text IS DISTINCT FROM 'instrument_measurement' OR e."attributeDefinitionVersion" IS DISTINCT FROM 'physical-measurement-1.0' OR e."targetLevel"::text IS DISTINCT FROM 'variant'))
 OR (a."protocolFamily"='human_calibration' AND (e."rawValue"->>'protocolVersion' IS DISTINCT FROM '1.1' OR e."rawValue"->>'questionnaireVersion' IS DISTINCT FROM '1.1' OR e."sourceType"::text IS DISTINCT FROM 'structured_expert_evaluation' OR e.method::text IS DISTINCT FROM 'standardized_rubric' OR e."attributeDefinitionVersion" IS DISTINCT FROM '1.0' OR e."targetLevel"::text IS DISTINCT FROM 'equipment'
  OR e."attributeKey" IS DISTINCT FROM CASE WHEN NEW."memberKey" IN ('startup_demand','rotational_demand','barrel_redirect_demand') THEN 'swing_effort' WHEN NEW."memberKey" IN ('directional_adjustment_control','barrel_path_repeatability','start_stop_redirect_control') THEN 'bat_control_support' WHEN NEW."memberKey" IN ('center_response_baseline','handle_side_miss_tolerance','end_side_miss_tolerance','response_degradation') THEN 'forgiveness' ELSE 'sweet_spot_support' END))
 THEN RAISE EXCEPTION 'ACQUISITION_MEMBER_PROTOCOL_IDENTITY'; END IF;
 IF (NEW.snapshot->>'sourceDate')::timestamptz IS DISTINCT FROM (e."sourceDate" AT TIME ZONE 'UTC') OR (NEW.snapshot->>'retrievedAt')::timestamptz IS DISTINCT FROM (e."retrievedAt" AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'ACQUISITION_SNAPSHOT_DATE_MISMATCH'; END IF;
 IF a."protocolFamily"='physical_measurement' AND (e."rawValue"->>'measurementSessionId' IS DISTINCT FROM a."sessionKey" OR e."sourceReference" IS DISTINCT FROM 'physical-measurement:1.0:'||a."sessionKey"||':'||e."attributeKey" OR NEW."memberKey"<>e."attributeKey") THEN RAISE EXCEPTION 'ACQUISITION_MEMBER_IDENTITY'; END IF;
 IF a."protocolFamily"='human_calibration' AND (e."rawValue"->>'sessionId' IS DISTINCT FROM a."sessionKey" OR e."sourceReference" IS DISTINCT FROM 'physical-bat-evaluation:1.1:'||a."sessionKey"||':'||(e."rawValue"->>'dimensionKey') OR NEW."memberKey" IS DISTINCT FROM e."rawValue"->>'dimensionKey') THEN RAISE EXCEPTION 'ACQUISITION_MEMBER_IDENTITY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acquisition_member_identity BEFORE INSERT ON acquisition_evidence_members FOR EACH ROW EXECUTE FUNCTION acquisition_member_identity();
CREATE FUNCTION acquisition_binding_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM acquisition_evidence_members WHERE "evidenceId"=NEW."evidenceId" AND "acquisitionId"=NEW."acquisitionId") THEN RAISE EXCEPTION 'ACQUISITION_UNBOUND_MEMBER'; END IF; RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER acquisition_binding_at_commit AFTER INSERT ON acquisition_evidence_bindings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acquisition_binding_at_commit();
CREATE FUNCTION acquisition_variant_reparent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."equipmentId" IS DISTINCT FROM NEW."equipmentId" AND (EXISTS(SELECT 1 FROM evidence_acquisitions WHERE "equipmentVariantId"=OLD.id) OR EXISTS(SELECT 1 FROM acquisition_participants WHERE "equipmentVariantId"=OLD.id)) THEN RAISE EXCEPTION 'ACQUISITION_VARIANT_IMMUTABLE'; END IF; RETURN NEW; END $$;
CREATE TRIGGER acquisition_variant_reparent BEFORE UPDATE ON equipment_variants FOR EACH ROW EXECUTE FUNCTION acquisition_variant_reparent();

COMMIT;
