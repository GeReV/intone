import { assert, describe, expect, it } from "vitest";
import { chunk, chunkIntoGroups } from "../../src/extension/content/chunker";

// All sentences in this helper are 4 chars ("Foo."), so avg=4, threshold=12.
// Two sentences joined = "Foo. Foo." = 9 chars (≤12); three = 14 chars (>12).
const FOUR_CHAR = "Foo.";

describe("chunkIntoGroups — grouping behaviour", () => {
  it("merges short sentences within a paragraph into fewer chunks", () => {
    // 4 × 4-char sentences → avg=4, threshold=12 → pairs merge → 2 chunks
    const input = [`${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR}`];
    const result = chunkIntoGroups(input);

    expect(result).toHaveLength(1);
    const [group] = result;
    assert(group);
    expect(group.sentences).toHaveLength(2);
    const [s0, s1] = group.sentences;
    assert(s0);
    assert(s1);
    expect(s0.text).toBe("Foo. Foo.");
    expect(s1.text).toBe("Foo. Foo.");
  });

  it("assigns contiguous flat indices across merged chunks", () => {
    // 6 × 4-char sentences → 3 merged chunks, indices 0-2
    const input = [
      `${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR} ${FOUR_CHAR}`,
    ];
    const result = chunkIntoGroups(input);

    const [group] = result;
    assert(group);
    expect(group.sentences.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("never merges sentences across paragraph boundaries", () => {
    // Two single-sentence paragraphs — each must stay in its own group/chunk
    const result = chunkIntoGroups([FOUR_CHAR, FOUR_CHAR]);

    expect(result).toHaveLength(2);
    const [g0, g1] = result;
    assert(g0);
    assert(g1);
    const [s0] = g0.sentences;
    const [s1] = g1.sentences;
    assert(s0);
    assert(s1);
    expect(s0.text).toBe(FOUR_CHAR);
    expect(s1.text).toBe(FOUR_CHAR);
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
    const [group] = result;
    assert(group);
    expect(group.sentences).toHaveLength(1);
    const [s0] = group.sentences;
    assert(s0);
    expect(s0.text).toBe(longSentence);
  });

  it("drops empty paragraphs", () => {
    const result = chunkIntoGroups(["", FOUR_CHAR, ""]);

    expect(result).toHaveLength(1);
    const [group] = result;
    assert(group);
    const [s0] = group.sentences;
    assert(s0);
    expect(s0.text).toBe(FOUR_CHAR);
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
