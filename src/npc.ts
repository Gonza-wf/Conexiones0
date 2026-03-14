import { StickmanState } from './stickman';

export interface NPC extends StickmanState {
  color: string;
  fleeTimer: number;
  idleTimer: number;
  wanderDirX: number;
  wanderDirY: number;
  opacity: number;
  dying: boolean; // fading out permanently
  idlePhase: number; // random phase for idle animation
}

const NPC_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22',
  '#1abc9c', '#f39c12', '#e84393', '#0984e3', '#6c5ce7',
  '#00b894', '#fd79a8', '#d63031', '#a29bfe', '#55efc4',
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400',
  '#16a085', '#f1c40f', '#e91e63', '#03a9f4', '#673ab7',
  '#ff7043', '#26a69a', '#ab47bc', '#42a5f5', '#66bb6a',
  '#ef5350', '#5c6bc0', '#ffa726', '#ec407a', '#7e57c2',
];

const FLEE_RADIUS = 140;
const FLEE_SPEED = 200;
const WANDER_SPEED = 30;
const SOCIAL_SPEED = 20;
const NPC_COUNT = 2000;
const SOCIAL_RADIUS = 200;

const GOLDEN_FLEE_RADIUS = 120;
const GOLDEN_FLEE_RADIUS_SQ = GOLDEN_FLEE_RADIUS * GOLDEN_FLEE_RADIUS;
const GOLDEN_FLEE_SPEED = 90;

// Recycling distances
const RECYCLE_FAR = 2800;
const RECYCLE_FAR_SQ = RECYCLE_FAR * RECYCLE_FAR;
const SPAWN_NEAR = 900;
const SPAWN_FAR = 2500;
const RECYCLE_BATCH = 40;

function spawnPosition(centerX: number, centerY: number, minR: number, maxR: number): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = minR + Math.random() * (maxR - minR);
  return {
    x: centerX + Math.cos(angle) * dist,
    y: centerY + Math.sin(angle) * dist,
  };
}

export function createNPCs(centerX: number, centerY: number): NPC[] {
  const npcs: NPC[] = [];

  for (let i = 0; i < NPC_COUNT; i++) {
    const pos = spawnPosition(centerX, centerY, 200, 2500);
    const color = NPC_COLORS[i % NPC_COLORS.length];

    npcs.push({
      x: pos.x,
      y: pos.y,
      direction: 0,
      walkCycle: Math.random() * 10,
      isMoving: false,
      speed: WANDER_SPEED,
      color,
      fleeTimer: 0,
      idleTimer: Math.random() * 4,
      wanderDirX: 0,
      wanderDirY: 0,
      opacity: 1,
      dying: false,
      idlePhase: Math.random() * Math.PI * 2,
    });
  }

  return npcs;
}

const FLEE_R_SQ = FLEE_RADIUS * FLEE_RADIUS;
const SOCIAL_R_SQ = SOCIAL_RADIUS * SOCIAL_RADIUS;
const UPDATE_RANGE = 2500;
const UPDATE_RANGE_SQ = UPDATE_RANGE * UPDATE_RANGE;

