export function createAmbientHum() {
  let context = null;
  let master = null;
  let flickerGain = null;
  let started = false;
  let stepFilter = null;
  let lastStepAt = 0;
  let stepNoiseBuffer = null;
  let suspendedByPause = false;

  function start() {
    if (started) return;
    started = true;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.022;
    master.connect(context.destination);

    const lowHum = context.createOscillator();
    lowHum.type = "sine";
    lowHum.frequency.value = 58;
    const highHum = context.createOscillator();
    highHum.type = "triangle";
    highHum.frequency.value = 118;

    const humGain = context.createGain();
    humGain.gain.value = 0.55;
    lowHum.connect(humGain);
    highHum.connect(humGain);
    humGain.connect(master);

    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 840;
    filter.Q.value = 0.8;
    flickerGain = context.createGain();
    flickerGain.gain.value = 0.09;
    noise.connect(filter);
    filter.connect(flickerGain);
    flickerGain.connect(master);

    lowHum.start();
    highHum.start();
    noise.start();

    const stepBufferSize = Math.floor(context.sampleRate * 0.08);
    stepNoiseBuffer = context.createBuffer(1, stepBufferSize, context.sampleRate);
    const stepChannel = stepNoiseBuffer.getChannelData(0);
    for (let i = 0; i < stepBufferSize; i += 1) {
      stepChannel[i] = (Math.random() * 2 - 1) * (1 - i / stepBufferSize);
    }

    stepFilter = context.createBiquadFilter();
    stepFilter.type = "lowpass";
    stepFilter.frequency.value = 1800;
    stepFilter.Q.value = 0.7;
    stepFilter.connect(master);
  }

  function playFootstep({ sprinting }) {
    if (!context || !stepFilter || !stepNoiseBuffer) return;
    if (context.state === "suspended") {
      try {
        context.resume?.();
      } catch {
        // ignore
      }
    }
    const now = context.currentTime;

    const noise = context.createBufferSource();
    noise.buffer = stepNoiseBuffer;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(sprinting ? 1.4 : 1.0, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (sprinting ? 0.18 : 0.16));
    noise.connect(noiseGain);
    noiseGain.connect(stepFilter);
    noise.start(now);
    noise.stop(now + 0.22);

    const thump = context.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(sprinting ? 88 : 72, now);
    thump.frequency.exponentialRampToValueAtTime(sprinting ? 52 : 44, now + 0.1);
    const thumpGain = context.createGain();
    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(sprinting ? 0.7 : 0.55, now + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(now);
    thump.stop(now + 0.16);
  }

  function update(flicker, movementState = {}) {
    if (!context || !flickerGain) return;
    if (context.state === "suspended" && !suspendedByPause) {
      try {
        context.resume?.();
      } catch {
        // ignore
      }
    }
    const now = context.currentTime;
    const level = 0.055 + (1 - flicker) * 0.08;
    flickerGain.gain.setTargetAtTime(level, now, 0.035);

    const moving = Boolean(movementState.moving && movementState.grounded);
    if (!moving) {
      lastStepAt = Math.min(lastStepAt, now);
      return;
    }

    const speed = Math.max(0, movementState.movementSpeed ?? 0);
    const sprinting = Boolean(movementState.sprinting);
    const stepInterval = sprinting
      ? Math.max(0.4, 0.5 - speed * 0.012)
      : Math.max(0.58, 0.72 - speed * 0.025);
    if (now - lastStepAt >= stepInterval) {
      playFootstep({ sprinting });
      lastStepAt = now;
    }
  }

  function suspend() {
    if (!context) return;
    suspendedByPause = true;
    if (context.state === "running") context.suspend?.();
  }

  function resume() {
    if (!context) return;
    suspendedByPause = false;
    if (context.state === "suspended") context.resume?.();
  }

  function isSuspended() {
    return suspendedByPause;
  }

  const entityVoices = new Map();

  function buildBacteriaVoice() {
    const drone = context.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 38;

    const harmonic = context.createOscillator();
    harmonic.type = "sine";
    harmonic.frequency.value = 76;

    const breathLfo = context.createOscillator();
    breathLfo.type = "sine";
    breathLfo.frequency.value = 0.62;
    const breathDepth = context.createGain();
    breathDepth.gain.value = 4;
    breathLfo.connect(breathDepth);
    breathDepth.connect(harmonic.frequency);

    const breathAmp = context.createOscillator();
    breathAmp.type = "sine";
    breathAmp.frequency.value = 0.62;
    const breathAmpDepth = context.createGain();
    breathAmpDepth.gain.value = 0.35;

    const baseGain = context.createGain();
    baseGain.gain.value = 0;

    drone.connect(baseGain);
    harmonic.connect(baseGain);

    drone.start();
    harmonic.start();
    breathLfo.start();
    breathAmp.start();

    return {
      kind: "bacteria",
      baseGain,
      oscillators: [drone, harmonic, breathLfo, breathAmp],
      breathAmp,
      breathAmpDepth,
      baseLevel: 0.13,
    };
  }

  function buildHoundVoice() {
    const growl = context.createOscillator();
    growl.type = "sawtooth";
    growl.frequency.value = 58;

    const snarl = context.createOscillator();
    snarl.type = "sawtooth";
    snarl.frequency.value = 92;

    const growlLfo = context.createOscillator();
    growlLfo.type = "sine";
    growlLfo.frequency.value = 7.5;
    const growlDepth = context.createGain();
    growlDepth.gain.value = 14;
    growlLfo.connect(growlDepth);
    growlDepth.connect(growl.frequency);

    const snarlLfo = context.createOscillator();
    snarlLfo.type = "sine";
    snarlLfo.frequency.value = 9.2;
    const snarlDepth = context.createGain();
    snarlDepth.gain.value = 7;
    snarlLfo.connect(snarlDepth);
    snarlDepth.connect(snarl.frequency);

    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 360;
    filter.Q.value = 1.4;

    const baseGain = context.createGain();
    baseGain.gain.value = 0;

    growl.connect(filter);
    snarl.connect(filter);
    filter.connect(baseGain);

    growl.start();
    snarl.start();
    growlLfo.start();
    snarlLfo.start();

    return {
      kind: "hound",
      baseGain,
      filter,
      oscillators: [growl, snarl, growlLfo, snarlLfo],
      baseLevel: 0.18,
    };
  }

  function ensureEntityVoice(slot) {
    if (!context) return null;
    const existing = entityVoices.get(slot);
    if (existing) return existing;
    const voice = slot === "hound" ? buildHoundVoice() : buildBacteriaVoice();
    voice.baseGain.connect(master);
    entityVoices.set(slot, voice);
    return voice;
  }

  function tearDownEntityVoice(slot) {
    const voice = entityVoices.get(slot);
    if (!voice) return;
    entityVoices.delete(slot);
    try {
      voice.oscillators.forEach((osc) => osc.stop?.());
    } catch {
      // ignore
    }
    voice.oscillators.forEach((osc) => {
      try {
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    if (voice.filter) {
      try {
        voice.filter.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      voice.baseGain.disconnect();
    } catch {
      // ignore
    }
  }

  function updateEntityAudio(entities) {
    if (!context || !master) return;
    if (suspendedByPause || context.state === "closed") return;

    let nearestBacteria = null;
    let nearestHound = null;
    for (const entity of entities ?? []) {
      if (!entity || !entity.active || entity.contact) continue;
      if (!Number.isFinite(entity.distance)) continue;
      if (entity.id === "bacteria" || entity.id === "super-bacteria") {
        if (!nearestBacteria || entity.distance < nearestBacteria.distance) {
          nearestBacteria = entity;
        }
      } else if (entity.id === "hound") {
        if (!nearestHound || entity.distance < nearestHound.distance) {
          nearestHound = entity;
        }
      }
    }

    const now = context.currentTime;
    applySlotVolume("bacteria", nearestBacteria, now);
    applySlotVolume("hound", nearestHound, now);
  }

  function applySlotVolume(slot, nearest, now) {
    const config = ENTITY_AUDIO_CONFIG[slot];
    if (!config) return;
    if (!nearest) {
      const voice = entityVoices.get(slot);
      if (voice) voice.baseGain.gain.setTargetAtTime(0, now, 0.12);
      return;
    }
    const voice = ensureEntityVoice(slot);
    if (!voice) return;

    const { distance } = nearest;
    let ratio;
    if (distance <= config.nearDistance) {
      ratio = 1;
    } else if (distance >= config.maxAudible) {
      ratio = 0;
    } else {
      ratio = 1 - (distance - config.nearDistance) / (config.maxAudible - config.nearDistance);
    }
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;

    const isSuper = nearest.id === "super-bacteria";
    const intensity = isSuper ? config.superIntensity : 1;
    const target = ratio * ratio * voice.baseLevel * intensity;

    voice.baseGain.gain.setTargetAtTime(target, now, 0.08);
  }

  function stopAllEntityAudio() {
    for (const slot of Array.from(entityVoices.keys())) {
      tearDownEntityVoice(slot);
    }
  }

  return {
    start,
    update,
    suspend,
    resume,
    isSuspended,
    updateEntityAudio,
    stopAllEntityAudio,
  };
}

const ENTITY_AUDIO_CONFIG = {
  bacteria: {
    nearDistance: 1.8,
    maxAudible: 30,
    superIntensity: 1.45,
  },
  hound: {
    nearDistance: 2.6,
    maxAudible: 36,
    superIntensity: 1,
  },
};
