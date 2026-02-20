/**
 * String utility functions
 */

/**
 * Generate initials from a full name
 * @example getInitials("John Doe") // "JD"
 * @example getInitials("Jane Marie Smith") // "JM"
 */
export function getInitials(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';

  return fullName
    .trim()
    .split(' ')
    .filter(Boolean) // Remove empty strings
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Map work_days CSV numbers (0-6) to day abbreviations
 */
const DAY_ABBREV: Record<string, string> = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
};

/**
 * Convert work_days CSV string to formatted string
 * @example formatWorkDays("1,2,3,4,5") // "Mon, Tue, Wed, Thu, Fri"
 * @example formatWorkDays("1,2,3") // "Mon, Tue, Wed"
 */
export function formatWorkDays(workDays: string | null | undefined): string {
  if (!workDays) return '';
  return workDays
    .split(',')
    .map((day) => DAY_ABBREV[day.trim()] || day)
    .join(', ');
}
