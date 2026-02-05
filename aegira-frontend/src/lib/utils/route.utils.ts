/**
 * Build a route path by replacing :param placeholders with actual values.
 * Values are URL-encoded to prevent XSS and malformed URLs.
 */
export function buildRoute(route: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    route
  );
}
