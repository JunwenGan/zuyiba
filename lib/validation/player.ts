import { z } from 'zod';
import { LEAGUES, POSITION_GROUPS, PREFERRED_FEET } from '@/types/database';
import { calculateAge } from '@/features/game/utils/age';

// Eligibility policy for the game's player dataset, not a universal football rule.
export const MIN_PLAYER_AGE = 14;
export const MAX_PLAYER_AGE = 60;

const birthDateSchema = z.string().superRefine((value, ctx) => {
  const birthDate = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== value
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Birth date must be a real date in YYYY-MM-DD format',
    });
    return;
  }

  const referenceDate = new Date();
  if (birthDate > referenceDate) {
    ctx.addIssue({ code: 'custom', message: 'Birth date cannot be in the future' });
    return;
  }

  const age = calculateAge(birthDate, referenceDate);
  if (age < MIN_PLAYER_AGE || age > MAX_PLAYER_AGE) {
    ctx.addIssue({
      code: 'custom',
      message: `Player age must be between ${MIN_PLAYER_AGE} and ${MAX_PLAYER_AGE} years (received ${age})`,
    });
  }
});

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
  birthDate: birthDateSchema,
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
    z
      .enum(PREFERRED_FEET, {
        message: `Preferred foot must be one of: ${PREFERRED_FEET.join(', ')}`,
      })
      .nullable()
  ),
  active: z.preprocess(
    (value) => (value === 'true' ? true : value === 'false' ? false : value),
    z.boolean().default(true)
  ),
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
