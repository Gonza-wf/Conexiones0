export interface StickmanState {
  x: number;
  y: number;
  direction: number;
  walkCycle: number;
  isMoving: boolean;
  speed: number;
}

export function createStickman(x: number, y: number): StickmanState {
  return {
    x,
    y,
    direction: 0,
    walkCycle: 0,
    isMoving: false,
    speed: 90,
  };
}

export function drawStickman(
  ctx: CanvasRenderingContext2D,
  state: StickmanState,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  color: string = '#111',
  scale: number = 1,
  opacity: number = 1,
  time: number = 0,
  idlePhase: number = 0
) {
  if (opacity <= 0) return;

  const screenX = state.x - cameraX + canvasWidth / 2;
  const screenY = state.y - cameraY + canvasHeight / 2;

  if (screenX < -50 || screenX > canvasWidth + 50 || screenY < -50 || screenY > canvasHeight + 50) return;

  const walk = state.isMoving ? Math.sin(state.walkCycle * 9) : 0;

  // Breathing when idle (subtle vertical bob)
  const breathe = !state.isMoving ? Math.sin((time + idlePhase) * 1.8) * 1.2 : 0;
  // Idle sway for NPCs (very subtle lateral tilt)
  const sway = !state.isMoving ? Math.sin((time + idlePhase) * 0.9) * 0.6 : 0;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(screenX, screenY + breathe);
  ctx.scale(scale, scale);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.beginPath();
  ctx.ellipse(0, 20 - breathe, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;

  // Left leg
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(walk * 5 + sway, 18 - breathe);
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-walk * 5 + sway, 18 - breathe);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(sway * 0.3, -4);
  ctx.lineTo(0, 6);
  ctx.stroke();

  // Left arm
  ctx.beginPath();
  ctx.moveTo(sway * 0.3, -2);
  ctx.lineTo(-walk * 4 - 4 + sway, 8);
  ctx.stroke();

  // Right arm
  ctx.beginPath();
  ctx.moveTo(sway * 0.3, -2);
  ctx.lineTo(walk * 4 + 4 + sway, 8);
  ctx.stroke();

  // Head
  ctx.fillStyle = color === '#111' ? '#fff' : color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sway * 0.5, -10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Draw stickman sitting — knees bent up, arms crossed on knees, head resting on arms
export function drawSittingStickman(
  ctx: CanvasRenderingContext2D,
  state: StickmanState,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  sittingProgress: number // 0 = standing, 1 = fully sitting
) {
  const screenX = state.x - cameraX + canvasWidth / 2;
  const screenY = state.y - cameraY + canvasHeight / 2;

  const t = Math.min(1, sittingProgress);

  ctx.save();
  ctx.translate(screenX, screenY);

  // Shadow grows when sitting
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.beginPath();
  const shadowW = 8 + t * 6;
  const shadowH = 3 + t * 2;
  ctx.ellipse(0, 20, shadowW, shadowH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#111';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;

  // Standing pose values
  const standBodyTopY = -4;
  const standBodyBotY = 6;
  const standHeadY = -10;
  const standLegEndY = 18;
  const standArmEndX = 4;
  const standArmEndY = 8;

  // Sitting pose: knees bent up in front, body upright but leaned forward slightly
  // Hips (body bottom) drop slightly and move back
  const bodyBotY = standBodyBotY + t * 8; // hips drop to y=14
  // Body top leans forward
  const bodyTopY = standBodyTopY + t * 12; // torso leans down to y=8
  // Knees come up: legs go forward and up
  // Left knee
  const lKneeX = -4 - t * 2; // slightly left
  const lKneeY = standLegEndY - t * 10; // knee rises from 18 to ~8
  const lFootX = -6 - t * 2;
  const lFootY = standLegEndY - t * 2; // foot stays near ground ~16
  // Right knee
  const rKneeX = 4 + t * 2;
  const rKneeY = standLegEndY - t * 10;
  const rFootX = 6 + t * 2;
  const rFootY = standLegEndY - t * 2;

  // Left leg — hip to knee to foot
  ctx.beginPath();
  ctx.moveTo(0, bodyBotY);
  ctx.lineTo(lKneeX, lKneeY);
  ctx.lineTo(lFootX, lFootY);
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(0, bodyBotY);
  ctx.lineTo(rKneeX, rKneeY);
  ctx.lineTo(rFootX, rFootY);
  ctx.stroke();

  // Body (spine)
  ctx.beginPath();
  ctx.moveTo(0, bodyTopY);
  ctx.lineTo(0, bodyBotY);
  ctx.stroke();

  // Arms: crossed and resting on knees
  // Shoulder is at bodyTopY + 2
  const shoulderY = bodyTopY + 2;
  // Arms go from shoulder to the knees, crossed
  // Left arm goes to right knee
  const lArmEndX = 0 + t * (rKneeX - 0); // lerp to right knee area
  const lArmEndY = standArmEndY + t * (rKneeY - standArmEndY);
  // Right arm goes to left knee  
  const rArmEndX = 0 + t * (lKneeX - 0);
  const rArmEndY = standArmEndY + t * (lKneeY - standArmEndY);

  // Standing fallback
  const finalLArmX = t > 0.1 ? lArmEndX : -standArmEndX;
  const finalLArmY = t > 0.1 ? lArmEndY : standArmEndY;
  const finalRArmX = t > 0.1 ? rArmEndX : standArmEndX;
  const finalRArmY = t > 0.1 ? rArmEndY : standArmEndY;

  // Left arm
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(finalLArmX, finalLArmY);
  ctx.stroke();

  // Right arm
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(finalRArmX, finalRArmY);
  ctx.stroke();

  // Head — tilts down and forward, resting on arms/knees
  // Head position: centered above body top, but drops forward onto arms
  const headBaseY = standHeadY;
  // When fully sitting, head drops to rest on the crossed arms
  const headTargetY = (lArmEndY + rArmEndY) / 2 - 5; // just above where arms cross
  const headTargetX = 0;
  const headY = headBaseY + t * (headTargetY - headBaseY);
  const headX = 0 + t * (headTargetX - 0);

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(headX, headY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Golden stickman with intense multi-layer glow and sparkles
export function drawGoldenStickman(
  ctx: CanvasRenderingContext2D,
  state: StickmanState,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  pulse: number,
  opacity: number
) {
  if (opacity <= 0) return;

  const screenX = state.x - cameraX + canvasWidth / 2;
  const screenY = state.y - cameraY + canvasHeight / 2;

  if (screenX < -120 || screenX > canvasWidth + 120 || screenY < -120 || screenY > canvasHeight + 120) return;

  ctx.save();
  ctx.translate(screenX, screenY);

  const p = Math.sin(pulse * 0.5);
  const p2 = Math.sin(pulse * 0.7 + 1);

  // Multi-layer glow
  ctx.globalAlpha = opacity * 0.08;
  const outerR = 75 + p * 10;
  const outerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR);
  outerGrad.addColorStop(0, '#ffd700');
  outerGrad.addColorStop(0.5, '#daa520');
  outerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(0, 0, outerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = opacity * 0.12;
  const midR = 40 + p2 * 8;
  const midGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, midR);
  midGrad.addColorStop(0, '#ffe44d');
  midGrad.addColorStop(0.6, '#daa520');
  midGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = midGrad;
  ctx.beginPath();
  ctx.arc(0, 0, midR, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = opacity * 0.2;
  const innerR = 18 + p * 4;
  const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, innerR);
  innerGrad.addColorStop(0, '#fff8dc');
  innerGrad.addColorStop(0.5, '#ffd700');
  innerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting sparkles
  ctx.globalAlpha = opacity;
  for (let i = 0; i < 6; i++) {
    const angle = pulse * 0.3 + (i * Math.PI * 2) / 6;
    const dist = 28 + Math.sin(pulse * 0.5 + i) * 8;
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist;
    const sparkleA = 0.3 + Math.sin(pulse + i * 2) * 0.2;
    ctx.globalAlpha = opacity * sparkleA;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cross sparkles
  ctx.globalAlpha = opacity;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const sparklePhase = pulse * 0.4 + i * 1.5;
    const sparkleAlpha = Math.max(0, Math.sin(sparklePhase)) * 0.4;
    if (sparkleAlpha > 0.05) {
      const len = 12 + Math.sin(sparklePhase) * 6;
      ctx.globalAlpha = opacity * sparkleAlpha;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.stroke();
    }
  }

  // Draw the stickman body in gold
  ctx.globalAlpha = opacity;
  const color = '#daa520';
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;

  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-3, 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(3, 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-4, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(4, 8); ctx.stroke();

  ctx.fillStyle = '#ffd700';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const gridSize = 80;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.018)';
  ctx.lineWidth = 1;

  const startX = Math.floor((cameraX - canvasWidth / 2) / gridSize) * gridSize;
  const startY = Math.floor((cameraY - canvasHeight / 2) / gridSize) * gridSize;
  const endX = cameraX + canvasWidth / 2 + gridSize;
  const endY = cameraY + canvasHeight / 2 + gridSize;

  for (let x = startX; x <= endX; x += gridSize) {
    const sx = x - cameraX + canvasWidth / 2;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, canvasHeight);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const sy = y - cameraY + canvasHeight / 2;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvasWidth, sy);
    ctx.stroke();
  }
}
