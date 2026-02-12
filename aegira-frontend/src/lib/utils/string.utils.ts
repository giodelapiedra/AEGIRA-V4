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
 * Capitalize first letter of each word
 * @example capitalizeWords("hello world") // "Hello World"
 */
export function capitalizeWords(text: string): string {
  if (!text) return '';
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert snake_case to Title Case
 * @example snakeToTitle("hello_world_test") // "Hello World Test"
 */
export function snakeToTitle(text: string): string {
  if (!text) return '';
  return text
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert CONSTANT_CASE to Title Case
 * @example constantToTitle("PHYSICAL_INJURY") // "Physical Injury"
 */
export function constantToTitle(text: string): string {
  if (!text) return '';
  return text
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Pluralize a word based on count
 * @example pluralize(1, "item") // "item"
 * @example pluralize(2, "item") // "items"
 * @example pluralize(0, "item", "no items") // "no items"
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
  zero?: string
): string {
  if (count === 0 && zero) return zero;
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

/**
 * Create a slug from text
 * @example slugify("Hello World!") // "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Mask sensitive data (email, phone)
 * @example maskEmail("john@example.com") // "j***@example.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [username, domain] = email.split('@');
  const masked = username.charAt(0) + '***';
  return `${masked}@${domain}`;
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

/**
 * Convert work_days CSV string to array of day abbreviations
 * @example formatWorkDaysArray("1,2,3") // ["Mon", "Tue", "Wed"]
 */
export function formatWorkDaysArray(workDays: string | null | undefined): string[] {
  if (!workDays) return [];
  return workDays.split(',').map((day) => DAY_ABBREV[day.trim()] || day);
}
