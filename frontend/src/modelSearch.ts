/** Shared text matching for model names and Basic UDI-DI identifiers. */
export function matchesModelSearch(query: string, ...values: Array<string | null | undefined>): boolean {
  const search = query.trim().toLocaleLowerCase();
  return !search || values.some(value => value?.toLocaleLowerCase().includes(search));
}
