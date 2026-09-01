/**
 * Zod validation schemas for API requests.
 */

import { z } from 'zod';

/**
 * Game ID parameter validation.
 * CUIDs are 25 characters alphanumeric.
 */
export const gameIdSchema = z.string().min(1, 'Game ID is required').max(30, 'Invalid game ID format');

/**
 * Player ID parameter validation.
 */
export const playerIdSchema = z.string().min(1, 'Player ID is required').max(30, 'Invalid player ID format');

/**
 * Submit guess request body validation.
 */
export const submitGuessSchema = z.object({
  playerId: playerIdSchema,
});

export type SubmitGuessInput = z.infer<typeof submitGuessSchema>;

/**
 * Player search query validation.
 * At least one character is required.
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, 'Search query must be at least 1 character')
  .max(100, 'Search query too long');

/**
 * Validate and parse JSON request body.
 * Returns the parsed data or null if invalid.
 */
export async function parseRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string[]> }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }
      return { success: false, errors: fieldErrors };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, errors: { _root: ['Invalid JSON body'] } };
  }
}
