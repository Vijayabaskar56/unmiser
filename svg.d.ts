// Type .svg imports as React components (react-native-svg-transformer).
declare module "*.svg" {
  import type { FC } from "react";
  import type { SvgProps } from "react-native-svg";

  const content: FC<SvgProps>;
  export default content;
}

// The icon sprite ships as a runtime asset (.sprite, see metro.config.js); the
// module value is the metro asset id passed to Asset.fromModule.
declare module "*.sprite" {
  const assetId: number;
  export default assetId;
}
