import type { JWTVerifyGetKey } from "jose";
import { jwtVerify } from "jose";

export interface VerifyAccessTokenOptions {
	/**
	 * Where the public keys come from. Production passes the remote JWKS of the
	 * team; the tests pass a local one. Injecting it is what keeps this service
	 * free of `fetch` and the test suite offline (design.md §7).
	 */
	getKey: JWTVerifyGetKey;
	/** Expected `iss`: `https://<team domain>`. */
	issuer: string;
	/** Expected `aud`: the AUD tag of the Access application. */
	audience: string;
}

/**
 * Returns the email of the person behind an Access token, or `null` when the
 * token cannot be trusted for any reason.
 *
 * This service knows nothing about Hono, `Request` or `env`: it only checks the
 * token. The caller turns a `null` into the project's `401`.
 */
export async function verifyAccessToken(
	token: string,
	{ getKey, issuer, audience }: VerifyAccessTokenOptions,
): Promise<string | null> {
	try {
		const { payload } = await jwtVerify(token, getKey, {
			// Pinning the algorithm is not optional: without it a token claiming
			// HS256 would be verified with the public key as if it were a secret.
			algorithms: ["RS256"],
			issuer,
			audience,
			// Default clock behaviour: `exp` required, `nbf` checked when present.
		});

		const email = payload.email;
		return typeof email === "string" ? email : null;
	} catch {
		// Every failure looks the same from the outside on purpose: the caller
		// answers one single 401, so nothing here can tell a visitor whether the
		// token was expired, forged or for another application.
		return null;
	}
}
