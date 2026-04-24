import { describe, expect, it } from 'vitest'
import { chunk } from '../../src/content/chunker'

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
