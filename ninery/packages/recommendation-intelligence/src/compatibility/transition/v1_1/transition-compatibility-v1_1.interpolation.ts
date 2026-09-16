export type InterpolationPoint = {
  readonly input: number;
  readonly output: number;
};

export type InterpolationTrace = {
  readonly dimension: string;
  readonly inputValue: number;
  readonly segmentStart: InterpolationPoint;
  readonly segmentEnd: InterpolationPoint;
  readonly interpolationRatio: number;
  readonly interpolatedDemand: number;
  readonly clamped: boolean;
};

export function interpolatePiecewiseLinear(
  value: number,
  points: readonly InterpolationPoint[],
  options: { readonly clamp?: boolean } = { clamp: true }
): number {
  return interpolatePiecewiseLinearWithTrace("generic", value, points, options).interpolatedDemand;
}

export function interpolatePiecewiseLinearWithTrace(
  dimension: string,
  value: number,
  points: readonly InterpolationPoint[],
  options: { readonly clamp?: boolean } = { clamp: true }
): InterpolationTrace {
  validateInterpolationPoints(points);
  if (!Number.isFinite(value)) throw new Error("Interpolation input must be finite.");
  const clamp = options.clamp ?? true;
  const first = points[0];
  const last = points[points.length - 1];
  if (value < first.input) {
    if (!clamp) throw new Error(`Interpolation input ${value} is below the supported range.`);
    return trace(dimension, value, first, first, 0, first.output, true);
  }
  if (value > last.input) {
    if (!clamp) throw new Error(`Interpolation input ${value} is above the supported range.`);
    return trace(dimension, value, last, last, 1, last.output, true);
  }
  for (let index = 0; index < points.length; index += 1) {
    const exact = points[index];
    if (value === exact.input) return trace(dimension, value, exact, exact, 0, exact.output, false);
    const next = points[index + 1];
    if (next && value > exact.input && value < next.input) {
      const ratio = (value - exact.input) / (next.input - exact.input);
      const output = exact.output + ratio * (next.output - exact.output);
      return trace(dimension, value, exact, next, round(ratio), round(output), false);
    }
  }
  return trace(dimension, value, last, last, 1, last.output, false);
}

export function validateInterpolationPoints(points: readonly InterpolationPoint[]): void {
  if (points.length < 2) throw new Error("Interpolation requires at least two points.");
  let previousInput = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.input) || !Number.isFinite(point.output)) {
      throw new Error("Interpolation points must be finite.");
    }
    if (point.input <= previousInput) {
      throw new Error("Interpolation point inputs must be strictly increasing.");
    }
    if (point.output < 0 || point.output > 100) {
      throw new Error("Interpolation point outputs must be between 0 and 100.");
    }
    previousInput = point.input;
  }
}

function trace(
  dimension: string,
  inputValue: number,
  segmentStart: InterpolationPoint,
  segmentEnd: InterpolationPoint,
  interpolationRatio: number,
  interpolatedDemand: number,
  clamped: boolean
): InterpolationTrace {
  return {
    dimension,
    inputValue,
    segmentStart: { ...segmentStart },
    segmentEnd: { ...segmentEnd },
    interpolationRatio,
    interpolatedDemand,
    clamped
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
