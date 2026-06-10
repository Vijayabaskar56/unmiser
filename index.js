// Custom entry: polyfills must load before expo-router evaluates any route
// modules. TanStack DB collections call crypto.randomUUID() at module load,
// and React Native (Hermes) has no global Web Crypto until we shim it.
import "./lib/polyfills";
import "expo-router/entry";
