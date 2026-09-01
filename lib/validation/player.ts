import { z } from 'zod';
import { LEAGUES, POSITION_GROUPS, PREFERRED_FEET } from '@/types/database';

/**
 * Zod schema for validating player CSV rows.
 * Used during the seed process to ensure data integrity.
 */
export const playerCsvRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  nationality: z.string().min(1, 'Nationality is required'),
  countryCode: z.string().length(2, 'Country code must be 2 characters').toUpperCase(),
  club: z.string().min(1, 'Club is required'),
  league: z.enum(LEAGUES, {
    message: `League must be one of: ${LEAGUES.join(', ')}`,
  }),
  position: z.string().min(1, 'Position is required'),
  positionGroup: z.enum(POSITION_GROUPS, {
    message: `Position group must be one of: ${POSITION_GROUPS.join(', ')}`,
  }),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format'),
  heightCm: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.coerce
      .number()
      .int('Height must be an integer')
      .min(150, 'Height must be at least 150cm')
      .max(220, 'Height must be at most 220cm')
      .nullable()
  ),
  preferredFoot: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.enum(PREFERRED_FEET, {
      message: `Preferred foot must be one of: ${PREFERRED_FEET.join(', ')}`,
    }).nullable()
  ),
  active: z.coerce.boolean().default(true),
  popularity: z.coerce
    .number()
    .int('Popularity must be an integer')
    .min(1, 'Popularity must be at least 1')
    .max(100, 'Popularity must be at most 100')
    .default(50),
  imageUrl: z.string().url().optional().or(z.literal('')),
  clubLogoUrl: z.string().url().optional().or(z.literal('')),
});

export type PlayerCsvRow = z.infer<typeof playerCsvRowSchema>;

/**
 * Validates a single CSV row and returns parsed data or errors.
 */
export function validatePlayerRow(
  row: Record<string, unknown>,
  rowIndex: number
): { success: true; data: PlayerCsvRow } | { success: false; errors: string[] } {
  const result = playerCsvRowSchema.safeParse(row);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(
    (issue) => `Row ${rowIndex + 1}: ${issue.path.join('.')} - ${issue.message}`
  );

  return { success: false, errors };
}

/**
 * Validates all CSV rows and returns parsed data or all errors.
 */
export function validatePlayerCsv(
  rows: Record<string, unknown>[]
): { success: true; data: PlayerCsvRow[] } | { success: false; errors: string[] } {
  const allErrors: string[] = [];
  const validData: PlayerCsvRow[] = [];
  const slugs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const result = validatePlayerRow(rows[i], i);

    if (result.success) {
      // Check for duplicate slugs
      if (slugs.has(result.data.slug)) {
        allErrors.push(`Row ${i + 1}: Duplicate slug "${result.data.slug}"`);
      } else {
        slugs.add(result.data.slug);
        validData.push(result.data);
      }
    } else {
      allErrors.push(...result.errors);
    }
  }

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors };
  }

  return { success: true, data: validData };
}
