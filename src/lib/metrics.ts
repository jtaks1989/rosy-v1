/** Optional venue filter for the metrics API. Omitted entirely when no venue filter is set. */
export function locArg(locations: string[] | null | undefined): { p_locations?: string[] } {
  return locations && locations.length ? { p_locations: locations } : {};
}
