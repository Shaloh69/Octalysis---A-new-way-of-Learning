// Types for figure-svg.mjs, so the API's tests typecheck it under strict TS.
export declare const MAX_VIEWBOX_WIDTH: number;
export declare const MIN_FONT_SIZE: number;
export declare const FIGURE_CLASSES: Set<string>;
export declare function checkFigureSvg(svg: string, id: string): { problems: string[]; title: string };
