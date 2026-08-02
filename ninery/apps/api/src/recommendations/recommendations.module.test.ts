import assert from "node:assert/strict";
import test from "node:test";
import { DevDemoRecommendationController } from "./dev-demo-recommendation.controller.js";
import { getRecommendationControllers } from "./recommendations.module.js";

test("development demo route is disabled in production mode", () => {
  const controllers = getRecommendationControllers({ NODE_ENV: "production" });
  assert.equal(controllers.includes(DevDemoRecommendationController), false);
});

test("development demo route is enabled outside production mode", () => {
  const controllers = getRecommendationControllers({ NODE_ENV: "development" });
  assert.equal(controllers.includes(DevDemoRecommendationController), true);
});
