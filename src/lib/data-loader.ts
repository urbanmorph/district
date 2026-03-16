import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

export interface DistrictCore {
  id: string;
  name: string;
  state: string;
  stateCode: string;
  censusCode: string;
  lastUpdated: string;
  demographics: {
    population: number;
    rural: number;
    urban: number;
    literacyRate: number;
    sexRatio: number;
    area_sq_km: number;
    density: number;
  };
  economy: {
    gddp_crores: number;
    perCapitaIncome: number;
    gddpComposition: { agriculture: number; industry: number; services: number };
    growthRate: number;
  };
  rankings: {
    perCapitaIncome: { stateRank: string; nationalPercentile: number };
  };
  keySectors: string[];
  strengths: string[];
  challenges: string[];
  opportunities: string[];
  dataCompleteness: { level: string; sources: string[]; lastVerified: string };
  [key: string]: unknown;
}

export function loadDistrict(state: string, district: string): DistrictCore | null {
  const filePath = path.join(DATA_DIR, 'districts', state, `${district}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function loadAllDistricts(): DistrictCore[] {
  const districtsDir = path.join(DATA_DIR, 'districts');
  const districts: DistrictCore[] = [];

  if (!fs.existsSync(districtsDir)) return districts;

  for (const stateDir of fs.readdirSync(districtsDir)) {
    const statePath = path.join(districtsDir, stateDir);
    if (!fs.statSync(statePath).isDirectory()) continue;

    for (const file of fs.readdirSync(statePath)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(statePath, file), 'utf-8'));
        districts.push(data);
      } catch { /* skip invalid files */ }
    }
  }

  return districts;
}

export function getStates(): { name: string; slug: string; districts: DistrictCore[] }[] {
  const allDistricts = loadAllDistricts();
  const stateMap = new Map<string, DistrictCore[]>();

  for (const d of allDistricts) {
    const state = d.state;
    if (!stateMap.has(state)) stateMap.set(state, []);
    stateMap.get(state)!.push(d);
  }

  return Array.from(stateMap.entries())
    .map(([name, districts]) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      districts,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatPopulation(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  return value.toLocaleString('en-IN');
}

/**
 * Compute a data completeness score (0-100) for a district.
 * Higher = more data fields populated.
 */
export function dataCompletenessScore(d: DistrictCore): number {
  let score = 0;
  const checks = [
    // Demographics (30 points)
    () => d.demographics?.population > 0 ? 5 : 0,
    () => d.demographics?.literacyRate > 0 ? 5 : 0,
    () => d.demographics?.sexRatio > 0 ? 5 : 0,
    () => d.demographics?.area_sq_km > 0 ? 5 : 0,
    () => d.demographics?.rural > 0 ? 5 : 0,
    () => d.demographics?.density > 0 ? 5 : 0,
    // Economy (30 points)
    () => d.economy?.perCapitaIncome > 0 ? 10 : 0,
    () => d.economy?.gddp_crores > 0 ? 10 : 0,
    () => (d.economy?.gddpComposition?.agriculture > 0) ? 10 : 0,
    // Sectors & Analysis (25 points)
    () => d.keySectors?.length > 0 ? 10 : 0,
    () => d.strengths?.length > 0 ? 5 : 0,
    () => d.challenges?.length > 0 ? 5 : 0,
    () => d.opportunities?.length > 0 ? 5 : 0,
    // Extended data (15 points)
    () => (d as any).kpis?.length > 0 ? 5 : 0,
    () => (d as any).roadmap ? 5 : 0,
    () => (d as any).industries?.length > 0 ? 5 : 0,
  ];
  for (const check of checks) score += check();
  return score;
}

/**
 * Return a color based on data completeness score.
 * Red → Amber → Green gradient.
 */
export function completenessColor(score: number): string {
  if (score >= 70) return '#10b981'; // green - rich data
  if (score >= 40) return '#f59e0b'; // amber - moderate
  if (score >= 15) return '#ef4444'; // red - basic/minimal
  return '#d1d5db'; // gray - no data
}

/**
 * Return a label for data completeness level.
 */
export function completenessLabel(score: number): string {
  if (score >= 70) return 'Detailed';
  if (score >= 40) return 'Moderate';
  if (score >= 15) return 'Basic';
  return 'Minimal';
}

/**
 * Compute state-level data completeness.
 * Uses a weighted approach: average score boosted by the best district.
 * This ensures states with even one detailed district show as richer.
 */
export function stateCompletenessScore(districts: DistrictCore[]): number {
  if (districts.length === 0) return 0;
  const scores = districts.map(d => dataCompletenessScore(d));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const max = Math.max(...scores);
  // Blend: 40% average + 60% max — so one detailed district lifts the state
  return Math.round(avg * 0.4 + max * 0.6);
}

/**
 * Count how many districts in a state have detailed data (score >= 70).
 */
export function detailedDistrictCount(districts: DistrictCore[]): number {
  return districts.filter(d => dataCompletenessScore(d) >= 70).length;
}
