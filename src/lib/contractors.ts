import data from '../data/contractors.json';

export const SERVICE_SHORT: Record<string, string> = {
  sprinklers: 'Sprinklers',
  alarms: 'Fire alarms',
  monitoring: 'Monitoring',
  extinguishers: 'Extinguishers',
  kitchen: 'Kitchen systems',
  'special-hazard': 'Special hazard',
  engineering: 'Engineering',
  training: 'Training & plans',
  chimney: 'Chimney & woodstove',
  wildfire: 'Wildfire',
  'emergency-lighting': 'Emergency lighting',
  firestopping: 'Firestopping & doors',
};

/** Product categories each contractor type installs or services. */
export const SERVICE_CATEGORIES: Record<string, string[]> = {
  sprinklers: ['commercial-sprinklers', 'residential-sprinklers'],
  alarms: ['commercial-fire-alarm', 'smoke-and-co-alarms'],
  monitoring: ['home-fire-monitoring', 'commercial-fire-alarm'],
  extinguishers: ['business-extinguishers', 'fire-extinguishers'],
  kitchen: ['commercial-kitchen-suppression'],
  'special-hazard': ['special-hazard-suppression', 'equipment-suppression'],
  engineering: [],
  training: ['business-extinguishers'],
  chimney: ['heating-and-chimney'],
  wildfire: ['exterior-sprinklers', 'ember-resistant-vents', 'defensible-space-tools'],
  'emergency-lighting': ['emergency-lighting-and-doors'],
  firestopping: ['emergency-lighting-and-doors'],
};

export const services = data.services as any[];
export const associations = data.associations as any[];
export const regions = data.regions as any[];
export const companies = data.companies as any[];
export const programs = data.programs as any[];

export const regionByKey = (k: string) => regions.find((r) => r.key === k);

/** Group companies by region (in region order) then metro. */
export function groupByRegion(list: any[]) {
  return regions
    .map((r) => {
      const inRegion = list.filter((c) => c.regions.includes(r.key));
      const metros = [...new Set(inRegion.map((c) => c.metro ?? 'Region-wide'))];
      metros.sort((a, b) => (a === 'Region-wide' ? 1 : b === 'Region-wide' ? -1 : 0));
      return { region: r, metros: metros.map((m) => ({ metro: m, cos: inRegion.filter((c) => (c.metro ?? 'Region-wide') === m) })) };
    })
    .filter((g) => g.metros.length > 0);
}
