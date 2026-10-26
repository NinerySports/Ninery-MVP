import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { AcquisitionError, type CapturePacket, type ProvenanceDeclaration } from "./acquisition-provenance.js";
import { operationalAcquisitionCapture } from "./stronger-evidence-acquisition-capture.js";
/** CLI is a thin adapter; no caller-provided actor or confirmation flag authorizes capture. */
export async function captureOperationalPacket(db: PrismaClient, packet: CapturePacket, envelopePath: string | undefined) {
    if (!envelopePath)
        throw new AcquisitionError("CAPTURE_NOT_AUTHORIZED: trusted credential provider and --provenance envelope required; production activation unavailable");
    const envelope = JSON.parse(await readFile(envelopePath, "utf8")) as {
        namespace: string;
        idempotencyKey: string;
        declaration: ProvenanceDeclaration;
    };
    // This application has no production credential provider yet. The service deliberately rejects.
    return operationalAcquisitionCapture(db).capture({ ...envelope, packet, credential: undefined });
}

