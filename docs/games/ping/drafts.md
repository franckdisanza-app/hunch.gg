# Ping drafts: what to verify

The ten questions in `content/ping/questions.json` are real records, researched at their sources
on 2 October 2026, and still drafts (`sample: true`). Before removing `sample: true` from one,
go through the general checklist in [content-guide.md](content-guide.md#6-verify-a-draft), plus
the points below. Delete this file once every question is verified.

Sources used:

- **WMO records table**: [Records of Weather and Climate Extremes Table](https://wmo.int/files/records-of-weather-and-climate-extremes-table)
  (PDF as of 31 July 2025). The archive's old per-record pages (wmo.asu.edu) now redirect to the
  WMO site, so the table is the citable page.
- **WMO station registry**: [Vostok Station, WIGOS 0-20000-0-89606](https://wis2node.globaldata.nws.noaa.gov/collections/mlid_station/items/0-20000-0-89606?f=html).
- **Parish & Wendler (1991)**: [The katabatic wind regime at Adelie Land, Antarctica](https://doi.org/10.1002/joc.3370110108),
  International Journal of Climatology 11: 97–107 (abstract).
- **The Kathmandu Post (8 Dec 2020)**: [8848.86 metres. That's the height of Mt Everest now](https://kathmandupost.com/national/2020/12/08/it-s-official-mount-everest-is-8-848-86-metres-tall).
- **Israel Water Authority**: [Dead Sea level since 1976](https://data.gov.il/he/datasets/water_authority/https-www-data-gov-il-dataset-683)
  on data.gov.il (monthly, by its Hydrological Service).
- **Pedgley (1967)**: Air temperature at Dallol, Ethiopia, Meteorological Magazine 96: 265–271,
  in the [September 1967 issue](https://digital.nmla.metoffice.gov.uk/IO_43e9b8d3-2438-48e3-b503-0596ab9a4942/)
  of the Met Office digital archive.

| Question                   | Check in particular                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `heat-highest-temperature` | 56.7 °C, 10 July 1913, Furnace Creek (Greenland Ranch), 36°27′N 116°51′W, −54 m (WMO table). The El Azizia (58 °C, 1922) story in "Turns out" is not in the table: check it against WMO's 2012 assessment (El Fadli et al., Bulletin of the AMS, 2013).                                                                                                |
| `cold-lowest-temperature`  | −89.2 °C, 21 July 1983 (WMO table). The table gives 77°32′S 106°40′E, 104 km from the station; the target uses the station registry's −78.4642, 106.8658 (your list's 78.46 °S, 106.84 °E is 0.7 km away). The −98 °C satellite figure in "Turns out" is not in the table and was not checked: verify it (Scambos et al., 2018) or drop that sentence. |
| `rain-wettest-average`     | WMO keeps this record per region only: Asia's is Mawsynram, 11.872 m, 38-year average, 25°18′N 91°35′E. The prompt says "in the WMO's records" for that reason. Cherrapunji's 26.47 m (Aug 1860–Jul 1861) is the table's 12-month record. Colombian claims (Lloró) are left out: their figures disagree and none is WMO-evaluated.                     |
| `rain-longest-dry-spell`   | 172 months, October 1903 – January 1918 (world table). The world table prints Arica at 18°48′S 70°30′W, in the sea 41 km away; the target uses the South America table's 18°29′S 70°18′W (same station, 65 m), which matches your list. 0.76 mm a year over 59 years is South America's least-precipitation record.                                    |
| `wind-strongest-gust`      | 113.2 m/s (408 km/h), 10 April 1996, Barrow Island, 20°49′S 115°23′E (WMO table). Cyclone Olivia and the 2010 ratification are not in the table: the Bureau of Meteorology's Olivia report covers both. Mount Washington's 103.3 m/s (12 April 1934) is in the same table as the northern hemisphere record.                                           |
| `wind-windiest-place`      | Not a WMO record. The source names Cape Denison (annual mean about 20 m/s, Mawson's 1911–14 expedition) and says the extreme winds reach at least 60 km west, to Port Martin (your target, 59 km away). The 65 km perfect radius counts both. The target is Mawson's Huts' position (−67.0086, 142.6611).                                              |
| `geography-highest-point`  | 8,848.86 m, announced by Nepal and China on 8 December 2020; Nepal's earlier 8,848 m (1954 Survey of India) and China's 8,844.43 m (rock height, 2005) are from the same article. Summit coordinates 27.9881, 86.9253 (0.5 km from your list's).                                                                                                       |
| `geography-lowest-land`    | −441.33 m on 31 August 2026, the latest monthly value when checked; −392 m in 1900 and "about a metre a year" are from the dataset's description. The value goes stale: refresh it (and the date) before launch. Target: your 31.50 °N, 35.50 °E (mid-lake); the default 50 km radius covers the shore.                                                |
| `heat-hottest-average`     | Pedgley gives annual means of the daily maximum (106 °F, 41.1 °C) and minimum (83 °F, 28.3 °C) for 1960–66; the card's 34.7 °C is their average (Guinness rounds to 94 °F, 34.4 °C). He compares both means with the world tables published then, and both are above anything in them: that is what "Turns out" says. Target: your 14.24 °N, 40.30 °E. |
| `rain-24-hour-record`      | 1.825 m in 24 hours, 7–8 January 1966, Foc-Foc, 21°14′S 55°41′E, 2,290 m (WMO table); 1.144 m in 12 hours is the same storm's 12-hour record in the table. Cyclone Denise is not in the table and was not checked: verify the name (Météo-France) or drop it.                                                                                          |

Each record is the only answer except the windiest place (one target with a wide radius). If you
would rather list Port Martin as its own target, it needs its own value and a source for it.
