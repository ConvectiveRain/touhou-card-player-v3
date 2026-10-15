/**
 * Deep links that prefill the remote-opponent panel: `?code=<share code>&role=client|observer`.
 *
 * A server shares one of these (built from its own page URL) so a friend lands on the game
 * tab with the share code and role already filled in and only has to press connect.
 */

export type JoinRole = "client" | "observer";

export const JoinCodeParam = "code";
export const JoinRoleParam = "role";

export type JoinPrefill = {
  code: string;
  role: JoinRole;
};

/**
 * Reads the prefill out of raw query values. Returns null when there is no code to join with,
 * so a bare `?role=client` (or no query at all) keeps the manual flow.
 *
 * A missing or unrecognized role defaults to client: joining as an opponent is the common case,
 * and an observer can still flip the switch before connecting.
 */
export function resolveJoinLink(
  code: string | null | undefined, role: string | null | undefined,
): JoinPrefill | null {
  if (!code) { return null; }
  return { code, role: role === "observer" ? "observer" : "client" };
}

/**
 * Builds the URL a server shares. Existing query parameters are preserved so the recipient keeps
 * flags such as `locale` or `r2`; only the code and role are overwritten.
 */
export function buildJoinUrl(href: string, code: string, role: JoinRole): string {
  const url = new URL(href);
  url.searchParams.set(JoinCodeParam, code);
  url.searchParams.set(JoinRoleParam, role);
  return url.toString();
}
