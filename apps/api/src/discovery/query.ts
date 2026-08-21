export const SEARCH_QUERY_MAX_LENGTH = 200;
export const SEARCH_TOKEN_MAX = 12;
export const SEARCH_DEFAULT_PAGE = 1;
export const SEARCH_DEFAULT_LIMIT = 10;
export const SEARCH_MAX_LIMIT = 20;

export function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
