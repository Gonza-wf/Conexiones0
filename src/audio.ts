// Generative ambient audio using Web Audio API
// Everything is procedural - no external files needed

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let initialized = false;

// Ambient layers
let droneGain: GainNode | null = null;

// Wind layer
let windNode: AudioBufferSourceNode | null = null;
let windGain: GainNode | null = null;

// Heartbeat
// heartbeat timer handle
let hbTimer = 0;

// Footstep timing
let lastStepTime = 0;

// Golden proximity
let goldenOsc: OscillatorNode | null = null;
let goldenGain: GainNode | null = null;

// Loneliness tone - reacts to nearby fleeing NPCs
let lonelinessOsc: OscillatorNode | null = null;
let lonelinessGain: GainNode | null = null;

function createNoiseBuffer(duration: number, sampleRate: number): AudioBuffer {
  const length = duration * sampleRate;
  const buffer = ctx!.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  return buffer;
}

function startDrone() {
  if (!ctx || !masterGain) return;

  droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  droneGain.connect(masterGain);

  // Deep ambient drone - minor feel
  // Using a low A (55Hz) with a minor third and a diminished fifth for melancholy
  const freqs = [55, 65.41, 77.78]; // A1, C2, Eb2 (A minor-ish, dark)

  const createdOscs: OscillatorNode[] = [];

  freqs.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const oscGain = ctx!.createGain();
    oscGain.gain.value = i === 0 ? 0.12 : 0.06;

    // Add very slow vibrato
    const lfo = ctx!.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + i * 0.07;
    const lfoGain = ctx!.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    osc.connect(oscGain);
    oscGain.connect(droneGain!);
    osc.start();
    createdOscs.push(osc);
  });

  void createdOscs; // keep references alive

  // Fade in slowly
  droneGain.gain.setTargetAtTime(1, ctx.currentTime, 4);
}

function startWind() {
  if (!ctx || !masterGain) return;

  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windGain.connect(masterGain);

  // Filtered noise for wind
  const buffer = createNoiseBuffer(4, ctx.sampleRate);
  windNode = ctx.createBufferSource();
  windNode.buffer = buffer;
  windNode.loop = true;

  // Bandpass filter to shape the wind
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 300;
  bandpass.Q.value = 0.5;

  // Slow modulation of filter
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 150;
  lfo.connect(lfoGain);
  lfoGain.connect(bandpass.frequency);
  lfo.start();

  windNode.connect(bandpass);
  bandpass.connect(windGain);
  windNode.start();

  // Fade in
  windGain.gain.setTargetAtTime(0.04, ctx.currentTime, 3);
}

function startHeartbeat() {
  if (!ctx || !masterGain) return;

  // Subtle heartbeat every ~1.2 seconds (slow, lonely rhythm)
  const beat = () => {
    if (!ctx || !masterGain) return;

    const now = ctx.currentTime;

    // Double beat (lub-dub)
    for (let b = 0; b < 2; b++) {
      const t = now + b * 0.15;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b === 0 ? 50 : 40, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.15);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(b === 0 ? 0.08 : 0.05, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  };

  beat();
  hbTimer = window.setInterval(beat, 2400);
  void hbTimer;
}

function startLoneliness() {
  if (!ctx || !masterGain) return;

  lonelinessGain = ctx.createGain();
  lonelinessGain.gain.value = 0;
  lonelinessGain.connect(masterGain);

  // Low, muffled pad — like distant rumble of emptiness
  lonelinessOsc = ctx.createOscillator();
  lonelinessOsc.type = 'sine';
  lonelinessOsc.frequency.value = 110; // A2, low and warm

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 165; // E3, fifth above

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  filter.Q.value = 1;

  lonelinessOsc.connect(filter);
  osc2.connect(filter);
  filter.connect(lonelinessGain);
  lonelinessOsc.start();
  osc2.start();
}

function startGoldenTone() {
  if (!ctx || !masterGain) return;

  goldenGain = ctx.createGain();
  goldenGain.gain.value = 0;
  goldenGain.connect(masterGain);

  // Ethereal, hopeful tone - perfect fifth interval
  goldenOsc = ctx.createOscillator();
  goldenOsc.type = 'sine';
  goldenOsc.frequency.value = 523.25; // C5

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 659.25; // E5 - major third, hopeful

  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = 783.99; // G5 - perfect fifth

  // Slow shimmer
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 3;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 2;
  lfo.connect(lfoGain);
  lfoGain.connect(goldenOsc.frequency);
  lfo.start();

  const g2 = ctx.createGain();
  g2.gain.value = 0.6;
  const g3 = ctx.createGain();
  g3.gain.value = 0.4;

  goldenOsc.connect(goldenGain);
  osc2.connect(g2);
  g2.connect(goldenGain);
  osc3.connect(g3);
  g3.connect(goldenGain);

  goldenOsc.start();
  osc2.start();
  osc3.start();
}

// Schedule random ethereal chimes in the distance
function scheduleChimes() {
  if (!ctx || !masterGain) return;

  const playChime = () => {
    if (!ctx || !masterGain) return;

    const now = ctx.currentTime;
    // Pentatonic minor notes for melancholy
    const notes = [220, 261.63, 293.66, 349.23, 392, 440, 523.25, 587.33];
    const note = notes[Math.floor(Math.random() * notes.length)];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.015, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(now);
    osc.stop(now + 3.5);

    // Schedule next chime
    const nextDelay = 3000 + Math.random() * 8000;
    setTimeout(playChime, nextDelay);
  };

  // Start after a delay
  setTimeout(playChime, 2000);
}

// Public API

export function initAudio() {
  if (initialized) return;

  try {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);

    startDrone();
    startWind();
    startHeartbeat();
    startLoneliness();
    startGoldenTone();
    scheduleChimes();

    initialized = true;
  } catch {
    // Audio not supported
  }
}

export function playFootstep() {
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  if (now - lastStepTime < 0.28) return;
  lastStepTime = now;

  // Soft footstep: short noise burst with lowpass filter
  const buffer = createNoiseBuffer(0.08, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400 + Math.random() * 200;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(now);
  source.stop(now + 0.1);
}

export function updateGoldenProximity(distance: number) {
  if (!goldenGain || !ctx) return;

  // Fades in as you get closer (within 300px)
  const maxDist = 300;
  if (distance < maxDist) {
    const intensity = 1 - distance / maxDist;
    const vol = intensity * intensity * 0.04;
    goldenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  } else {
    goldenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  }
}

export function playGoldenVanish() {
  if (!ctx || !masterGain) return;

  // Descending tone - hope disappearing
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 1.5);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 1.6);
}

export function updateLoneliness(nearbyFleeingCount: number) {
  if (!lonelinessGain || !ctx) return;

  // More people fleeing = subtle low rumble
  const intensity = Math.min(nearbyFleeingCount / 20, 1);
  const vol = intensity * 0.05;
  lonelinessGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.5);
}

export function isInitialized(): boolean {
  return initialized;
}

// Fade out all audio for the ending
export function fadeOutAudio(duration: number = 8) {
  if (!ctx || !masterGain) return;
  masterGain.gain.setTargetAtTime(0, ctx.currentTime, duration / 3);
  
  // Stop heartbeat
  if (hbTimer) {
    clearInterval(hbTimer);
    hbTimer = 0;
  }
}
