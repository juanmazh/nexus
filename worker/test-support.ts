import type { GenerateKeyPairResult, JWK, JWTPayload } from "jose";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { AccessBindings } from "./middleware/access";

export const TEST_TEAM_DOMAIN = "test.cloudflareaccess.com";
export const TEST_ISSUER = `https://${TEST_TEAM_DOMAIN}`;
export const TEST_AUDIENCE = "test-aud";
export const TEST_EMAIL = "persona@ejemplo.test";

/**
 * Not localhost on purpose: the local shortcut is only reachable from a local
 * hostname, so a test request must never be able to take that path by accident.
 */
export const TEST_ORIGIN = "https://nexus.test";

/**
 * Built from scratch instead of spreading the bindings of the runtime: the vitest
 * plugin loads the developer's `.dev.vars`, and the result of a test must not
 * depend on whose machine is running the suite (design.md §7).
 */
export function testEnv(overrides: Partial<AccessBindings> = {}): AccessBindings {
	return {
		ACCESS_AUD: TEST_AUDIENCE,
		ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN,
		...overrides,
	};
}

// The keys are generated here and now: no real Access key ever enters the repo.
let teamKeys: GenerateKeyPairResult;
let localResolver: ReturnType<typeof createLocalJWKSet>;

export async function setUpAccessKeys(): Promise<void> {
	teamKeys = await generateKeyPair("RS256");
	const keys: JWK[] = [
		{ ...(await exportJWK(teamKeys.publicKey)), kid: "key-0", alg: "RS256", use: "sig" },
	];
	localResolver = createLocalJWKSet({ keys });
}

/** The `getKey` the app is built with in tests: a local JWKS instead of the network. */
export function testGetKey(_teamDomain: string): ReturnType<typeof createLocalJWKSet> {
	return localResolver;
}

export async function signAccessToken(claims: JWTPayload = {}): Promise<string> {
	const nowInSeconds = Math.floor(Date.now() / 1000);
	return new SignJWT({
		iss: TEST_ISSUER,
		aud: TEST_AUDIENCE,
		email: TEST_EMAIL,
		iat: nowInSeconds,
		exp: nowInSeconds + 300,
		...claims,
	})
		.setProtectedHeader({ alg: "RS256", kid: "key-0" })
		.sign(teamKeys.privateKey);
}

/** A request to the API, carrying an Access session when a token is given. */
export function apiRequest(
	path: string,
	{ token, origin = TEST_ORIGIN, ...init }: { token?: string; origin?: string } & RequestInit = {},
): Request {
	return new Request(`${origin}${path}`, {
		...init,
		headers: {
			...(init.headers as Record<string, string> | undefined),
			...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
		},
	});
}
