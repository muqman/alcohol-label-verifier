// Place-name equivalences used when comparing addresses and countries.
import { key } from './text';

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', VI: 'Virgin Islands', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
};

const byKey = new Map<string, string[]>();
for (const [code, name] of Object.entries(STATES)) {
  const variants = [code, name, `${code[0]}.${code[1]}.`];
  for (const v of variants) byKey.set(key(v), variants);
}

/** All ways a U.S. state may be written ("Kentucky" -> ["KY", "Kentucky", "K.Y."]). */
export function stateVariants(part: string): string[] | null {
  return byKey.get(key(part)) ?? null;
}

const COUNTRY_ALIASES: string[][] = [
  ['United States', 'USA', 'U.S.A.', 'US', 'U.S.', 'United States of America', 'America'],
  ['United Kingdom', 'UK', 'U.K.', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  ['Netherlands', 'Holland', 'The Netherlands'],
  ['Mexico', 'México'],
  ['Czech Republic', 'Czechia'],
  ['South Korea', 'Korea', 'Republic of Korea'],
];

/** Accepted spellings for a country (the named country always comes first). */
export function countryVariants(country: string): string[] {
  const k = key(country);
  for (const group of COUNTRY_ALIASES) {
    if (group.some((g) => key(g) === k)) {
      // A constituent country (e.g. Scotland) must be matched as written.
      if (['england', 'scotland', 'wales', 'northernireland'].includes(k)) return [country];
      return [country, ...group.filter((g) => key(g) !== k)];
    }
  }
  return [country];
}

export const isDomestic = (country: string) => {
  const k = key(country);
  return k === '' || COUNTRY_ALIASES[0].some((g) => key(g) === k);
};
