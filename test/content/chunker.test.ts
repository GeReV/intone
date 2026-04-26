import { describe, expect, it } from "vitest";
import { chunk, chunkIntoGroups } from "../../src/content/chunker";

// All sentences in this helper are 4 chars ("Foo."), so avg=4, threshold=12.
// Two sentences joined = "Foo. Foo." = 9 chars (≤12); three = 14 chars (>12).
const FOUR_CHAR = "Foo.";

describe("chunkIntoGroups — grouping behaviour", () => {
  it("merges short sentences within a paragraph into fewer chunks", () => {
    // 4 × 4-char sentences → avg=4, threshold=12 → pairs merge → 2 chunks
    const input = [`${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR}`];
    const result = chunkIntoGroups(input);

    expect(result).toHaveLength(1);
    expect(result[0].sentences).toHaveLength(2);
    expect(result[0].sentences[0].text).toBe("Foo. Foo.");
    expect(result[0].sentences[1].text).toBe("Foo. Foo.");
  });

  it("assigns contiguous flat indices across merged chunks", () => {
    // 6 × 4-char sentences → 3 merged chunks, indices 0-2
    const input = [
      `${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR}`,
    ];
    const result = chunkIntoGroups(input);

    expect(result[0].sentences.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("never merges sentences across paragraph boundaries", () => {
    // Two single-sentence paragraphs — each must stay in its own group/chunk
    const result = chunkIntoGroups([FOUR_CHAR, FOUR_CHAR]);

    expect(result).toHaveLength(2);
    expect(result[0].sentences[0].text).toBe(FOUR_CHAR);
    expect(result[1].sentences[0].text).toBe(FOUR_CHAR);
  });

  it("flat indices are contiguous across multiple paragraphs", () => {
    // 2 paragraphs × 2 sentences each → 4 chunks total (pairs merge → 1 chunk/para)
    const twoSentencePara = `${FOUR_CHAR} ${FOUR_CHAR}`;
    const result = chunkIntoGroups([twoSentencePara, twoSentencePara]);

    const indices = result.flatMap((g) => g.sentences.map((s) => s.index));
    expect(indices).toEqual([0, 1]);
  });

  it("a single long sentence becomes its own chunk", () => {
    // One very long sentence that is already above threshold on its own
    const longSentence = "a".repeat(200) + ".";
    const result = chunkIntoGroups([longSentence]);

    expect(result).toHaveLength(1);
    expect(result[0].sentences).toHaveLength(1);
    expect(result[0].sentences[0].text).toBe(longSentence);
  });

  it("drops empty paragraphs", () => {
    const result = chunkIntoGroups(["", FOUR_CHAR, ""]);

    expect(result).toHaveLength(1);
    expect(result[0].sentences[0].text).toBe(FOUR_CHAR);
  });

  it("returns empty array for empty input", () => {
    expect(chunkIntoGroups([])).toEqual([]);
  });
});

describe("chunk", () => {
  it("returns flat list of merged texts", () => {
    // 4 × 4-char sentences → 2 merged chunks
    const input = [`${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR}`];
    expect(chunk(input)).toEqual(["Foo. Foo.", "Foo. Foo."]);
  });

  it("returns empty array for empty input", () => {
    expect(chunk([])).toEqual([]);
  });

  it("drops empty paragraphs", () => {
    expect(chunk(["", FOUR_CHAR, ""])).toEqual([FOUR_CHAR]);
  });

  it("matches chunkIntoGroups flat output", () => {
    const paragraphs = [`${FOUR_CHAR} ${FOUR_CHAR}`, `${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR}`];
    const flat = chunkIntoGroups(paragraphs).flatMap((g) => g.sentences.map((s) => s.text));
    expect(chunk(paragraphs)).toEqual(flat);
  });
});
