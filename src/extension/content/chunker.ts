import type { ParagraphGroup, SentenceChunk } from "./types";

const SENTENCE_BOUNDARY = /(?<=[.?!])\s+/u;

export function chunkIntoGroups(paragraphs: string[]): ParagraphGroup[] {
  // Pass 1: split each paragraph into individual sentences
  const paragraphSentences: string[][] = [];

  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(SENTENCE_BOUNDARY)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length > 0) {
      paragraphSentences.push(sentences);
    }
  }

  // Compute global average sentence length across all paragraphs
  let totalLen = 0;
  let totalCount = 0;

  for (const sentences of paragraphSentences) {
    for (const s of sentences) {
      totalLen += s.length;
      totalCount++;
    }
  }

  const avgLen = totalCount > 0 ? totalLen / totalCount : 0;
  const threshold = avgLen * 3;

  // Pass 2: greedily group sentences within each paragraph
  const groups: ParagraphGroup[] = [];
  let flatIndex = 0;

  for (const sentences of paragraphSentences) {
    const chunks: SentenceChunk[] = [];
    let groupParts: string[] = [];
    let groupLen = 0;

    for (const sentence of sentences) {
      const addedLen =
        groupParts.length === 0 ? sentence.length : groupLen + 1 + sentence.length;

      if (groupParts.length > 0 && addedLen > threshold) {
        chunks.push({ index: flatIndex++, text: groupParts.join(" ") });
        groupParts = [sentence];
        groupLen = sentence.length;
      } else {
        groupParts.push(sentence);
        groupLen = addedLen;
      }
    }

    if (groupParts.length > 0) {
      chunks.push({ index: flatIndex++, text: groupParts.join(" ") });
    }

    groups.push({ sentences: chunks });
  }

  return groups;
}

export function chunk(paragraphs: string[]): string[] {
  return chunkIntoGroups(paragraphs).flatMap((g) => g.sentences.map((s) => s.text));
}
