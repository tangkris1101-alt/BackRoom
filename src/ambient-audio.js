import * as THREE from "three";
import breathingTiredUrl from "./assets/audio/breathing-tired.ogg?url";
import levelFiveJazzUrl from "./assets/audio/level-five-jazz-improv.mp3?url";
import { getFootstepProfile, normalizeFootstepSurface } from "./scene/common/footstep-surfaces.js";

const AUDIO_VOLUME_KEYS = Object.freeze({
  master: "backrooms:audio:master",
  ambient: "backrooms:audio:ambient",
  music: "backrooms:audio:music",
});

function loadVolume(key, fallback) {
  try {
    const stored = window.localStorage?.getItem(key);
    if (stored === null || stored === undefined || stored === "") return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  } catch {
    return fallback;
  }
}

export function createAmbientHum() {
  let context = null;
  let master = null;
  let ambientBus = null;
  let foleyBus = null;
  let entityBus = null;
  let musicBus = null;
  let reverbInput = null;
  let reverbConvolver = null;
  let reverbGain = null;
  let flickerGain = null;
  let started = false;
  let lastStepAt = 0;
  let stepNoiseBuffer = null;
  let stepSide = -1;
  let stepVariant = 0;
  let lastLandingImpact = 0;
  let suspendedByPause = false;
  let breathAudio = null;
  let breathGain = null;
  let hotelJazzAudio = null;
  let hotelJazzGain = null;
  let hotelJazzPanner = null;
  let activeReverb = "";
  const impulseResponses = new Map();
  const fixtureVoices = [];
  const volumes = {
    master: loadVolume(AUDIO_VOLUME_KEYS.master, 0.78),
    ambient: loadVolume(AUDIO_VOLUME_KEYS.ambient, 0.86),
    music: loadVolume(AUDIO_VOLUME_KEYS.music, 0.68),
  };

  function start() {
    if (started) return;
    started = true;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.028 * volumes.master;
    master.connect(context.destination);

    ambientBus = context.createGain();
    foleyBus = context.createGain();
    entityBus = context.createGain();
    musicBus = context.createGain();
    ambientBus.gain.value = volumes.ambient;
    foleyBus.gain.value = 1;
    entityBus.gain.value = 1;
    musicBus.gain.value = volumes.music;
    ambientBus.connect(master);
    foleyBus.connect(master);
    entityBus.connect(master);
    musicBus.connect(master);

    reverbInput = context.createGain();
    reverbInput.gain.value = 0.34;
    reverbConvolver = context.createConvolver();
    reverbGain = context.createGain();
    reverbGain.gain.value = 0.16;
    reverbInput.connect(reverbConvolver);
    reverbConvolver.connect(reverbGain);
    reverbGain.connect(master);
    ambientBus.connect(reverbInput);
    foleyBus.connect(reverbInput);
    entityBus.connect(reverbInput);

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
    humGain.connect(ambientBus);

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
    flickerGain.connect(ambientBus);

    lowHum.start();
    highHum.start();
    noise.start();

    const stepBufferSize = Math.floor(context.sampleRate * 0.26);
    stepNoiseBuffer = context.createBuffer(1, stepBufferSize, context.sampleRate);
    const stepChannel = stepNoiseBuffer.getChannelData(0);
    for (let i = 0; i < stepBufferSize; i += 1) {
      stepChannel[i] = (Math.random() * 2 - 1) * (1 - i / stepBufferSize);
    }

    breathAudio = new Audio(breathingTiredUrl);
    breathAudio.loop = true;
    breathAudio.preload = "auto";
    breathAudio.crossOrigin = "anonymous";
    const breathSource = context.createMediaElementSource(breathAudio);
    const breathFilter = context.createBiquadFilter();
    breathFilter.type = "lowpass";
    breathFilter.frequency.value = 3200;
    breathGain = context.createGain();
    breathGain.gain.value = 0;
    breathSource.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(foleyBus);
    breathAudio.play().catch(() => {});

    hotelJazzAudio = new Audio(levelFiveJazzUrl);
    hotelJazzAudio.loop = true;
    hotelJazzAudio.preload = "auto";
    hotelJazzAudio.crossOrigin = "anonymous";
    hotelJazzAudio.volume = 1;
    const hotelJazzSource = context.createMediaElementSource(hotelJazzAudio);
    const hotelJazzFilter = context.createBiquadFilter();
    hotelJazzFilter.type = "lowpass";
    hotelJazzFilter.frequency.value = 1680;
    hotelJazzGain = context.createGain();
    hotelJazzGain.gain.value = 0;
    hotelJazzPanner = context.createStereoPanner?.() ?? context.createGain();
    hotelJazzSource.connect(hotelJazzFilter);
    hotelJazzFilter.connect(hotelJazzPanner);
    hotelJazzPanner.connect(hotelJazzGain);
    hotelJazzGain.connect(musicBus);
    hotelJazzAudio.play().catch(() => {});
  }

  // Chrome logs an autoplay warning for every resume() attempt made before a
  // real user gesture, so only try once interaction has actually occurred.
  function tryUnlockContext() {
    if (!context || context.state !== "suspended") return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      context.resume?.();
    } catch {
      // ignore
    }
  }

  function playFootstep({ sprinting, surface, intensity = 1 }) {
    if (!context || !master || !stepNoiseBuffer) return;
    tryUnlockContext();
    const now = context.currentTime;
    const profile = getFootstepProfile(surface);
    const effort = (sprinting ? 1.28 : 1) * Math.max(0.55, Math.min(1.8, intensity));
    const variants = [0.93, 1, 1.07];
    const pitchVariation = variants[stepVariant % variants.length] * (0.985 + Math.random() * 0.03);
    stepVariant += 1;
    stepSide *= -1;

    const output = context.createGain();
    output.gain.value = effort;
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = stepSide * 0.12;
      output.connect(panner);
      panner.connect(foleyBus ?? master);
    } else {
      output.connect(foleyBus ?? master);
    }

    const noise = context.createBufferSource();
    noise.buffer = stepNoiseBuffer;
    noise.playbackRate.value = pitchVariation;
    const stepFilter = context.createBiquadFilter();
    stepFilter.type = profile.filterType;
    stepFilter.frequency.value = profile.cutoff * pitchVariation;
    stepFilter.Q.value = profile.q;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(profile.noiseGain, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration);
    noise.connect(noiseGain);
    noiseGain.connect(stepFilter);
    stepFilter.connect(output);
    noise.start(now);
    noise.stop(now + profile.duration + 0.03);

    const thump = context.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(profile.thumpStart * pitchVariation, now);
    thump.frequency.exponentialRampToValueAtTime(profile.thumpEnd * pitchVariation, now + 0.1);
    const thumpGain = context.createGain();
    thumpGain.gain.setValueAtTime(0.001, now);
    thumpGain.gain.linearRampToValueAtTime(profile.thumpGain, now + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    thump.connect(thumpGain);
    thumpGain.connect(output);
    thump.start(now);
    thump.stop(now + 0.16);
    let cleanupSource = thump;

    if (profile.toneType) {
      const tone = context.createOscillator();
      tone.type = profile.toneType;
      tone.frequency.setValueAtTime(profile.toneStart * pitchVariation, now);
      tone.frequency.exponentialRampToValueAtTime(profile.toneEnd * pitchVariation, now + profile.toneDuration);
      const toneGain = context.createGain();
      toneGain.gain.setValueAtTime(0.001, now);
      toneGain.gain.linearRampToValueAtTime(profile.toneGain, now + 0.005);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + profile.toneDuration);
      tone.connect(toneGain);
      toneGain.connect(output);
      tone.start(now);
      tone.stop(now + profile.toneDuration + 0.02);
      if (profile.toneDuration + 0.02 >= 0.16) cleanupSource = tone;
    }
    cleanupSource.addEventListener("ended", () => output.disconnect(), { once: true });
  }

  function update(flicker, movementState = {}) {
    if (!context || !flickerGain) return;
    if (!suspendedByPause) tryUnlockContext();
    const now = context.currentTime;
    const level = 0.055 + (1 - flicker) * 0.08;
    flickerGain.gain.setTargetAtTime(level, now, 0.035);
    if (breathGain && breathAudio) {
      const staminaRatio = Math.max(0, Math.min(1, (movementState.stamina ?? 100) / Math.max(1, movementState.staminaMax ?? 100)));
      const healthRatio = Math.max(0, Math.min(1, (movementState.health ?? 100) / Math.max(1, movementState.healthMax ?? 100)));
      const exertion = Math.max(
        movementState.sprinting ? 0.72 : movementState.moving ? 0.18 : 0,
        (1 - staminaRatio) * 0.92,
        (1 - healthRatio) * 0.7,
      );
      const breathLevel = exertion < 0.12 ? 0.006 : 0.025 + exertion * 0.24;
      breathGain.gain.setTargetAtTime(breathLevel, now, exertion > 0.5 ? 0.2 : 0.85);
      breathAudio.playbackRate = 0.68 + exertion * 0.72;
    }

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
      playFootstep({ sprinting, surface: normalizeFootstepSurface(movementState.footstepSurface) });
      lastStepAt = now;
    }

    const landingImpact = Math.max(0, movementState.landingImpact ?? 0);
    if (landingImpact > 0.18 && landingImpact > lastLandingImpact + 0.08) {
      playFootstep({
        sprinting: false,
        surface: normalizeFootstepSurface(movementState.footstepSurface),
        intensity: 0.9 + landingImpact * 0.72,
      });
    }
    lastLandingImpact = landingImpact;
  }

  function updateLevelAudio(level) {
    if (!context || !hotelJazzGain || !hotelJazzAudio) return;
    const now = context.currentTime;
    const inHotel = Number(level) === 5;
    hotelJazzGain.gain.setTargetAtTime(inHotel ? 0.66 : 0, now, inHotel ? 1.5 : 0.65);
    hotelJazzAudio.playbackRate = inHotel ? 0.92 : 1;
    if (inHotel) hotelJazzAudio.play().catch(() => {});
  }

  function createImpulseResponse(kind) {
    if (!context) return null;
    if (impulseResponses.has(kind)) return impulseResponses.get(kind);
    const config = {
      small: [0.42, 3.8],
      medium: [0.82, 3.1],
      large: [1.45, 2.7],
      cavern: [2.1, 2.25],
      open: [0.18, 5.2],
    }[kind] ?? [0.82, 3.1];
    const length = Math.max(1, Math.floor(context.sampleRate * config[0]));
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);
      for (let index = 0; index < length; index += 1) {
        const envelope = Math.pow(1 - index / length, config[1]);
        channel[index] = (Math.random() * 2 - 1) * envelope;
      }
    }
    impulseResponses.set(kind, buffer);
    return buffer;
  }

  function resolveEmitterPosition(emitter, target) {
    if (emitter?.object?.getWorldPosition) return emitter.object.getWorldPosition(target);
    if (emitter?.position) return target.copy(emitter.position);
    return target.set(0, 0, 0);
  }

  function getSpatialState(source, listenerPosition, listenerDirection, world, maxDistance = 30) {
    const dx = source.x - listenerPosition.x;
    const dz = source.z - listenerPosition.z;
    const distance = Math.hypot(dx, dz);
    const rightX = -(listenerDirection?.z ?? -1);
    const rightZ = listenerDirection?.x ?? 0;
    const pan = distance > 0.001 ? Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / distance)) : 0;
    let blocked = 0;
    if (world?.isWalkable && distance > 3) {
      const samples = Math.min(12, Math.max(3, Math.ceil(distance / 3)));
      for (let index = 1; index < samples; index += 1) {
        const ratio = index / samples;
        if (!world.isWalkable(listenerPosition.x + dx * ratio, listenerPosition.z + dz * ratio, 0.05)) blocked += 1;
      }
    }
    return {
      distance,
      pan,
      occlusion: Math.min(1, blocked / 2),
      gain: Math.max(0, 1 - distance / Math.max(1, maxDistance)),
    };
  }

  function buildFixtureVoice() {
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 116 + fixtureVoices.length * 2.4;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    const panner = context.createStereoPanner?.() ?? context.createGain();
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(ambientBus ?? master);
    oscillator.start();
    return { oscillator, filter, panner, gain };
  }

  function updateWorldAudio(world, camera, listenerDirection) {
    if (!context || !camera) return { zone: "", nearestEmitter: "", occlusion: 0 };
    const zone = world?.audioZones?.find((entry) => entry.contains?.(camera.position) !== false) ?? null;
    const reverb = zone?.reverb ?? world?.presentation?.reverb ?? "medium";
    if (reverb !== activeReverb && reverbConvolver) {
      reverbConvolver.buffer = createImpulseResponse(reverb);
      activeReverb = reverb;
      if (reverbGain) reverbGain.gain.setTargetAtTime(reverb === "open" ? 0.05 : 0.16, context.currentTime, 0.12);
    }

    const sourcePosition = new THREE.Vector3();
    const fixtureEmitters = (world?.audioEmitters ?? [])
      .filter((emitter) => emitter.type === "fixture-hum")
      .map((emitter) => {
        resolveEmitterPosition(emitter, sourcePosition);
        return { emitter, position: sourcePosition.clone(), distance: sourcePosition.distanceTo(camera.position) };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    while (fixtureVoices.length < fixtureEmitters.length) fixtureVoices.push(buildFixtureVoice());
    fixtureVoices.forEach((voice, index) => {
      const entry = fixtureEmitters[index];
      if (!entry) {
        voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
        return;
      }
      const spatial = getSpatialState(entry.position, camera.position, listenerDirection, world, entry.emitter.maxDistance);
      if ("pan" in voice.panner) voice.panner.pan.setTargetAtTime(spatial.pan, context.currentTime, 0.05);
      voice.filter.frequency.setTargetAtTime(THREE.MathUtils.lerp(620, 2600, 1 - spatial.occlusion), context.currentTime, 0.08);
      voice.gain.gain.setTargetAtTime(spatial.gain * spatial.gain * (1 - spatial.occlusion * 0.52) * 0.13, context.currentTime, 0.08);
    });

    const musicEmitter = world?.audioEmitters?.find((emitter) => emitter.type === "music");
    let musicSpatial = { gain: 0, pan: 0, occlusion: 0 };
    if (musicEmitter) {
      resolveEmitterPosition(musicEmitter, sourcePosition);
      musicSpatial = getSpatialState(sourcePosition, camera.position, listenerDirection, world, musicEmitter.maxDistance ?? 70);
    }
    if (hotelJazzGain && hotelJazzAudio) {
      const target = Number(world?.level) === 5 ? musicSpatial.gain * musicSpatial.gain * (1 - musicSpatial.occlusion * 0.65) * 0.72 : 0;
      hotelJazzGain.gain.setTargetAtTime(target, context.currentTime, target > 0 ? 0.55 : 0.3);
      if (hotelJazzPanner && "pan" in hotelJazzPanner) hotelJazzPanner.pan.setTargetAtTime(musicSpatial.pan, context.currentTime, 0.08);
      if (Number(world?.level) === 5) hotelJazzAudio.play().catch(() => {});
    }
    return {
      zone: zone?.id ?? `level-${world?.level ?? 0}`,
      reverb,
      nearestEmitter: fixtureEmitters[0]?.emitter?.id ?? musicEmitter?.id ?? "",
      occlusion: fixtureEmitters[0]
        ? getSpatialState(fixtureEmitters[0].position, camera.position, listenerDirection, world, fixtureEmitters[0].emitter.maxDistance).occlusion
        : musicSpatial.occlusion,
    };
  }

  function suspend() {
    if (!context) return;
    suspendedByPause = true;
    if (context.state === "running") context.suspend?.();
  }

  function resume() {
    if (!context) return;
    suspendedByPause = false;
    tryUnlockContext();
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
    voice.occlusionFilter = context.createBiquadFilter();
    voice.occlusionFilter.type = "lowpass";
    voice.occlusionFilter.frequency.value = 5200;
    voice.panner = context.createStereoPanner?.() ?? context.createGain();
    voice.baseGain.connect(voice.occlusionFilter);
    voice.occlusionFilter.connect(voice.panner);
    voice.panner.connect(entityBus ?? master);
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
    voice.occlusionFilter?.disconnect?.();
    voice.panner?.disconnect?.();
    try {
      voice.baseGain.disconnect();
    } catch {
      // ignore
    }
  }

  function updateEntityAudio(entities, camera, listenerDirection, world) {
    if (!context || !master) return;
    if (suspendedByPause || context.state === "closed") return;

    let nearestBacteria = null;
    let nearestHound = null;
    let nearestSmiler = null;
    for (const entity of entities ?? []) {
      if (!entity || !entity.active) continue;
      if (!Number.isFinite(entity.distance)) continue;
      if (entity.id === "bacteria") {
        if (!nearestBacteria || entity.distance < nearestBacteria.distance) {
          nearestBacteria = entity;
        }
      } else if (entity.id?.includes("hound")) {
        if (!nearestHound || entity.distance < nearestHound.distance) {
          nearestHound = entity;
        }
      } else if (entity.id?.includes("smiler")) {
        if (!nearestSmiler || entity.distance < nearestSmiler.distance) nearestSmiler = entity;
      }
    }

    const now = context.currentTime;
    applySlotVolume("bacteria", nearestBacteria, now, camera, listenerDirection, world);
    applySlotVolume("hound", nearestHound, now, camera, listenerDirection, world);
    applySlotVolume("smiler", nearestSmiler, now, camera, listenerDirection, world);
  }

  function applySlotVolume(slot, nearest, now, camera, listenerDirection, world) {
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

    const source = new THREE.Vector3(nearest.x ?? camera?.position?.x ?? 0, nearest.y ?? 1, nearest.z ?? camera?.position?.z ?? 0);
    const spatial = camera
      ? getSpatialState(source, camera.position, listenerDirection, world, config.maxAudible)
      : { pan: 0, occlusion: 0 };
    if (voice.panner && "pan" in voice.panner) voice.panner.pan.setTargetAtTime(spatial.pan, now, 0.05);
    voice.occlusionFilter?.frequency?.setTargetAtTime(THREE.MathUtils.lerp(620, 5200, 1 - spatial.occlusion), now, 0.06);
    const attackBoost = nearest.attackPhase === "windup" || nearest.attackPhase === "hit" ? 1.18 : 1;
    const target = ratio * ratio * voice.baseLevel * (1 - spatial.occlusion * 0.48) * attackBoost;

    voice.baseGain.gain.setTargetAtTime(target, now, 0.08);
  }

  function stopAllEntityAudio() {
    for (const slot of Array.from(entityVoices.keys())) {
      tearDownEntityVoice(slot);
    }
  }

  function setVolumes(next = {}) {
    for (const key of Object.keys(volumes)) {
      if (!Number.isFinite(next[key])) continue;
      volumes[key] = Math.max(0, Math.min(1, next[key]));
      try {
        window.localStorage?.setItem(AUDIO_VOLUME_KEYS[key], String(volumes[key]));
      } catch {
        // ignore storage failures
      }
    }
    if (master && context) master.gain.setTargetAtTime(0.028 * volumes.master, context.currentTime, 0.05);
    if (ambientBus && context) ambientBus.gain.setTargetAtTime(volumes.ambient, context.currentTime, 0.05);
    if (musicBus && context) musicBus.gain.setTargetAtTime(volumes.music, context.currentTime, 0.05);
    return { ...volumes };
  }

  function getVolumes() {
    return { ...volumes };
  }

  return {
    start,
    update,
    updateLevelAudio,
    updateWorldAudio,
    suspend,
    resume,
    isSuspended,
    updateEntityAudio,
    stopAllEntityAudio,
    setVolumes,
    getVolumes,
  };
}

const ENTITY_AUDIO_CONFIG = {
  bacteria: {
    nearDistance: 1.8,
    maxAudible: 30,
  },
  hound: {
    nearDistance: 2.6,
    maxAudible: 36,
  },
  smiler: {
    nearDistance: 2.2,
    maxAudible: 28,
  },
};
