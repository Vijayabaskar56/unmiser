const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Let Metro bundle drizzle-kit's generated .sql migration files.
config.resolver.sourceExts.push("sql");

// Import .svg files as React components (react-native-svg-transformer). The
// transformer chains to Expo's default babel transformer, and uniwind's worker
// delegates to that same Expo worker, so the chain composes. SVGs must move from
// assetExts to sourceExts so Metro transforms (not asset-resolves) them.
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer/expo");
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts.push("svg");

// The UI icon sprite ships as a runtime asset (read once, symbols extracted on
// demand — see lib/icons/sprite.ts). Give it a non-.svg extension so the svg
// transformer above doesn't turn the 1.85MB sprite into a React component;
// `.sprite` is bundled as an asset instead, loaded via expo-asset/file-system.
config.resolver.assetExts.push("sprite");

const uniwindConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});

module.exports = uniwindConfig;
