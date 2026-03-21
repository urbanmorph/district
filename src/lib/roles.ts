import fs from 'node:fs';
import path from 'node:path';
import type { DistrictCore } from './data-loader';

export interface Role {
  id: string;
  name: string;
  icon: string;
  description: string;
  sections: string[];
  roadmapOwners: string[];
  alwaysAvailable?: boolean;
  requires?: string[];
  requiresRoadmapOwner?: string[];
}

const ROLES_PATH = path.join(process.cwd(), 'data', 'roles', 'base-roles.json');

let cachedRoles: Role[] | null = null;

function loadBaseRoles(): Role[] {
  if (cachedRoles) return cachedRoles;
  try {
    cachedRoles = JSON.parse(fs.readFileSync(ROLES_PATH, 'utf-8'));
    return cachedRoles!;
  } catch {
    return [];
  }
}

/**
 * Get all roadmap component owners for a district.
 */
function getRoadmapOwners(district: DistrictCore): string[] {
  const roadmap = (district as any).roadmap;
  if (!roadmap?.phases) return [];

  const owners = new Set<string>();
  const phases = roadmap.phases;

  for (const key of Object.keys(phases)) {
    const phase = phases[key];
    if (phase.components) {
      for (const comp of phase.components) {
        if (comp.owner) owners.add(comp.owner);
      }
    }
  }
  return Array.from(owners);
}

/**
 * Determine which roles are available for a given district based on its data.
 */
export function getAvailableRoles(district: DistrictCore): Role[] {
  const baseRoles = loadBaseRoles();
  const districtOwners = getRoadmapOwners(district);
  const hasData = {
    demographics: !!district.demographics?.population,
    economy: !!district.economy?.gddp_crores,
    industries: !!(district as any).industries,
    roadmap: !!(district as any).roadmap,
    kdem: !!(district as any).kdem,
  };

  // Check for per-district role overrides
  const overrides = (district as any).roleOverrides as Role[] | undefined;

  const available = baseRoles.filter(role => {
    // Always-available roles
    if (role.alwaysAvailable) return true;

    // Check required data fields
    if (role.requires) {
      for (const req of role.requires) {
        if (!hasData[req as keyof typeof hasData]) return false;
      }
    }

    // Check if district has matching roadmap owners
    if (role.requiresRoadmapOwner && role.requiresRoadmapOwner.length > 0) {
      const hasMatch = role.requiresRoadmapOwner.some(o => districtOwners.includes(o));
      if (!hasMatch) return false;
    }

    return true;
  });

  // Append any district-specific custom roles
  if (overrides) {
    available.push(...overrides);
  }

  return available;
}
