import fs from 'node:fs';
import path from 'node:path';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

const GEO_DIR = path.join(process.cwd(), 'data', 'geo');

// Try multiple GeoJSON files in order of preference (best first)
const GEO_FILES = [
  'india-districts-updated.geojson',
];

interface NormalizedFeature {
  state: string;
  name: string;
  feature: Feature<Geometry>;
}

let cachedFeatures: NormalizedFeature[] | null = null;

function loadGeo(): NormalizedFeature[] {
  if (cachedFeatures) return cachedFeatures;

  const all: NormalizedFeature[] = [];
  const seen = new Set<string>();

  for (const file of GEO_FILES) {
    const filePath = path.join(GEO_DIR, file);
    if (!fs.existsSync(filePath)) continue;

    const geo = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FeatureCollection;
    const sample = geo.features[0]?.properties || {};

    let stateKey = 'state';
    let nameKey = 'name';
    if (sample.st_nm) { stateKey = 'st_nm'; nameKey = 'district'; }
    else if (sample.NAME_1) { stateKey = 'NAME_1'; nameKey = 'NAME_2'; }
    else if (sample.ST_NM) { stateKey = 'ST_NM'; nameKey = 'dtname'; }

    for (const f of geo.features) {
      const state = (f.properties?.[stateKey] || '').trim();
      const name = (f.properties?.[nameKey] || '').trim();
      const key = `${state.toLowerCase()}::${name.toLowerCase()}`;
      if (!state || !name || seen.has(key)) continue;
      seen.add(key);
      all.push({ state, name, feature: f as Feature<Geometry> });
    }
  }

  cachedFeatures = all;
  return all;
}

// Known district name aliases (data name → GeoJSON names)
const NAME_ALIASES: Record<string, string[]> = {
  // Karnataka
  'kalaburagi': ['gulbarga'],
  'belagavi': ['belgaum'],
  'vijayapura': ['bijapur'],
  'ballari': ['bellary'],
  'shivamogga': ['shimoga'],
  'tumakuru': ['tumkur'],
  'mysuru': ['mysore'],
  'bengaluru urban': ['bangalore urban'],
  'bengaluru rural': ['bangalore rural'],
  'ramanagara': ['ramanagar'],
  'chamarajanagar': ['chamrajnagar'],
  'dakshina kannada': ['dakshin kannad'],
  'uttara kannada': ['uttar kannand'],
  'chikkaballapura': ['chikballapur'],
  'yadgir': ['yadgiri'],
  // Andhra Pradesh / Telangana
  'visakhapatnam': ['vishakhapatnam'],
  'y.s.r.': ['cuddapah'],
  'rangareddy': ['rangareddi'],
  // Uttarakhand
  'dehradun': ['dehra dun'],
  'hardwar': ['haridwar'],
  'nainital': ['naini tal'],
  'rudraprayag': ['rudra prayag'],
  // Haryana
  'mewat': ['gurgaon'],
  'sonipat': ['sonepat'],
  'yamunanagar': ['yamuna nagar'],
  'gurugram': ['gurgaon'],
  // Uttar Pradesh
  'budaun': ['badaun'],
  'prayagraj': ['allahabad'],
  'noida': ['gautam buddha nagar'],
  'kanshiram nagar': ['etah'],
  'mahamaya nagar': ['hathras'],
  'mahrajganj': ['maharajganj'],
  'sant ravidas nagar (bhadohi)': ['sant ravi das nagar'],
  'shrawasti': ['shravasti'],
  'siddharthnagar': ['siddharth nagar'],
  // West Bengal
  'koch bihar': ['kochbihar'],
  'north twenty four parganas': ['north 24 parganas'],
  'south twenty four parganas': ['south 24 parganas'],
  'paschim medinipur': ['west midnapore'],
  'purba medinipur': ['east midnapore'],
  // Tamil Nadu
  'thoothukkudi': ['thoothukudi'],
  'tiruchirappalli': ['tiruchchirappalli'],
  'viluppuram': ['villupuram'],
  // Maharashtra
  'ahmadnagar': ['ahmednagar'],
  'gadchiroli': ['garhchiroli'],
  'mumbai': ['greater bombay'],
  'mumbai suburban': ['greater bombay'],
  // Jharkhand
  'kodarma': ['koderma'],
  'pashchimi singhbhum': ['pashchim singhbhum'],
  'purbi singhbhum': ['purba singhbhum'],
  'saraikela-kharsawan': ['saraikela kharsawan'],
  // Chhattisgarh
  'janjgir - champa': ['janjgir-champa'],
  'kabeerdham': ['kawardha'],
  'rajnandgaon': ['raj nandgaon'],
  // Odisha
  'anugul': ['angul'],
  'balangir': ['balangir', 'bolangir'],
  'bargarh': ['bargarh', 'baragarh'],
  'baudh': ['boudh'],
  'debagarh': ['deogarh'],
  'jagatsinghapur': ['jagatsinghpur'],
  'jajapur': ['jajpur'],
  'kendujhar': ['keonjhar'],
  'nabarangapur': ['nabarangpur'],
  'subarnapur': ['sonepur'],
  // Assam
  'dhubri': ['dhuburi'],
  'dima hasao': ['north cachar hills'],
  'morigaon': ['marigaon'],
  'sivasagar': ['sibsagar'],
  // Jammu and Kashmir
  'badgam': ['bagdam'],
  'leh(ladakh)': ['ladakh (leh)'],
  'rajouri': ['rajauri'],
  // Punjab
  'sahibzada ajit singh nagar': ['mohali'],
  'shahid bhagat singh nagar': ['nawanshahr'],
  // Delhi (single GeoJSON entity)
  'central': ['delhi'],
  'east': ['delhi'],
  'north east': ['delhi'],
  'north west': ['delhi'],
  'north': ['delhi'],
  'south west': ['delhi'],
  'south': ['delhi'],
  'west': ['delhi'],
  // Puducherry
  'pondicherry': ['puducherry', 'pondicherry'],
  // Manipur
  'imphal east': ['imphal'],
  'imphal west': ['imphal'],
  // Gujarat
  'dohad': ['dahod'],
  // Jammu & Kashmir
  'bandipore': ['bandipora'],
  'shupiyan': ['shopiyan'],
  // Madhya Pradesh
  'narsimhapur': ['narsinghpur'],
  // Punjab
  'sahibzada ajit singh nagar': ['mohali', 's.a.s. nagar'],
  // Sikkim
  'north district': ['north sikkim'],
  'south district': ['south sikkim'],
  'west district': ['west sikkim'],
  // Andaman
  'north and middle andaman': ['north and middle andaman', 'north & middle andaman'],
};

