import { Color, ShaderMaterial } from "three";

/**
 * Round points that shrink with distance but never grow past a few pixels
 * (instructor, 6 Oct 2026: "the belt and the Trojan points draw as big squares
 * up close"). three's PointsMaterial draws squares and, with size attenuation,
 * has no ceiling: a 0.5-unit point a few units from the camera filled a large
 * square. This keeps the same attenuation (size × scale / depth, as three
 * does) and clamps the result, and discards outside a circle with a soft edge.
 *
 * Colour comes from the scene's tokens (a three Color), never a literal.
 */
export const DOT_MIN_PX = 1;
export const DOT_MAX_PX = 4;

export function makeDotMaterial(color: Color, size: number, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: opacity },
      uSize: { value: size },
      // three's own attenuation factor is half the drawing buffer's height; set per frame.
      uScale: { value: 450 },
      uMinPx: { value: DOT_MIN_PX },
      uMaxPx: { value: DOT_MAX_PX },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uScale;
      uniform float uMinPx;
      uniform float uMaxPx;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uScale / max(-mv.z, 0.0001), uMinPx, uMaxPx);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.5, 0.3, d));
      }
    `,
  });
}
