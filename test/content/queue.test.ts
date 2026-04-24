import { beforeEach, describe, expect, it } from 'vitest'
import { Queue } from '../../src/content/queue'

describe('Queue', () => {
  let q: Queue

  beforeEach(() => {
    q = new Queue()
    q.load(['chunk 1', 'chunk 2', 'chunk 3'])
  })

  it('returns the first chunk as current after load', () => {
    expect(q.current()).toBe('chunk 1')
  })

  it('returns null when index is past the end', () => {
    q.advance()
    q.advance()
    q.advance()
    expect(q.current()).toBeNull()
  })

  it('advance moves to next chunk', () => {
    q.advance()
    expect(q.current()).toBe('chunk 2')
  })

  it('retreat moves to previous chunk', () => {
    q.advance()
    q.retreat()
    expect(q.current()).toBe('chunk 1')
  })

  it('retreat does not go below 0', () => {
    q.retreat()
    expect(q.index).toBe(0)
  })

  it('reports correct total', () => {
    expect(q.total).toBe(3)
  })

  it('reports correct index', () => {
    q.advance()
    expect(q.index).toBe(1)
  })

  it('peek returns chunk at arbitrary index without moving current', () => {
    expect(q.peek(2)).toBe('chunk 3')
    expect(q.index).toBe(0)
  })

  it('peek returns null for out-of-range index', () => {
    expect(q.peek(99)).toBeNull()
  })

  it('stores and retrieves prefetch blob URLs', () => {
    q.setPrefetch(1, 'blob:mock-url')
    expect(q.getPrefetch(1)).toBe('blob:mock-url')
  })

  it('clears prefetch cache on load', () => {
    q.setPrefetch(1, 'blob:mock-url')
    q.load(['new'])
    expect(q.getPrefetch(1)).toBeUndefined()
  })

  it('clearPrefetch removes a single entry', () => {
    q.setPrefetch(1, 'blob:mock-url')
    q.clearPrefetch(1)
    expect(q.getPrefetch(1)).toBeUndefined()
  })

  it('load resets index to 0', () => {
    q.advance()
    q.load(['a', 'b'])
    expect(q.index).toBe(0)
  })
})