function nameMatch(geoName: string, targetName: string): boolean {
  const g = geoName.toLowerCase().trim();
  const t = targetName.toLowerCase().trim();

  if (g === t) return true;
  if (g.includes(t) || t.includes(g)) return true;

  // Check aliases
  const aliases = NAME_ALIASES[t] || [];
  for (const alias of aliases) {
    if (g === alias || g.includes(alias) || alias.includes(g)) return true;
  }

  return false;
}

// State name aliases (data name → GeoJSON names)
const STATE_ALIASES: Record<string, string[]> = {
  'telangana': ['andhra pradesh'],  // Telangana carved from AP in 2014, old GeoJSON has it as AP
  'odisha': ['orissa'],
  'uttarakhand': ['uttaranchal'],
};

function stateMatch(geoState: string, targetState: string): boolean {
  const g = geoState.toLowerCase().trim();
  const t = targetState.toLowerCase().trim();
  if (g === t || g.includes(t) || t.includes(g) || g.includes(t.split(' ')[0])) return true;

  const aliases = STATE_ALIASES[t] || [];
  for (const alias of aliases) {
    if (g === alias || g.includes(alias) || alias.includes(g)) return true;
  }
  return false;
}

export interface DistrictMapSVG {
  statePaths: string[];
  targetPath: string | null;
  viewBox: string;
}

/**
 * Generate projected SVG paths for a district within its state.
 * Uses Mercator projection fitted to the state bounds for accurate shapes.
 */
export function generateDistrictMap(
  districtName: string,
  stateName: string,
  size: number = 200
): DistrictMapSVG | null {
  const allFeatures = loadGeo();

  const stateFeatures = allFeatures.filter(f => stateMatch(f.state, stateName));

  if (stateFeatures.length === 0) return null;

  const stateCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: stateFeatures.map(f => f.feature),
  };

  const projection = geoMercator().fitSize([size, size], stateCollection);
  const pathGen = geoPath(projection);

  const statePaths: string[] = [];
  let targetPath: string | null = null;

  for (const entry of stateFeatures) {
    const d = pathGen(entry.feature);
    if (!d) continue;

    if (nameMatch(entry.name, districtName)) {
      targetPath = d;
    } else {
      statePaths.push(d);
    }
  }

  return {
    statePaths,
    targetPath,
    viewBox: `0 0 ${size} ${size}`,
  };
}
