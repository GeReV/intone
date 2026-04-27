import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioCache } from '../../src/extension/content/audio-cache'

if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}

describe('AudioCache', () => {
  let cache: AudioCache
  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')

  beforeEach(() => {
    cache = new AudioCache(3)
    revokeSpy.mockClear()
  })

  it('returns undefined for a missing entry', () => {
    expect(cache.get(0)).toBeUndefined()
  })

  it('has() returns false for a missing entry', () => {
    expect(cache.has(0)).toBe(false)
  })

  it('stores and retrieves a blob URL', () => {
    cache.set(0, 'blob:a')
    expect(cache.get(0)).toBe('blob:a')
  })

  it('has() returns true after set', () => {
    cache.set(0, 'blob:a')
    expect(cache.has(0)).toBe(true)
  })

  it('evicts the LRU entry when at capacity', () => {
    cache.set(0, 'blob:a')
    cache.set(1, 'blob:b')
    cache.set(2, 'blob:c')
    cache.set(3, 'blob:d')
    expect(cache.get(0)).toBeUndefined()
    expect(cache.get(1)).toBe('blob:b')
    expect(revokeSpy).toHaveBeenCalledWith('blob:a')
  })

  it('get() refreshes recency — accessed entry survives next eviction', () => {
    cache.set(0, 'blob:a')
    cache.set(1, 'blob:b')
    cache.set(2, 'blob:c')
    cache.get(0)            // touch 0, making 1 the LRU
    cache.set(3, 'blob:d')  // should evict 1
    expect(cache.get(0)).toBe('blob:a')
    expect(cache.get(1)).toBeUndefined()
    expect(revokeSpy).toHaveBeenCalledWith('blob:b')
  })

  it('set() on an existing key updates value and recency without evicting', () => {
    cache.set(0, 'blob:a')
    cache.set(1, 'blob:b')
    cache.set(0, 'blob:a2')
    expect(cache.get(0)).toBe('blob:a2')
    expect(cache.has(1)).toBe(true)
    expect(revokeSpy).not.toHaveBeenCalled()
  })

  it('set() on existing key makes it the MRU so it survives eviction', () => {
    cache.set(0, 'blob:a')
    cache.set(1, 'blob:b')
    cache.set(0, 'blob:a2')  // refresh 0, now 1 is LRU
    cache.set(2, 'blob:c')
    cache.set(3, 'blob:d')   // should evict 1
    expect(cache.has(0)).toBe(true)
    expect(cache.get(1)).toBeUndefined()
    expect(revokeSpy).toHaveBeenCalledWith('blob:b')
  })

  it('clear() revokes all blob URLs and empties the cache', () => {
    cache.set(0, 'blob:a')
    cache.set(1, 'blob:b')
    cache.clear()
    expect(cache.get(0)).toBeUndefined()
    expect(cache.get(1)).toBeUndefined()
    expect(revokeSpy).toHaveBeenCalledWith('blob:a')
    expect(revokeSpy).toHaveBeenCalledWith('blob:b')
    expect(revokeSpy).toHaveBeenCalledTimes(2)
  })

  it('clear() on an empty cache does not throw', () => {
    expect(() => { cache.clear() }).not.toThrow()
  })
})
