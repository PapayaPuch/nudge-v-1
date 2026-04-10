const sounds = {
  ctx: null,
  node: null,
  play(type = 'white') {
    if (!window.AudioContext) return;
    this.ctx = this.ctx || new AudioContext();
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const base = type === 'brown' ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * 0.5;
      out[i] = base;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
    this.node = src;
  },
  stop() { if (this.node) this.node.stop(); this.node = null; },
};
