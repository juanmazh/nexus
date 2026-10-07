import { hc } from "hono/client";
// `AppType` is a type, so this import is erased at build time: the SPA bundle
// never includes the Worker code. Deriving the client's routes from the real
// route chain is what makes a contract change fail the front typecheck (ADR-007).
import type { AppType } from "../../worker/app";

export const client = hc<AppType>("/");
