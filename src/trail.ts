export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export interface TrailState {
  points: TrailPoint[];
  lastX: number;
  lastY: number;
}

const MAX_POINTS = 400;
const MAX_AGE = 30;
const DROP_DISTANCE = 50; // pixels between points
const DROP_DIST_SQ = DROP_DISTANCE * DROP_DISTANCE;

export function createTrail(): TrailState {
  return { points: [], lastX: 0, lastY: 0 };
}

export function updateTrail(trail: TrailState, x: number, y: number, dt: number, isMoving: boolean) {
  // Age all points
  for (let i = trail.points.length - 1; i >= 0; i--) {
    trail.points[i].age += dt;
    if (trail.points[i].age > MAX_AGE) {
      trail.points.splice(i, 1);
    }
  }

  // Drop new point based on distance traveled
  if (isMoving) {
    const dx = x - trail.lastX;
    const dy = y - trail.lastY;
    if (dx * dx + dy * dy >= DROP_DIST_SQ) {
      trail.points.push({ x, y, age: 0 });
      trail.lastX = x;
      trail.lastY = y;

      if (trail.points.length > MAX_POINTS) {
        trail.points.shift();
      }
    }
  }
}

export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: TrailState,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const halfW = canvasWidth / 2;
  const halfH = canvasHeight / 2;

  for (const p of trail.points) {
    const sx = p.x - cameraX + halfW;
    const sy = p.y - cameraY + halfH;

    if (sx < -10 || sx > canvasWidth + 10 || sy < -10 || sy > canvasHeight + 10) continue;

    const life = 1 - p.age / MAX_AGE;
    const alpha = life * 0.08;
    const radius = 2 + life * 1.5;

    ctx.fillStyle = `rgba(30, 30, 30, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
