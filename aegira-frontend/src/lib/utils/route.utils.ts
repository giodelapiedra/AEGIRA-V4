export function buildRoute(route: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    route
  );
}
