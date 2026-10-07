import type { JWTVerifyGetKey } from "jose";
import { createRemoteJWKSet } from "jose";

/**
 * One resolver per team domain, kept at module scope so the JWKS cache that jose
 * builds (including its refetch when a rotated `kid` shows up) survives between
 * requests of the same isolate. Without this, every request would spend a
 * subrequest downloading keys that never change within the isolate's lifetime.
 */
const resolversByTeamDomain = new Map<string, JWTVerifyGetKey>();

/**
 * Public keys of the Access team, fetched from `<team>/cdn-cgi/access/certs`.
 * The caching and rotation behaviour is jose's, not ours: reimplementing it
 * would mean testing the library instead of our code (design.md §7).
 */
export function getAccessJwks(teamDomain: string): JWTVerifyGetKey {
	const cached = resolversByTeamDomain.get(teamDomain);
	if (cached) {
		return cached;
	}

	const resolver = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
	resolversByTeamDomain.set(teamDomain, resolver);
	return resolver;
}
