import {
  EARTH_RADIUS_KM,
  MAX_DISTANCE_KM,
  bboxCenter,
  bboxLonSpan,
  distanceKm,
  formatDistance,
  formatLatLon,
  geodesicCircle,
  inBBox,
  nearestTarget,
  normalizeLon,
  scopeSizeKm,
  unitForLocale,
  type GeoPoint,
} from "./geo";

// Expected distances come from this independent haversine (not from d3-geo) or from exact
// spherical facts: a quarter meridian, the antipode, one degree along the equator.
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const ONE_DEGREE_KM = (2 * Math.PI * EARTH_RADIUS_KM) / 360; // 111.19 km

const CITIES = {
  london: { lat: 51.5074, lon: -0.1278 },
  paris: { lat: 48.8566, lon: 2.3522 },
  suva: { lat: -18.1416, lon: 178.4419 },
  apia: { lat: -13.8333, lon: -171.7667 },
  anchorage: { lat: 61.2181, lon: -149.9003 },
  petropavlovsk: { lat: 53.0452, lon: 158.6483 },
  sydney: { lat: -33.8688, lon: 151.2093 },
  santiago: { lat: -33.4489, lon: -70.6693 },
} satisfies Record<string, GeoPoint>;

describe("distanceKm", () => {
  it("measures exact spherical distances", () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 90, lon: 0 })).toBeCloseTo(MAX_DISTANCE_KM / 2, 6);
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(MAX_DISTANCE_KM, 6);
    expect(MAX_DISTANCE_KM).toBeCloseTo(20015.09, 2);
    expect(distanceKm({ lat: 10, lon: 20 }, { lat: 11, lon: 20 })).toBeCloseTo(ONE_DEGREE_KM, 6);
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0);
  });

  it("matches the haversine formula on city pairs", () => {
    const pairs: [GeoPoint, GeoPoint][] = [
      [CITIES.london, CITIES.paris],
      [CITIES.suva, CITIES.apia],
      [CITIES.anchorage, CITIES.petropavlovsk],
      [CITIES.sydney, CITIES.santiago],
    ];
    for (const [a, b] of pairs) {
      expect(distanceKm(a, b)).toBeCloseTo(haversineKm(a, b), 6);
      expect(distanceKm(b, a)).toBeCloseTo(distanceKm(a, b), 9);
    }
    // London to Paris is the familiar ~344 km.
    expect(distanceKm(CITIES.london, CITIES.paris)).toBeGreaterThan(340);
    expect(distanceKm(CITIES.london, CITIES.paris)).toBeLessThan(347);
  });

  it("takes the short way across the antimeridian", () => {
    expect(distanceKm({ lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 })).toBeCloseTo(
      ONE_DEGREE_KM,
      6,
    );
    // Suva and Apia sit on either side of 180°: about 1,150 km apart, not half the world.
    const suvaApia = distanceKm(CITIES.suva, CITIES.apia);
    expect(suvaApia).toBeLessThan(1300);
    // The same place written past 180° gives the same distance.
    expect(distanceKm(CITIES.suva, { ...CITIES.apia, lon: CITIES.apia.lon + 360 })).toBeCloseTo(
      suvaApia,
      6,
    );
  });
});

describe("normalizeLon", () => {
  it("wraps into [-180, 180)", () => {
    expect(normalizeLon(0)).toBe(0);
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(180)).toBe(-180);
    expect(normalizeLon(540)).toBe(-180);
    expect(normalizeLon(-720 + 45)).toBe(45);
  });
});

describe("nearestTarget", () => {
  const targets = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 90 },
    { lat: 0, lon: -179 },
  ];

  it("picks the nearest target and its distance", () => {
    expect(nearestTarget({ lat: 0, lon: 80 }, targets)).toEqual({
      index: 1,
      km: expect.closeTo(10 * ONE_DEGREE_KM, 6),
    });
    // Across the antimeridian: 179.5° E is 1.5° from 179° W.
    expect(nearestTarget({ lat: 0, lon: 179.5 }, targets).index).toBe(2);
  });

  it("gives ties to the earlier target and needs at least one", () => {
    expect(nearestTarget({ lat: 0, lon: 45 }, targets).index).toBe(0);
    expect(() => nearestTarget({ lat: 0, lon: 0 }, [])).toThrow();
  });
});

