import { describe, expect, it } from 'vitest';
import { scopeOfSegment, scopesOf } from './resultScopes';

describe('result scopes', () => {
  it('knows which kind of part a segment is', () => {
    expect(['cd:abc', 'fd', 'cf:8:L', 'cf:12:-', 'sp', 'lp'].map(scopeOfSegment)).toEqual([
      'compulsory',
      'free',
      'figures',
      'figures',
      'short',
      'long',
    ]);
  });

  it('offers final plus each kind of part for a dance event with compulsory dances and a free dance', () => {
    expect(scopesOf([{ id: 'cd:a' }, { id: 'cd:b' }, { id: 'fd' }])).toEqual(['final', 'compulsory', 'free']);
  });

  it('offers final plus figures, short and free for a figures event, in that order', () => {
    expect(scopesOf([{ id: 'cf:1:-' }, { id: 'cf:2:L' }, { id: 'sp' }, { id: 'lp' }])).toEqual([
      'final',
      'figures',
      'short',
      'long',
    ]);
    expect(scopesOf([{ id: 'sp' }, { id: 'lp' }])).toEqual(['final', 'short', 'long']);
  });

  it('has only the final results when there is one kind of part', () => {
    expect(scopesOf([{ id: 'cd:a' }, { id: 'cd:b' }])).toEqual(['final']);
    expect(scopesOf([{ id: 'fd' }])).toEqual(['final']);
    expect(scopesOf([{ id: 'lp' }])).toEqual(['final']);
    expect(scopesOf([])).toEqual(['final']);
  });
});
