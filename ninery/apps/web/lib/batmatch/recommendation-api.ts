import { mapRecommendationResponseToViewModel } from "./recommendation-adapter";
import type { BackendDemoRecommendationResponse, RecommendationResultsViewModel } from "./recommendation-types";

const DEFAULT_API_BASE_URL = "http://localhost:3001";

export class RecommendationApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "RecommendationApiError";
  }
}

export async function getDemoRecommendation(
  fetcher: typeof fetch = fetch
): Promise<RecommendationResultsViewModel> {
  const response = await fetcher(`${getApiBaseUrl()}/dev/demo/recommendation`, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new RecommendationApiError("We couldn't load this recommendation.", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new RecommendationApiError("The recommendation response was not valid JSON.", response.status, error);
  }

  if (!isDemoRecommendationResponse(payload)) {
    throw new RecommendationApiError("The recommendation response was incomplete.", response.status);
  }

  return mapRecommendationResponseToViewModel(payload);
}

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function isDemoRecommendationResponse(value: unknown): value is BackendDemoRecommendationResponse {
  return Boolean(value && typeof value === "object" && "player" in value && "recommendations" in value);
}
