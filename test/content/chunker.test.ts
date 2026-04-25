import { describe, expect, it } from 'vitest'
import { chunk, chunkIntoGroups } from '../../src/content/chunker'

describe('chunk', () => {
  it('splits a single sentence-terminated paragraph', () => {
    expect(chunk(['Hello world. How are you? Fine!'])).toEqual([
      'Hello world.',
      'How are you?',
      'Fine!',
    ])
  })

  it('flattens multiple paragraphs into one list', () => {
    expect(chunk(['First sentence.', 'Second paragraph. Third sentence.'])).toEqual([
      'First sentence.',
      'Second paragraph.',
      'Third sentence.',
    ])
  })

  it('trims surrounding whitespace from each chunk', () => {
    expect(chunk(['  Hello world.  How are you?  '])).toEqual([
      'Hello world.',
      'How are you?',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(chunk([])).toEqual([])
  })

  it('returns a single chunk when there are no sentence boundaries', () => {
    expect(chunk(['Hello world'])).toEqual(['Hello world'])
  })

  it('drops empty strings', () => {
    expect(chunk(['', 'Hello.', ''])).toEqual(['Hello.'])
  })
})

describe('chunkIntoGroups', () => {
  it('returns one group per paragraph with flat indices starting at 0', () => {
    const result = chunkIntoGroups(['Hello world. How are you?'])
    expect(result).toEqual([
      {
        sentences: [
          { index: 0, text: 'Hello world.' },
          { index: 1, text: 'How are you?' },
        ],
      },
    ])
  })

  it('indices are contiguous across multiple paragraphs', () => {
    const result = chunkIntoGroups(['First.', 'Second. Third.'])
    expect(result).toEqual([
      { sentences: [{ index: 0, text: 'First.' }] },
      {
        sentences: [
          { index: 1, text: 'Second.' },
          { index: 2, text: 'Third.' },
        ],
      },
    ])
  })

  it('drops empty paragraphs', () => {
    const result = chunkIntoGroups(['', 'Hello.', ''])
    expect(result).toEqual([
      { sentences: [{ index: 0, text: 'Hello.' }] },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(chunkIntoGroups([])).toEqual([])
  })

  it('chunk() produces the same flat list as chunkIntoGroups() flattened', () => {
    const paragraphs = ['First sentence. Second sentence.', 'Third sentence.']
    const flat = chunkIntoGroups(paragraphs).flatMap(g => g.sentences.map(s => s.text))
    expect(flat).toEqual(chunk(paragraphs))
  })
})
