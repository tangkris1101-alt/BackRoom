export function createAmbientHum() {
  let context = null;
  let master = null;
  let flickerGain = null;
  let started = false;
  let stepFilter = null;
  let lastStepAt = 0;
  let stepNoiseBuffer = null;

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
    stepFilter.frequency.value = 620;
    stepFilter.Q.value = 0.58;
    stepFilter.connect(master);
  }

  function playFootstep({ sprinting }) {
    if (!context || !stepFilter || !stepNoiseBuffer) return;
    const now = context.currentTime;

    const noise = context.createBufferSource();
    noise.buffer = stepNoiseBuffer;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(sprinting ? 0.42 : 0.28, now + 0.012);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (sprinting ? 0.12 : 0.105));
    noise.connect(noiseGain);
    noiseGain.connect(stepFilter);
    noise.start(now);
    noise.stop(now + 0.14);

    const thump = context.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(sprinting ? 76 : 62, now);
    thump.frequency.exponentialRampToValueAtTime(sprinting ? 46 : 38, now + 0.09);
    const thumpGain = context.createGain();
    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(sprinting ? 0.16 : 0.1, now + 0.008);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(now);
    thump.stop(now + 0.11);
  }

  function update(flicker, movementState = {}) {
    if (!context || !flickerGain) return;
    if (context.state === "suspended") context.resume?.();
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
      ? Math.max(0.24, 0.34 - speed * 0.018)
      : Math.max(0.38, 0.54 - speed * 0.026);
    if (now - lastStepAt >= stepInterval) {
      playFootstep({ sprinting });
      lastStepAt = now;
    }
  }

  return { start, update };
}
