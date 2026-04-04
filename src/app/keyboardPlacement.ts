import { Point } from "../core/types";

export type NavigationDirection = "left" | "right" | "up" | "down";

const samePoint = (left: Point, right: Point): boolean => left.x === right.x && left.y === right.y;

export const getNextPlacementOrigin = (
  origins: Point[],
  current: Point,
  direction: NavigationDirection
): Point => {
  let best = current;
  let bestPrimary = Number.POSITIVE_INFINITY;
  let bestSecondary = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const origin of origins) {
    if (samePoint(origin, current)) {
      continue;
    }

    const dx = origin.x - current.x;
    const dy = origin.y - current.y;

    let primary = Number.POSITIVE_INFINITY;
    let secondary = Number.POSITIVE_INFINITY;

    if (direction === "left" && dx < 0) {
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (direction === "right" && dx > 0) {
      primary = dx;
      secondary = Math.abs(dy);
    } else if (direction === "up" && dy < 0) {
      primary = -dy;
      secondary = Math.abs(dx);
    } else if (direction === "down" && dy > 0) {
      primary = dy;
      secondary = Math.abs(dx);
    } else {
      continue;
    }

    const distance = Math.abs(dx) + Math.abs(dy);
    if (
      secondary < bestSecondary ||
      (secondary === bestSecondary && primary < bestPrimary) ||
      (secondary === bestSecondary && primary === bestPrimary && distance < bestDistance) ||
      (secondary === bestSecondary &&
        primary === bestPrimary &&
        distance === bestDistance &&
        (origin.y < best.y || (origin.y === best.y && origin.x < best.x)))
    ) {
      best = origin;
      bestPrimary = primary;
      bestSecondary = secondary;
      bestDistance = distance;
    }
  }

  return best;
};
