export type StoryPhase =
  | 'title'
  | 'playing'
  | 'golden_pause'
  | 'golden_return'
  | 'golden_hunt'
  | 'golden_gone'
  | 'emptying'
  | 'final_text'
  | 'ending_zoom'
  | 'black'

const STORY_TEXTS: { text: string; phase: 'playing' | 'emptying' | 'final_text' }[] = [
  // Act 1 — Discovery
  { text: "Caminas.", phase: 'playing' },
  { text: "No sabes hacia dónde.", phase: 'playing' },
  { text: "Hay gente por todas partes.", phase: 'playing' },
  { text: "Eso debería ser suficiente.", phase: 'playing' },

  // Act 2 — Realization
  { text: "Pero nadie se queda.", phase: 'playing' },
  { text: "Cada paso que das aleja a alguien.", phase: 'playing' },
  { text: "Intentas acercarte.", phase: 'playing' },
  { text: "Se van.", phase: 'playing' },
  { text: "Siempre se van.", phase: 'playing' },

  // Act 3 — Contrast
  { text: "Ellos se buscan entre sí.", phase: 'playing' },
  { text: "Forman grupos. Familias. Círculos.", phase: 'playing' },
  { text: "Tú solo formas espacio vacío.", phase: 'playing' },
  { text: "¿Qué tienen ellos que tú no?", phase: 'playing' },
  { text: "Tal vez nada.", phase: 'playing' },
  { text: "Tal vez todo.", phase: 'playing' },

  // Act 4 — Golden trigger (index 15)
  { text: "Hay alguien diferente a lo lejos. Brilla.", phase: 'playing' },

  // Act 5 — After golden vanishes (index 16+)
  { text: "Sigues caminando.", phase: 'emptying' },
  { text: "¿Por qué?", phase: 'emptying' },
  { text: "Hay menos gente ahora.", phase: 'emptying' },
  { text: "O quizá siempre fue así.", phase: 'emptying' },
  { text: "Solo no lo notabas.", phase: 'emptying' },
  { text: "El mundo se siente más grande cuando estás solo.", phase: 'emptying' },
  { text: "Las voces se apagan.", phase: 'emptying' },
  { text: "Los pasos ajenos se pierden.", phase: 'emptying' },
  { text: "El silencio no es la ausencia de ruido.", phase: 'emptying' },
  { text: "Es la ausencia de alguien que lo rompa.", phase: 'emptying' },
  { text: "Ya no queda nadie a quien espantar.", phase: 'emptying' },

  // Act 6 — Final
  { text: "Solo tú.", phase: 'final_text' },
];

export const GOLDEN_VANISH_TEXT = "No. También se fue.";
export const GOLDEN_TRIGGER_INDEX = 15;

export interface PoemState {
  currentText: string;
  alpha: number;
  phase: 'fadein' | 'hold' | 'fadeout' | 'wait' | 'done' | 'paused';
  timer: number;
  index: number;
  distanceTraveled: number;
  lastX: number;
  lastY: number;
  triggered: boolean;
  _special: boolean;
}

export function createPoemState(): PoemState {
  return {
    currentText: '',
    alpha: 0,
    phase: 'wait',
    timer: 4,
    index: 0,
    distanceTraveled: 0,
    lastX: 0,
    lastY: 0,
    triggered: false,
    _special: false,
  };
}

export function getCurrentStoryEntry(index: number) {
  if (index >= STORY_TEXTS.length) return null;
  return STORY_TEXTS[index];
}

export function getTotalTexts() {
  return STORY_TEXTS.length;
}

export function showSpecialText(state: PoemState, text: string) {
  state.currentText = text;
  state.alpha = 0;
  state.phase = 'fadein';
  state.timer = 2;
  state._special = true;
}

export function pausePoems(state: PoemState) {
  state.phase = 'paused';
}

export function resumePoems(state: PoemState) {
  state.phase = 'wait';
  state.timer = 3;
  state.distanceTraveled = 0;
}

export function updatePoem(state: PoemState, playerX: number, playerY: number, dt: number, isMoving: boolean): boolean {
  if (state.phase === 'done' || state.phase === 'paused') return false;

  if (state.triggered) {
    const dx = playerX - state.lastX;
    const dy = playerY - state.lastY;
    state.distanceTraveled += Math.sqrt(dx * dx + dy * dy);
  } else {
    state.triggered = true;
  }
  state.lastX = playerX;
  state.lastY = playerY;

  state.timer -= dt;

  switch (state.phase) {
    case 'wait':
      if (state.timer <= 0 && isMoving && state.distanceTraveled > 200) {
        if (state.index >= STORY_TEXTS.length) {
          state.phase = 'done';
          return false;
        }
        state.currentText = STORY_TEXTS[state.index].text;
        state.phase = 'fadein';
        state.timer = 2.5;
        state.distanceTraveled = 0;
      }
      break;
    case 'fadein':
      state.alpha = Math.min(1, state.alpha + dt * 0.6);
      if (state.timer <= 0) {
        state.alpha = 1;
        state.phase = 'hold';
        state.timer = 3.5 + state.currentText.length * 0.08;
      }
      break;
    case 'hold':
      if (state.timer <= 0) {
        state.phase = 'fadeout';
        state.timer = 2.5;
      }
      break;
    case 'fadeout':
      state.alpha = Math.max(0, state.alpha - dt * 0.4);
      if (state.timer <= 0) {
        state.alpha = 0;

        if (state._special) {
          state._special = false;
          state.phase = 'paused';
          return false;
        }

        const justFinished = state.index;
        state.phase = 'wait';
        state.timer = 3 + Math.random() * 1.5;
        state.index++;
        if (state.index >= STORY_TEXTS.length) {
          state.phase = 'done';
        }
        if (justFinished === GOLDEN_TRIGGER_INDEX) {
          return true;
        }
      }
      break;
  }

  return false;
}

export function drawPoem(ctx: CanvasRenderingContext2D, state: PoemState, canvasWidth: number, canvasHeight: number) {
  if (state.alpha <= 0 || !state.currentText) return;

  const textScale = 0.92 + state.alpha * 0.08;

  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight * 0.16);
  ctx.scale(textScale, textScale);
  ctx.font = '15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(80, 80, 80, ${state.alpha * 0.6})`;
  ctx.fillText(state.currentText, 0, 0);
  ctx.restore();
}
