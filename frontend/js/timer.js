const timerEngine = {
  remaining: 0,
  total: 0,
  interval: null,
  running: false,
  warningFired: { five: false, two: false, thirty: false },
  onTick: () => {},
  onDone: () => {},
  start(seconds) {
    this.total = seconds;
    this.remaining = seconds;
    this.running = true;
    this.warningFired = { five: false, two: false, thirty: false };
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (!this.running) return;
      this.remaining -= 1;
      this.onTick(this.remaining, this.total);
      this.checkWarnings();
      if (this.remaining <= 0) {
        clearInterval(this.interval);
        this.running = false;
        this.onDone();
      }
    }, 1000);
  },
  pause() { this.running = false; },
  resume() { this.running = true; },
  stop() { clearInterval(this.interval); this.running = false; this.remaining = 0; },
  checkWarnings() {
    if (this.total > 360 && this.remaining <= 300 && !this.warningFired.five) { speech.say('5 minutes to wrap up'); this.warningFired.five = true; }
    if (this.total > 180 && this.remaining <= 120 && !this.warningFired.two) { speech.say('2 minutes left'); this.warningFired.two = true; }
    if (this.total > 45 && this.remaining <= 30 && !this.warningFired.thirty) { speech.say('30 seconds'); this.warningFired.thirty = true; }
  },
};
