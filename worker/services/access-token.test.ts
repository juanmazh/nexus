import type { GenerateKeyPairResult, JSONWebKeySet, JWK, JWTPayload } from "jose";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyAccessToken } from "./access-token";

const ISSUER = "https://test.cloudflareaccess.com";
const AUDIENCE = "test-aud";
const EMAIL = "persona@ejemplo.test";

type SigningKey = GenerateKeyPairResult["privateKey"];

// The keys are generated here and now: no real Access key ever enters the repo.
let teamKeys: GenerateKeyPairResult;
let strangerKeys: GenerateKeyPairResult;
let previousKeys: GenerateKeyPairResult;

beforeAll(async () => {
	[teamKeys, strangerKeys, previousKeys] = await Promise.all([
		generateKeyPair("RS256"),
		generateKeyPair("RS256"),
		generateKeyPair("RS256"),
	]);
});

/** Builds a JWKS the way Access publishes one: public keys tagged with `kid` and `alg`. */
async function jwksOf(...keyPairs: GenerateKeyPairResult[]): Promise<JSONWebKeySet> {
	const keys: JWK[] = await Promise.all(
		keyPairs.map(async ({ publicKey }, index) => ({
			...(await exportJWK(publicKey)),
			kid: `key-${index}`,
			alg: "RS256",
			use: "sig",
		})),
	);
	return { keys };
}

async function signToken(
	privateKey: SigningKey,
	claims: JWTPayload = {},
	kid = "key-0",
): Promise<string> {
	const nowInSeconds = Math.floor(Date.now() / 1000);
	return new SignJWT({
		iss: ISSUER,
		aud: AUDIENCE,
		email: EMAIL,
		iat: nowInSeconds,
		exp: nowInSeconds + 300,
		...claims,
	})
		.setProtectedHeader({ alg: "RS256", kid })
		.sign(privateKey);
}

async function verify(token: string, ...keyPairs: GenerateKeyPairResult[]) {
	return verifyAccessToken(token, {
		getKey: createLocalJWKSet(await jwksOf(...keyPairs)),
		issuer: ISSUER,
		audience: AUDIENCE,
	});
}

describe("a trustworthy token", () => {
	it("returns the email of the principal", async () => {
		const token = await signToken(teamKeys.privateKey);

		expect(await verify(token, teamKeys)).toBe(EMAIL);
	});

	it("returns null when the token carries no email", async () => {
		const token = await signToken(teamKeys.privateKey, { email: undefined });

		expect(await verify(token, teamKeys)).toBeNull();
	});
});

describe("a token that cannot be trusted", () => {
	it("returns null when the signature was made with a foreign key", async () => {
		const token = await signToken(strangerKeys.privateKey);

		expect(await verify(token, teamKeys)).toBeNull();
	});

	it("returns null when the audience is another application", async () => {
		const token = await signToken(teamKeys.privateKey, { aud: "otra-aplicacion" });

		expect(await verify(token, teamKeys)).toBeNull();
	});

	it("returns null when the issuer is another Access team", async () => {
		const token = await signToken(teamKeys.privateKey, {
			iss: "https://otro.cloudflareaccess.com",
		});

		expect(await verify(token, teamKeys)).toBeNull();
	});

	it("returns null when the token has expired", async () => {
		const nowInSeconds = Math.floor(Date.now() / 1000);
		const token = await signToken(teamKeys.privateKey, { exp: nowInSeconds - 60 });

		expect(await verify(token, teamKeys)).toBeNull();
	});

	it("returns null when the token is not valid yet", async () => {
		const nowInSeconds = Math.floor(Date.now() / 1000);
		const token = await signToken(teamKeys.privateKey, { nbf: nowInSeconds + 600 });

		expect(await verify(token, teamKeys)).toBeNull();
	});

	it("returns null on a value that is not a JWT at all", async () => {
		expect(await verify("esto-no-es-un-jwt", teamKeys)).toBeNull();
		expect(await verify("a.b.c", teamKeys)).toBeNull();
		expect(await verify("", teamKeys)).toBeNull();
	});
});

describe("key rotation", () => {
	it("accepts a token signed with the previous key while it is still published", async () => {
		const tokenWithPreviousKey = await signToken(previousKeys.privateKey, {}, "key-0");
		const tokenWithCurrentKey = await signToken(teamKeys.privateKey, {}, "key-1");
		const jwksDuringRotation = await jwksOf(previousKeys, teamKeys);

		expect(
			await verifyAccessToken(tokenWithPreviousKey, {
				getKey: createLocalJWKSet(jwksDuringRotation),
				issuer: ISSUER,
				audience: AUDIENCE,
			}),
		).toBe(EMAIL);
		expect(
			await verifyAccessToken(tokenWithCurrentKey, {
				getKey: createLocalJWKSet(jwksDuringRotation),
				issuer: ISSUER,
				audience: AUDIENCE,
			}),
		).toBe(EMAIL);
	});

	it("denies a token signed with a key that is no longer published", async () => {
		const tokenWithRetiredKey = await signToken(previousKeys.privateKey, {}, "key-0");

		expect(await verify(tokenWithRetiredKey, teamKeys)).toBeNull();
	});
});
