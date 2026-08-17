import { bestMatchScore, cosineSimilarity } from './face-match.util';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('scales correctly for non-unit vectors pointing the same way', () => {
    expect(cosineSimilarity([2, 0], [10, 0])).toBeCloseTo(1);
  });

  it('returns 0 when the vector lengths differ', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 when either vector is empty', () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 when either vector is a zero vector', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });
});

describe('bestMatchScore', () => {
  it('returns 0 when there are no templates', () => {
    expect(bestMatchScore([1, 0], [])).toBe(0);
  });

  it('returns the maximum similarity across all templates', () => {
    const probe = [1, 0];
    const templates = [
      [0, 1],
      [1, 0],
      [-1, 0],
    ];
    expect(bestMatchScore(probe, templates)).toBeCloseTo(1);
  });

  it('picks the closest template even when all scores are low', () => {
    const probe = [1, 0];
    const templates = [
      [0, 1],
      [-1, 0],
    ];
    expect(bestMatchScore(probe, templates)).toBeCloseTo(0);
  });
});
