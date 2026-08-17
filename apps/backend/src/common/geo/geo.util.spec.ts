import {
  distanceInMeters,
  GeoJsonMultiPolygon,
  GeoJsonPolygon,
  pointInGeometry,
  withinBBox,
} from './geo.util';

describe('geo.util', () => {
  describe('distanceInMeters', () => {
    it('is ~0 for the same point', () => {
      expect(distanceInMeters(41.3111, 69.3402, 41.3111, 69.3402)).toBeCloseTo(0, 3);
    });

    it('is ~111km for one degree of latitude', () => {
      const d = distanceInMeters(41, 69, 42, 69);
      expect(d).toBeGreaterThan(110_000);
      expect(d).toBeLessThan(112_000);
    });

    it('computes a short intra-city distance', () => {
      const d = distanceInMeters(41.3111, 69.3402, 41.3125, 69.341);
      expect(d).toBeGreaterThan(100);
      expect(d).toBeLessThan(300);
    });
  });

  describe('pointInGeometry (coords are [lng, lat])', () => {
    const square: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0],
        ],
      ],
    };

    it('detects a point inside', () => {
      expect(pointInGeometry(5, 5, square)).toBe(true);
    });

    it('detects a point outside', () => {
      expect(pointInGeometry(15, 5, square)).toBe(false);
    });

    const withHole: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0],
        ],
        [
          [3, 3],
          [3, 7],
          [7, 7],
          [7, 3],
          [3, 3],
        ],
      ],
    };

    it('treats a point inside a hole as outside', () => {
      expect(pointInGeometry(5, 5, withHole)).toBe(false);
    });

    it('treats a point between outer ring and hole as inside', () => {
      expect(pointInGeometry(1, 1, withHole)).toBe(true);
    });

    const multi: GeoJsonMultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0],
          ],
        ],
        [
          [
            [10, 10],
            [10, 12],
            [12, 12],
            [12, 10],
            [10, 10],
          ],
        ],
      ],
    };

    it('matches either polygon of a MultiPolygon', () => {
      expect(pointInGeometry(1, 1, multi)).toBe(true);
      expect(pointInGeometry(11, 11, multi)).toBe(true);
      expect(pointInGeometry(5, 5, multi)).toBe(false);
    });
  });

  describe('withinBBox', () => {
    it('accepts a point inside the box', () => {
      expect(withinBBox(5, 5, 0, 0, 10, 10)).toBe(true);
    });

    it('rejects a point outside the box', () => {
      expect(withinBBox(11, 5, 0, 0, 10, 10)).toBe(false);
      expect(withinBBox(5, -1, 0, 0, 10, 10)).toBe(false);
    });
  });
});
