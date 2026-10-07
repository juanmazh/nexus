import { describe, expect, it } from "vitest";
import { getAccessJwks } from "./access-jwks";

describe("getAccessJwks", () => {
	it("returns the same resolver for the same team domain", () => {
		// One resolver per domain keeps jose's cache alive between requests of the
		// isolate, which is what makes the JWKS cost one subrequest instead of one
		// per request.
		expect(getAccessJwks("equipo.cloudflareaccess.com")).toBe(
			getAccessJwks("equipo.cloudflareaccess.com"),
		);
	});

	it("returns a different resolver for a different team domain", () => {
		expect(getAccessJwks("equipo.cloudflareaccess.com")).not.toBe(
			getAccessJwks("otro.cloudflareaccess.com"),
		);
	});
});