// How many NPCs should be alive based on despawn progress (0 = all, 1 = none)
export function updateNPCs(
  npcs: NPC[],
  playerX: number,
  playerY: number,
  dt: number,
  goldenX: number,
  goldenY: number,
  goldenOpacity: number,
  despawnProgress: number // 0 to 1, how many NPCs should be gone
) {
  let recycled = 0;
  const targetAlive = Math.floor(NPC_COUNT * (1 - despawnProgress));

  // Count alive NPCs
  let aliveCount = 0;
  for (const npc of npcs) {
    if (!npc.dying && npc.opacity > 0) aliveCount++;
  }

  // Mark NPCs for dying if we have too many
  if (aliveCount > targetAlive) {
    let toKill = aliveCount - targetAlive;
    // When despawnProgress is 1, kill ALL remaining regardless of distance
    const forceKillAll = despawnProgress >= 1;
    // Kill farthest NPCs from player first
    for (let i = npcs.length - 1; i >= 0 && toKill > 0; i--) {
      const npc = npcs[i];
      if (!npc.dying && npc.opacity > 0) {
        if (forceKillAll) {
          npc.dying = true;
          toKill--;
        } else {
          const dx = npc.x - playerX;
          const dy = npc.y - playerY;
          const dSq = dx * dx + dy * dy;
          // Only kill ones that are off screen (far away)
          if (dSq > 600 * 600) {
            npc.dying = true;
            toKill--;
          }
        }
      }
    }
  }

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];

    // Handle dying NPCs — fade out (faster when despawning heavily)
    if (npc.dying) {
      const fadeSpeed = despawnProgress > 0.8 ? 1.5 : 0.5;
      npc.opacity = Math.max(0, npc.opacity - dt * fadeSpeed);
      continue;
    }

    if (npc.opacity <= 0) continue;

    const dx = npc.x - playerX;
    const dy = npc.y - playerY;
    const distSq = dx * dx + dy * dy;

    // Recycle NPCs that are too far (only if not in despawn mode)
    if (despawnProgress <= 0 && distSq > RECYCLE_FAR_SQ && recycled < RECYCLE_BATCH) {
      const pos = spawnPosition(playerX, playerY, SPAWN_NEAR, SPAWN_FAR);
      npc.x = pos.x;
      npc.y = pos.y;
      npc.fleeTimer = 0;
      npc.isMoving = false;
      npc.idleTimer = 1 + Math.random() * 3;
      npc.walkCycle = Math.random() * 10;
      recycled++;
      continue;
    }

    // Flee from golden NPC
    if (goldenOpacity > 0.2) {
      const gdx = npc.x - goldenX;
      const gdy = npc.y - goldenY;
      const gDistSq = gdx * gdx + gdy * gdy;
      if (gDistSq < GOLDEN_FLEE_RADIUS_SQ) {
        const gDist = Math.sqrt(gDistSq) || 1;
        const gnx = gdx / gDist;
        const gny = gdy / gDist;
        npc.x += gnx * GOLDEN_FLEE_SPEED * dt;
        npc.y += gny * GOLDEN_FLEE_SPEED * dt;
        npc.isMoving = true;
        npc.walkCycle += dt;
        continue;
      }
    }

    // Flee from player
    if (distSq < FLEE_R_SQ) {
      const dist = Math.sqrt(distSq) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      npc.x += nx * FLEE_SPEED * dt;
      npc.y += ny * FLEE_SPEED * dt;
      npc.isMoving = true;
      npc.walkCycle += dt;
      npc.fleeTimer = 1.0;
    } else if (npc.fleeTimer > 0) {
      npc.fleeTimer -= dt;
      const dist = Math.sqrt(distSq) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      npc.x += nx * FLEE_SPEED * 0.5 * dt;
      npc.y += ny * FLEE_SPEED * 0.5 * dt;
      npc.isMoving = true;
      npc.walkCycle += dt;
    } else if (distSq < UPDATE_RANGE_SQ) {
      // Social behavior
      let socialX = 0;
      let socialY = 0;
      let socialCount = 0;

      const checkRange = Math.min(npcs.length, 50);
      const startIdx = Math.max(0, i - 25);
      for (let j = startIdx; j < Math.min(startIdx + checkRange, npcs.length); j++) {
        if (j === i) continue;
        const other = npcs[j];
        if (other.dying || other.opacity <= 0) continue;
        const sdx = other.x - npc.x;
        const sdy = other.y - npc.y;
        const sdSq = sdx * sdx + sdy * sdy;
        if (sdSq < SOCIAL_R_SQ && sdSq > 400) {
          socialCount++;
          socialX += sdx;
          socialY += sdy;
        }
      }

      npc.idleTimer -= dt;

      if (npc.idleTimer <= 0) {
        if (npc.isMoving) {
          npc.isMoving = false;
          npc.idleTimer = 2 + Math.random() * 4;
        } else {
          if (socialCount > 0) {
            const avgX = socialX / socialCount;
            const avgY = socialY / socialCount;
            const len = Math.sqrt(avgX * avgX + avgY * avgY) || 1;
            npc.wanderDirX = avgX / len;
            npc.wanderDirY = avgY / len;
          } else {
            const angle = Math.random() * Math.PI * 2;
            npc.wanderDirX = Math.cos(angle);
            npc.wanderDirY = Math.sin(angle);
          }
          npc.isMoving = true;
          npc.idleTimer = 1 + Math.random() * 2;
        }
      }

      if (npc.isMoving) {
        const sp = socialCount > 0 ? SOCIAL_SPEED : WANDER_SPEED;
        npc.x += npc.wanderDirX * sp * dt;
        npc.y += npc.wanderDirY * sp * dt;
        npc.walkCycle += dt;
      }
    }
  }
}

