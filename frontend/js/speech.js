const phrases = {
  en: {
    time: (t) => `The time is ${t}`,
    just5: 'Just 5 minutes. You can do anything for 5 minutes.',
    done: 'Great work. Timer complete.',
  },
};

const speech = {
  language: 'en',
  rate: 1,
  say(text) {
    if (!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = this.language;
    utter.rate = this.rate;
    window.speechSynthesis.speak(utter);
  },
};
