/**
 * Age calculation utilities.
 * Centralized to ensure consistent age values across the application.
 */

/**
 * Calculate age from birth date as of a reference date.
 * Uses UTC dates to avoid timezone issues.
 *
 * @param birthDate - The person's birth date
 * @param referenceDate - The date to calculate age as of (defaults to now)
 * @returns Age in complete years
 */
export function calculateAge(birthDate: Date, referenceDate: Date = new Date()): number {
  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  let age = refYear - birthYear;

  // Check if birthday hasn't occurred yet this year
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age--;
  }

  return age;
}