// Count visible NPCs
export function countAliveNPCs(npcs: NPC[]): number {
  let count = 0;
  for (const npc of npcs) {
    if (!npc.dying && npc.opacity > 0) count++;
  }
  return count;
}

// Golden NPC - the hope (only appears once)
export interface GoldenNPC extends StickmanState {
  opacity: number;
  state: 'hidden' | 'appearing' | 'idle' | 'fading' | 'gone';
  hiddenTimer: number;
  vanished: boolean; // true once it's gone forever
}

export function createGoldenNPC(playerX: number, playerY: number): GoldenNPC {
  const angle = Math.random() * Math.PI * 2;
  const dist = 500 + Math.random() * 400;
  return {
    x: playerX + Math.cos(angle) * dist,
    y: playerY + Math.sin(angle) * dist,
    direction: 0,
    walkCycle: 0,
    isMoving: false,
    speed: 0,
    opacity: 0,
    state: 'hidden', // starts hidden, activated by story
    hiddenTimer: 0,
    vanished: false,
  };
}

const GOLDEN_FADE_RADIUS = 90;
const GOLDEN_FADE_SQ = GOLDEN_FADE_RADIUS * GOLDEN_FADE_RADIUS;
const FADE_IN_SPEED = 0.3;
const FADE_OUT_SPEED = 0.4;

export function activateGolden(golden: GoldenNPC, playerX: number, playerY: number) {
  // Place it in a visible but distant position
  const angle = Math.random() * Math.PI * 2;
  const dist = 500 + Math.random() * 300;
  golden.x = playerX + Math.cos(angle) * dist;
  golden.y = playerY + Math.sin(angle) * dist;
  golden.state = 'appearing';
  golden.opacity = 0;
}

// Returns 'vanished' when the golden disappears forever
export function updateGoldenNPC(golden: GoldenNPC, playerX: number, playerY: number, dt: number): boolean {
  if (golden.state === 'hidden' || golden.state === 'gone') return false;

  const dx = golden.x - playerX;
  const dy = golden.y - playerY;
  const distSq = dx * dx + dy * dy;

  switch (golden.state) {
    case 'appearing':
      golden.opacity = Math.min(golden.opacity + FADE_IN_SPEED * dt, 1);
      if (golden.opacity >= 1) {
        golden.state = 'idle';
      }
      if (distSq < GOLDEN_FADE_SQ) {
        golden.state = 'fading';
      }
      break;

    case 'idle':
      golden.opacity = 1;
      if (distSq < GOLDEN_FADE_SQ) {
        golden.state = 'fading';
      }
      break;

    case 'fading':
      golden.opacity = Math.max(golden.opacity - FADE_OUT_SPEED * dt, 0);
      if (golden.opacity <= 0) {
        golden.state = 'gone';
        golden.vanished = true;
        return true; // vanished forever
      }
      break;
  }

  return false;
}
