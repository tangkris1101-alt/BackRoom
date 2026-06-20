export function createAmbientHum() {
  let context = null;
  let master = null;
  let flickerGain = null;
  let started = false;

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
  }

  function update(flicker) {
    if (!context || !flickerGain) return;
    const now = context.currentTime;
    const level = 0.055 + (1 - flicker) * 0.08;
    flickerGain.gain.setTargetAtTime(level, now, 0.035);
  }

  return { start, update };
}
