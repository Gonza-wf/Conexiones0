import { useRef, useEffect, useCallback, useState } from 'react';
import { useKeyboard } from './hooks/useKeyboard';
import { useTouch } from './hooks/useTouch';
import { useGameLoop } from './hooks/useGameLoop';
import { StickmanState, createStickman, drawStickman, drawSittingStickman, drawGoldenStickman, drawGrid } from './stickman';
import { NPC, GoldenNPC, createNPCs, updateNPCs, createGoldenNPC, updateGoldenNPC, activateGolden, countAliveNPCs } from './npc';
import {
  PoemState, createPoemState, updatePoem, drawPoem,
  showSpecialText, pausePoems, resumePoems,
  GOLDEN_VANISH_TEXT,
  StoryPhase, getCurrentStoryEntry
} from './poems';
import { TrailState, createTrail, updateTrail, drawTrail } from './trail';
import { initAudio, playFootstep, updateGoldenProximity, playGoldenVanish, updateLoneliness, isInitialized, fadeOutAudio } from './audio';

function tryFullscreen() {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } catch (_) { /* ignore */ }
}

function isFullscreen(): boolean {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

interface DirectorState {
  phase: StoryPhase;
  timer: number;
  // Camera
  cameraX: number;
  cameraY: number;
  cameraPanStartX: number;
  cameraPanStartY: number;
  cameraPanTargetX: number;
  cameraPanTargetY: number;
  cameraPanProgress: number;
  cameraPanDuration: number;
  // Ending
  zoomLevel: number;
  sittingProgress: number;
  darknessRadius: number; // 1 = full screen visible, 0 = fully black
  despawnProgress: number; // 0 = all NPCs, 1 = none
  // Control lock
  playerFrozen: boolean;
  titleAlpha: number;
  titleTextAlpha: number;
  endingAlpha: number;
  // Title sequence
  titlePhase: 'showing_title' | 'fading_title' | 'showing_prompt' | 'waiting_input' | 'fading_prompt' | 'done';
  // track when golden text shown
  goldenTextShown: boolean;
  goldenTextDone: boolean;
  audioFadedOut: boolean;
  // has player moved at all (to start the game)
  hasStarted: boolean;
}

function createDirector(): DirectorState {
  return {
    phase: 'title',
    timer: 3,
    cameraX: 0,
    cameraY: 0,
    cameraPanStartX: 0,
    cameraPanStartY: 0,
    cameraPanTargetX: 0,
    cameraPanTargetY: 0,
    cameraPanProgress: 0,
    cameraPanDuration: 2,
    zoomLevel: 1,
    sittingProgress: 0,
    darknessRadius: 1,
    despawnProgress: 0,
    playerFrozen: true,
    titleAlpha: 1,
    titleTextAlpha: 1,
    endingAlpha: 0,
    titlePhase: 'showing_title',
    goldenTextShown: false,
    goldenTextDone: false,
    audioFadedOut: false,
    hasStarted: false,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stickmanRef = useRef<StickmanState>(createStickman(0, 0));
  const npcsRef = useRef<NPC[]>(createNPCs(0, 0));
  const goldenRef = useRef<GoldenNPC>(createGoldenNPC(0, 0));
  const poemRef = useRef<PoemState>(createPoemState());
  const trailRef = useRef<TrailState>(createTrail());
  const directorRef = useRef<DirectorState>(createDirector());
  const timeRef = useRef(0);
  const audioStartedRef = useRef(false);
  const [, setHideUI] = useState(true);
  const keys = useKeyboard();
  const touch = useTouch();

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    const startAudio = () => {
      if (!audioStartedRef.current) {
        initAudio();
        audioStartedRef.current = true;
        tryFullscreen();
      }
    };
    window.addEventListener('keydown', startAudio);
    window.addEventListener('click', startAudio);
    window.addEventListener('touchstart', startAudio);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('click', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
  }, [handleResize]);

  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stickman = stickmanRef.current;
    const npcs = npcsRef.current;
    const golden = goldenRef.current;
    const poem = poemRef.current;
    const trail = trailRef.current;
    const dir = directorRef.current;
    const pressedKeys = keys.current;
    const touchInput = touch.current;

    timeRef.current += dt;

    // ========================
    // CHECK PLAYER INPUT (before director, to detect "has started")
    // ========================
    let wantsToMoveX = 0;
    let wantsToMoveY = 0;

    if (pressedKeys.has('w') || pressedKeys.has('arrowup')) wantsToMoveY -= 1;
    if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) wantsToMoveY += 1;
    if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) wantsToMoveX -= 1;
    if (pressedKeys.has('d') || pressedKeys.has('arrowright')) wantsToMoveX += 1;

    if (touchInput.active) {
      wantsToMoveX = touchInput.dirX;
      wantsToMoveY = touchInput.dirY;
    }

    const wantsToMove = Math.abs(wantsToMoveX) > 0.01 || Math.abs(wantsToMoveY) > 0.01;

    // ========================
    // DIRECTOR STATE MACHINE
    // ========================

    switch (dir.phase) {
      case 'title':
        dir.playerFrozen = true;

        switch (dir.titlePhase) {
          case 'showing_title':
            // Show title for 3 seconds
            dir.timer -= dt;
            if (dir.timer <= 0) {
              dir.titlePhase = 'fading_title';
              dir.timer = 1.5; // fade title text out
            }
            break;

          case 'fading_title':
            dir.timer -= dt;
            dir.titleTextAlpha = Math.max(0, dir.titleTextAlpha - dt * 0.8);
            if (dir.timer <= 0) {
              dir.titleTextAlpha = 0;
              dir.titlePhase = 'showing_prompt';
              dir.timer = 0.5; // brief pause before prompt
            }
            break;

          case 'showing_prompt':
            dir.timer -= dt;
            if (dir.timer <= 0) {
              dir.titlePhase = 'waiting_input';
            }
            break;

          case 'waiting_input':
            // Wait for the player to try to move
            if (wantsToMove) {
              dir.hasStarted = true;
              dir.titlePhase = 'fading_prompt';
              dir.timer = 1.5;
            }
            break;

          case 'fading_prompt':
            dir.timer -= dt;
            dir.titleAlpha = Math.max(0, dir.titleAlpha - dt * 0.8);
            if (dir.titleAlpha <= 0) {
              dir.titleAlpha = 0;
              dir.titlePhase = 'done';
              dir.phase = 'playing';
              dir.playerFrozen = false;
              dir.timer = 0;
              setHideUI(false);
            }
            break;

          case 'done':
            break;
        }
        break;

      case 'playing': {
        dir.playerFrozen = false;
        break;
      }

      case 'golden_pause':
        dir.playerFrozen = true;
        dir.timer -= dt;
        // Pan camera to golden NPC
        dir.cameraPanProgress = Math.min(1, dir.cameraPanProgress + dt / dir.cameraPanDuration);
        {
          const t = easeInOut(dir.cameraPanProgress);
          dir.cameraX = dir.cameraPanStartX + (dir.cameraPanTargetX - dir.cameraPanStartX) * t;
          dir.cameraY = dir.cameraPanStartY + (dir.cameraPanTargetY - dir.cameraPanStartY) * t;
        }
        if (dir.cameraPanProgress >= 1) {
          if (dir.timer <= 0) {
            // Start return pan
            dir.phase = 'golden_return';
            dir.cameraPanStartX = dir.cameraX;
            dir.cameraPanStartY = dir.cameraY;
            dir.cameraPanTargetX = stickman.x;
            dir.cameraPanTargetY = stickman.y;
            dir.cameraPanProgress = 0;
            dir.cameraPanDuration = 2;
          }
        }
        break;

      case 'golden_return':
        dir.playerFrozen = true;
        dir.cameraPanProgress = Math.min(1, dir.cameraPanProgress + dt / dir.cameraPanDuration);
        {
          const t = easeInOut(dir.cameraPanProgress);
          dir.cameraX = dir.cameraPanStartX + (dir.cameraPanTargetX - dir.cameraPanStartX) * t;
          dir.cameraY = dir.cameraPanStartY + (dir.cameraPanTargetY - dir.cameraPanStartY) * t;
        }
        if (dir.cameraPanProgress >= 1) {
          dir.phase = 'golden_hunt';
          dir.playerFrozen = false;
        }
        break;

      case 'golden_hunt':
        dir.playerFrozen = false;
        // If player walks away from golden (ignores it), skip the golden sequence
        {
          const gdx = golden.x - stickman.x;
          const gdy = golden.y - stickman.y;
          const goldenDistSq = gdx * gdx + gdy * gdy;
          if (goldenDistSq > 800 * 800) {
            // Player chose to ignore the golden — it fades away silently
            golden.state = 'fading';
            golden.opacity = Math.max(golden.opacity - 0.5, 0);
            if (golden.opacity <= 0) {
              golden.state = 'gone';
              golden.vanished = true;
            }
            // Skip directly to emptying, no special text
            dir.phase = 'emptying';
            resumePoems(poem);
          }
        }
        break;

      case 'golden_gone':
        dir.playerFrozen = false;
        dir.timer -= dt;
        if (!dir.goldenTextShown) {
          dir.goldenTextShown = true;
          showSpecialText(poem, GOLDEN_VANISH_TEXT);
        }
        // Wait for special text to fade out
        if (dir.goldenTextShown && poem.alpha <= 0 && poem.phase !== 'fadein' && poem.phase !== 'hold') {
          dir.goldenTextDone = true;
        }
        if (dir.goldenTextDone && dir.timer <= 0) {
          dir.phase = 'emptying';
          resumePoems(poem);
        }
        break;

      case 'emptying':
        dir.playerFrozen = false;
        // Sync despawn with poem progress: texts 16-27 map to 0-1
        {
          const emptyStart = 16;
          const emptyEnd = 27; // "Ya no queda nadie a quien espantar."
          const progress = Math.min(1, (poem.index - emptyStart) / (emptyEnd - emptyStart));
          dir.despawnProgress = Math.max(dir.despawnProgress, progress);
          if (dir.despawnProgress < 1) {
            dir.despawnProgress = Math.min(1, dir.despawnProgress + dt * 0.015);
          }
        }
        // Check if poems are done
        if (poem.phase === 'done') {
          const lastEntry = getCurrentStoryEntry(poem.index - 1);
          if (lastEntry && lastEntry.phase === 'final_text') {
            dir.despawnProgress = 1;
            dir.phase = 'final_text';
            dir.timer = 4;
          }
        }
        break;

      case 'final_text':
        dir.playerFrozen = false;
        dir.timer -= dt;
        dir.despawnProgress = 1;
        {
          const alive = countAliveNPCs(npcs);
          if (alive === 0 && poem.alpha <= 0) {
            if (dir.timer <= 0) {
              dir.phase = 'ending_zoom';
              dir.playerFrozen = true;
              dir.timer = 0;
              dir.sittingProgress = 0;
              setHideUI(true);
              if (!dir.audioFadedOut) {
                dir.audioFadedOut = true;
                fadeOutAudio(15);
              }
            }
          }
        }
        break;

      case 'ending_zoom':
        dir.playerFrozen = true;
        // 1) Zoom in very slowly
        if (dir.zoomLevel < 2.2) {
          dir.zoomLevel = Math.min(2.2, dir.zoomLevel + dt * 0.12);
        }
        // 2) Sitting animation starts early
        if (dir.zoomLevel > 1.15) {
          dir.sittingProgress = Math.min(1, dir.sittingProgress + dt * 0.3);
        }
        // 3) Darkness starts creeping in as soon as sitting begins — very slowly
        if (dir.sittingProgress > 0.3) {
          dir.darknessRadius = Math.max(0.12, dir.darknessRadius - dt * 0.025);
          if (dir.darknessRadius <= 0.12) {
            dir.darknessRadius = 0.12;
            // Hold at final darkness for a few seconds then go black
            dir.timer += dt;
            if (dir.timer > 8) {
              dir.phase = 'black';
            }
          }
        }
        break;

      case 'black':
        dir.playerFrozen = true;
        dir.endingAlpha = Math.min(1, dir.endingAlpha + dt * 0.5);
        break;
    }

    // ========================
    // PLAYER INPUT
    // ========================
    let moveX = 0;
    let moveY = 0;

    if (!dir.playerFrozen) {
      moveX = wantsToMoveX;
      moveY = wantsToMoveY;
    }

    const mag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (mag > 0) {
      moveX /= mag;
      moveY /= mag;
      stickman.isMoving = true;
      stickman.direction = Math.atan2(moveY, moveX);
      stickman.x += moveX * stickman.speed * dt;
      stickman.y += moveY * stickman.speed * dt;
      stickman.walkCycle += dt;

      if (isInitialized()) {
        playFootstep();
      }
    } else {
      stickman.isMoving = false;
    }

    // ========================
    // CAMERA (when not in cutscene)
    // ========================
    if (dir.phase !== 'golden_pause' && dir.phase !== 'golden_return') {
      const camLerp = 1 - Math.pow(0.03, dt);
      dir.cameraX += (stickman.x - dir.cameraX) * camLerp;
      dir.cameraY += (stickman.y - dir.cameraY) * camLerp;
    }

    // ========================
    // UPDATE SYSTEMS
    // ========================
    // NPCs
    updateNPCs(npcs, stickman.x, stickman.y, dt, golden.x, golden.y, golden.opacity, dir.despawnProgress);

    // Golden NPC
    const goldenVanished = updateGoldenNPC(golden, stickman.x, stickman.y, dt);

    // Detect golden trigger from poems
    const poemTrigger = updatePoem(poem, stickman.x, stickman.y, dt, stickman.isMoving);

    // If the golden trigger text just finished showing → start cutscene
    if (poemTrigger && dir.phase === 'playing') {
      activateGolden(golden, stickman.x, stickman.y);
      pausePoems(poem);
      dir.phase = 'golden_pause';
      dir.cameraPanStartX = stickman.x;
      dir.cameraPanStartY = stickman.y;
      dir.cameraPanTargetX = golden.x;
      dir.cameraPanTargetY = golden.y;
      dir.cameraPanProgress = 0;
      dir.cameraPanDuration = 2.5;
      dir.timer = 2;
      dir.playerFrozen = true;
    }

    // If golden vanished while player was hunting it
    if (goldenVanished && dir.phase === 'golden_hunt') {
      dir.phase = 'golden_gone';
      dir.timer = 2;
      dir.goldenTextShown = false;
      dir.goldenTextDone = false;
      if (isInitialized()) {
        playGoldenVanish();
      }
    }

    // Trail
    updateTrail(trail, stickman.x, stickman.y, dt, stickman.isMoving);

    // Audio updates
    if (isInitialized()) {
      if (golden.state !== 'hidden' && golden.state !== 'gone') {
        const gdx = golden.x - stickman.x;
        const gdy = golden.y - stickman.y;
        const goldenDist = Math.sqrt(gdx * gdx + gdy * gdy);
        updateGoldenProximity(goldenDist);
      } else {
        updateGoldenProximity(9999);
      }

      let fleeingCount = 0;
      for (const npc of npcs) {
        if (npc.opacity <= 0) continue;
        const ndx = npc.x - stickman.x;
        const ndy = npc.y - stickman.y;
        if (ndx * ndx + ndy * ndy < 250 * 250 && npc.fleeTimer > 0) {
          fleeingCount++;
        }
      }
      updateLoneliness(fleeingCount);
    }

    // ========================
    // RENDER
    // ========================
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);

    // Apply zoom for ending
    if (dir.zoomLevel > 1) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(dir.zoomLevel, dir.zoomLevel);
      ctx.translate(-w / 2, -h / 2);
    }

    // Grid
    drawGrid(ctx, dir.cameraX, dir.cameraY, w, h);

    // Trail
    drawTrail(ctx, trail, dir.cameraX, dir.cameraY, w, h);

    // Draw NPCs
    for (const npc of npcs) {
      if (npc.opacity <= 0) continue;
      drawStickman(ctx, npc, dir.cameraX, dir.cameraY, w, h, npc.color, 1, npc.opacity, timeRef.current, npc.idlePhase);
    }

    // Draw golden NPC
    if (golden.opacity > 0 && golden.state !== 'hidden' && golden.state !== 'gone') {
      drawGoldenStickman(ctx, golden, dir.cameraX, dir.cameraY, w, h, timeRef.current * 2, golden.opacity);
    }

    // Draw player
    if (dir.phase === 'ending_zoom' || dir.phase === 'black') {
      drawSittingStickman(ctx, stickman, dir.cameraX, dir.cameraY, w, h, dir.sittingProgress);
    } else {
      drawStickman(ctx, stickman, dir.cameraX, dir.cameraY, w, h, '#111', 1, 1, timeRef.current, 0);
    }

    // Restore zoom
    if (dir.zoomLevel > 1) {
      ctx.restore();
    }

    // Vignette (standard gameplay)
    if (dir.phase !== 'ending_zoom' && dir.phase !== 'black') {
      const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.min(w, h) * 0.75);
      vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignetteGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Ending darkness — very soft, layered shadow closing around the character
    if ((dir.phase === 'ending_zoom' || dir.phase === 'black') && dir.darknessRadius < 1) {
      const maxR = Math.sqrt(w * w + h * h) / 2;
      const r = dir.darknessRadius * maxR;
      const innerR = Math.max(40, r * 0.3);
      const outerR = Math.max(innerR + 2, r * 1.8);

      // Layer 1: very soft wide shadow
      const grad1 = ctx.createRadialGradient(w / 2, h / 2, innerR * 0.5, w / 2, h / 2, outerR);
      grad1.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad1.addColorStop(0.2, 'rgba(0, 0, 0, 0)');
      grad1.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
      grad1.addColorStop(0.75, 'rgba(0, 0, 0, 0.5)');
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      // Layer 2: tighter, darker shadow
      const grad2 = ctx.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, Math.max(innerR + 2, r));
      grad2.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad2.addColorStop(0.4, 'rgba(0, 0, 0, 0)');
      grad2.addColorStop(0.7, 'rgba(0, 0, 0, 0.4)');
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      // Fill outer area beyond gradient with solid black
      if (r < maxR * 0.8) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.arc(w / 2, h / 2, Math.max(0, outerR), 0, Math.PI * 2, true);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
      }
    }

    // ========================
    // TITLE SCREEN
    // ========================
    if (dir.phase === 'title' || dir.titleAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = dir.titleAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // Title text — "Conexiones: 0"
      if (dir.titleTextAlpha > 0) {
        ctx.globalAlpha = dir.titleAlpha * dir.titleTextAlpha;
        ctx.font = '300 24px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c8c8c8';
        ctx.fillText('Conexiones: 0', w / 2, h / 2);
      }

      // Prompt — "camina para comenzar" (only after title text fades)
      if (dir.titlePhase === 'waiting_input' || dir.titlePhase === 'showing_prompt') {
        const promptAlpha = dir.titlePhase === 'waiting_input'
          ? 0.4 + Math.sin(timeRef.current * 2) * 0.2
          : Math.min(1, (0.5 - dir.timer) / 0.5) * 0.5;
        ctx.globalAlpha = dir.titleAlpha * Math.max(0, promptAlpha);
        ctx.font = '300 11px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#999';
        // Draw spaced text manually for compatibility
        const promptText = 'c a m i n a   p a r a   c o m e n z a r';
        ctx.fillText(promptText, w / 2, h / 2 + 50);
      }

      ctx.restore();
    }

    // Poems (on top of everything except title)
    if (dir.phase !== 'title' && dir.phase !== 'black') {
      drawPoem(ctx, poem, w, h);
    }
  });

  return (
    <div className="w-screen h-screen overflow-hidden bg-black cursor-default select-none touch-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
      {!isFullscreen() && (
        <button
          onClick={() => tryFullscreen()}
          className="fixed top-3 right-3 z-50 bg-transparent border border-gray-700 text-gray-500 rounded px-2 py-1 text-xs opacity-30 hover:opacity-60 transition-opacity"
          style={{ fontSize: '10px' }}
        >
          ⛶
        </button>
      )}
    </div>
  );
}
