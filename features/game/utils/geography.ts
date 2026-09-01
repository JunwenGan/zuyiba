/**
 * Geographic lookup data used for player comparison feedback.
 *
 * Georgia is classified as Europe to match its football context (UEFA).
 */

export type Continent =
  'AFRICA' | 'ASIA' | 'EUROPE' | 'NORTH_AMERICA' | 'OCEANIA' | 'SOUTH_AMERICA';

const COUNTRY_CONTINENTS: Readonly<Record<string, Continent>> = {
  AR: 'SOUTH_AMERICA',
  BE: 'EUROPE',
  BR: 'SOUTH_AMERICA',
  CA: 'NORTH_AMERICA',
  DE: 'EUROPE',
  EG: 'AFRICA',
  ES: 'EUROPE',
  FR: 'EUROPE',
  GB: 'EUROPE',
  GE: 'EUROPE',
  IT: 'EUROPE',
  NG: 'AFRICA',
  NL: 'EUROPE',
  NO: 'EUROPE',
  PL: 'EUROPE',
  PT: 'EUROPE',
  RS: 'EUROPE',
};

/**
 * Return a player's continent from their ISO 3166-1 alpha-2 country code.
 */
export function getContinent(countryCode: string): Continent | undefined {
  return COUNTRY_CONTINENTS[countryCode.toUpperCase()];
}
