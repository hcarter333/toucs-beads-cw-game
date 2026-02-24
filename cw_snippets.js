

let UNIT_MS = 80; // 80ms ~ 15 WPM dot


const MORSE_TABLE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----."
};


// simple sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));




async function sendMorseMessage(freqStr, text) {
  const upper = text.toUpperCase();
  const unit = UNIT_MS;

  for (let ci = 0; ci < upper.length; ci++) {
    const ch = upper[ci];

    if (ch === " ") {
      // Word gap: 7 units of silence
      await sleep(unit * 7);
      continue;
    }

    const pattern = MORSE_TABLE[ch];
    if (!pattern) {
      // Unknown character, skip
      continue;
    }

    for (let si = 0; si < pattern.length; si++) {
      const sym = pattern[si];
      const durUnits = sym === "." ? 1 : 3;

      const msgDown = `${freqStr} Key down`;
      const msgUp = `${freqStr} key up`;

      keyPress();
      await sleep(durUnits * unit);
      keyRelease();

      // Intra-character gap (between elements) = 1 unit, except after last element
      if (si < pattern.length - 1) {
        await sleep(unit);
      }
    }

    // Inter-character gap (between letters) = 3 units,
    // but if the next char is a space, the 7-unit word gap
    // will be applied when we hit the space, so we do nothing here.
    const nextChar = upper[ci + 1];
    if (nextChar && nextChar !== " ") {
      await sleep(unit * 3);
    }
  }
}
