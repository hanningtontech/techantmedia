declare module "justified-layout" {
  export type JustifiedLayoutBox = {
    aspectRatio: number;
    top: number;
    left: number;
    width: number;
    height: number;
  };

  export type JustifiedLayoutGeometry = {
    containerHeight: number;
    widowCount: number;
    boxes: JustifiedLayoutBox[];
  };

  export type JustifiedLayoutOptions = {
    containerWidth: number;
    targetRowHeight: number;
    boxSpacing?: number;
    containerPadding?: number;
    maxNumRows?: number;
    showWidows?: boolean;
    fullWidthBreakoutRowCadence?: number | false;
    widowLayoutStyle?: "left" | "justify" | "center";
  };

  export default function justifiedLayout(
    input: number[] | { width: number; height: number }[],
    config: JustifiedLayoutOptions,
  ): JustifiedLayoutGeometry;
}
