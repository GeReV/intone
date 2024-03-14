import assert from "~/utils/assert";

const ABBREVS = {
  "capt": "captain",
  "co": "company",
  "col": "colonel",
  "cpl": "corporal",
  "dr": "doctor",
  "esq": "esquire",
  "gen": "general",
  "hon": "honorable",
  "jr": "junior",
  "lt": "lieutenant",
  "ltd": "limited",
  "maj": "major",
  "mr": "mister",
  "mrs": "missus",
  "ms": "miss",
  "pvt": "private",
  "prof": "professor",
  "rev": "reverend",
  "sgt": "sergeant",
  "sr": "senior",
  "st": "saint",
};

// https://github.com/coqui-ai/TTS/blob/eef419b37393b11cc741662d041d8d793e011f2d/TTS/tts/utils/text/english/abbreviations.py
const ABBREV_REGEXES = Object.fromEntries(
  Object.keys(ABBREVS).map(k => [k, new RegExp(`\\b${k}\\.`, "gi")])
);

export function expandAbbreviations(text: string): string {
  for (const [abbrev, expansion] of Object.entries(ABBREVS)) {
    const regex = ABBREV_REGEXES[abbrev];
    assert(regex);

    text = text.replace(regex, expansion);
  }

  return text;
}