describe("geodesicCircle", () => {
  const cases: [string, GeoPoint, number][] = [
    ["on the equator", { lat: 0, lon: 0 }, 1000],
    ["over the pole", { lat: 89, lon: 0 }, 500],
    ["across the antimeridian", { lat: 10, lon: 179.9 }, 800],
    ["larger than a hemisphere", { lat: 30, lon: -60 }, 15000],
  ];
  it.each(cases)("keeps every vertex at the radius (%s)", (_name, center, radiusKm) => {
    const ring = geodesicCircle(center, radiusKm, 1).coordinates[0]!;
    expect(ring.length).toBeGreaterThan(100);
    for (const [lon, lat] of ring) {
      expect(Math.abs(distanceKm(center, { lat: lat!, lon: lon! }) - radiusKm)).toBeLessThan(
        radiusKm * 1e-3,
      );
    }
  });
});

describe("bounding boxes", () => {
  it("handles boxes across the antimeridian", () => {
    const box = [170, -20, -170, 0] as const;
    expect(bboxLonSpan(box)).toBe(20);
    expect(inBBox({ lat: -10, lon: 175 }, box)).toBe(true);
    expect(inBBox({ lat: -10, lon: -175 }, box)).toBe(true);
    expect(inBBox({ lat: -10, lon: 0 }, box)).toBe(false);
    expect(inBBox({ lat: 5, lon: 175 }, box)).toBe(false);
    expect(bboxCenter(box)).toEqual({ lat: -10, lon: -180 });
  });

  it("treats -180…180 as every longitude", () => {
    const all = [-180, -90, 180, 90] as const;
    expect(bboxLonSpan(all)).toBe(360);
    expect(inBBox({ lat: 12, lon: 123 }, all)).toBe(true);
  });

  it("sizes a scope by its widest distance", () => {
    expect(scopeSizeKm()).toBe(MAX_DISTANCE_KM);
    const box = [0, 0, 10, 10] as const;
    expect(scopeSizeKm(box)).toBeCloseTo(distanceKm({ lat: 0, lon: 0 }, { lat: 10, lon: 10 }), 0);
    // The same box shifted across the antimeridian has the same size.
    expect(scopeSizeKm([175, -5, -175, 5])).toBeCloseTo(scopeSizeKm([-5, -5, 5, 5]), 6);
    // A small scope is a small fraction of the world.
    expect(scopeSizeKm([0, 0, 1, 1]) / MAX_DISTANCE_KM).toBeLessThan(0.01);
  });
});

describe("units", () => {
  it("picks miles where road signs use them", () => {
    expect(unitForLocale("en-US")).toBe("mi");
    expect(unitForLocale("en-GB")).toBe("mi");
    expect(unitForLocale("en")).toBe("mi");
    expect(unitForLocale("de-CH")).toBe("km");
    expect(unitForLocale("fr")).toBe("km");
    expect(unitForLocale("en-AU")).toBe("km");
    expect(unitForLocale(undefined)).toBe("km");
    expect(unitForLocale("not a locale!")).toBe("km");
  });

  it("formats distances with Intl units", () => {
    expect(formatDistance(1234.4, "km", "en-GB")).toBe("1,234 km");
    expect(formatDistance(1609.344, "mi", "en-GB")).toBe("1,000 mi");
    expect(formatDistance(4.24, "km", "en-GB")).toBe("4.2 km");
  });

  it("formats coordinates with hemisphere letters", () => {
    const letters = { n: "N", s: "S", e: "E", w: "W" };
    expect(formatLatLon({ lat: 46.5, lon: -7.25 }, letters, "en-GB")).toBe("46.50° N, 7.25° W");
    expect(formatLatLon({ lat: -0.004, lon: 190 }, letters, "en-GB")).toBe("0.00° S, 170.00° W");
  });
});
