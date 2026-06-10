import { getRandomValues, randomUUID } from "expo-crypto";

// React Native (Hermes) has no global Web Crypto API, but TanStack DB calls
// crypto.randomUUID() when creating collections and transactions. Install a
// minimal polyfill here and import this module before any collection is created
// (it is the first import in app/_layout.tsx). Cast through `unknown` to bypass
// the strict DOM `Crypto` lib type — this is an intentional partial shim.
const g = globalThis as unknown as { crypto?: Record<string, unknown> };

g.crypto ??= {};
if (typeof g.crypto.randomUUID !== "function") {
  g.crypto.randomUUID = randomUUID;
}
if (typeof g.crypto.getRandomValues !== "function") {
  g.crypto.getRandomValues = getRandomValues;
}
