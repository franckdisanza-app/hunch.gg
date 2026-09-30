// pnpm ping:furthest --region <country | file.geojson> --what <OSM tag filter>
//                    [--buffer-km 150] [--grid-km N] [--endpoint URL]
//
// Computes the point inside a region that is furthest from every OpenStreetMap feature matching a
// tag filter, e.g. the furthest point in a country from any road (--what highway) or from a chain
// (--what '"brand:wikidata"="Q…"'). Features outside the region count: the query covers the
// region's box plus --buffer-km, and is widened if the answer lies further than that from them.
//
// Prints the target, its distance, the three nearest features, the OpenStreetMap data date and
// today's date, as a snippet for content/ping/questions.json. Data © OpenStreetMap contributors,
// ODbL. Set PING_OSM_CONTACT (an email or URL) so the Overpass operators can reach you.
// See docs/games/ping/content-guide.md.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { formatDistance } from "@/engines/map/geo";
import { expandBBox, furthestPoint } from "./lib/furthest";
import { OSM_CREDIT, OSM_LICENCE, featuresFrom, fetchOverpass, overpassQuery } from "./lib/osm";
import { loadRegion } from "./lib/region";

const { values } = parseArgs({
  options: {
    region: { type: "string" },
    what: { type: "string" },
    "buffer-km": { type: "string", default: "150" },
    "grid-km": { type: "string" },
    endpoint: { type: "string" },
  },
});

if (!values.region || !values.what) {
  console.error(
    "Usage: pnpm ping:furthest --region <country | file.geojson> --what <OSM tag filter>",
  );
  process.exit(1);
}

const root = process.cwd();
const contact = process.env.PING_OSM_CONTACT;
if (!contact)
  console.warn("warning  set PING_OSM_CONTACT to an email or URL (Overpass usage policy)");
const userAgent = `plimp-ping-furthest/1 (${contact ?? "no contact given"})`;
const today = new Date().toISOString().slice(0, 10);

const region = loadRegion(root, values.region);
let buffer = Number(values["buffer-km"]);
const gridKm = values["grid-km"] ? Number(values["grid-km"]) : undefined;

for (let round = 1; round <= 3; round++) {
  const box = expandBBox(region.bbox, buffer);
  const query = overpassQuery(values.what, box);
  const response = await fetchOverpass(query, {
    cacheDir: join(root, ".cache", "ping"),
    userAgent,
    ...(values.endpoint ? { endpoint: values.endpoint } : {}),
    log: (message) => console.log(message),
  });
  const { features, dataAsOf } = featuresFrom(response);
  console.log(
    `${features.length} points from ${response.elements.length} features, data as of ${dataAsOf}`,
  );
  const result = furthestPoint(region, features, gridKm ? { gridKm } : {});

  // A feature further out than the buffer could still be nearer than the answer: widen and rerun.
  if (result.distanceKm > buffer && round < 3) {
    buffer = Math.ceil(result.distanceKm * 1.2);
    console.log(
      `The answer is ${Math.round(result.distanceKm)} km from everything: widening the search to ${buffer} km.`,
    );
    continue;
  }

  const { lat, lon } = result.point;
  const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
  const nearest = result.nearest.map(({ index, km }) => ({ feature: features[index]!, km }));
  console.log(`\n${region.name}: furthest from [${values.what}]`);
  console.log(
    `  ${round5(lat)}, ${round5(lon)}  ${formatDistance(result.distanceKm, "km")} from the nearest`,
  );
  console.log(
    `  https://www.openstreetmap.org/?mlat=${round5(lat)}&mlon=${round5(lon)}#map=10/${round5(lat)}/${round5(lon)}`,
  );
  for (const { feature, km } of nearest) {
    console.log(
      `  ${formatDistance(km, "km").padStart(9)}  ${feature.name ?? "(no name)"}${feature.town ? `, ${feature.town}` : ""}  https://www.openstreetmap.org/${feature.ref}`,
    );
  }
  console.log(
    `  grid ${result.gridKm.toFixed(2)} km, ${result.evaluated} points measured, buffer ${buffer} km`,
  );
  console.log(
    `\nFor content/ping/questions.json (name the place and write the question yourself):\n`,
  );
  console.log(
    JSON.stringify(
      {
        targets: [
          {
            lat: round5(lat),
            lon: round5(lon),
            label: "TODO: describe the place",
            official: true,
            value: Math.round(result.distanceKm * 10) / 10,
            unit: "km",
            date: dataAsOf,
          },
        ],
        computedOn: today,
        dataAsOf,
        nearest: nearest.map(({ feature }) => ({
          name: feature.name ?? "TODO: name",
          ...(feature.town ? { town: feature.town } : {}),
          lat: round5(feature.lat),
          lon: round5(feature.lon),
        })),
        sourceTitle: "OpenStreetMap, computed by Plimp",
        sourceUrl: `https://www.openstreetmap.org/#map=10/${round5(lat)}/${round5(lon)}`,
        checkedOn: today,
        licence: OSM_LICENCE,
      },
      null,
      2,
    ),
  );
  console.log(`\n${OSM_CREDIT}`);
  break;
}
