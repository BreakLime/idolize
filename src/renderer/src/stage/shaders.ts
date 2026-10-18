// The stage's shaders: the kaleidoscope tunnel, the LED wall (one instanced quad per LED), the lasers, and the final
// pass (night, glitch, flash, the idol cut out). Coordinates are render-target pixels; the wall's centre and size come
// from the cover's place.

const HASH = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`;

/** A colour at another's brightness: the beat changes a light's hue, hardly how bright it is (a big area flashing, even
 * white to grey and back, is hard on the eyes). Black stays black. */
const TINT = `
vec3 tintAt(vec3 accent, float lum) {
  vec3 t = accent * (lum / max(dot(accent, vec3(0.299, 0.587, 0.114)), 0.05));
  float top = max(max(t.r, t.g), t.b);
  return top > 1.0 ? t / top : t;
}`;

/** The cover mirrored into segments around its centre and pulled into depth: a tunnel the camera flies through. */
export const TUNNEL_FS = `#version 300 es
precision highp float;
uniform sampler2D uCover;
uniform vec2 uCenter;
uniform float uScale, uZoom, uRot, uSeg, uKick, uMix, uBright, uTwist, uRings, uDarken;
uniform vec3 uPal[4];
out vec4 o;
${TINT}
void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uScale;
  // (it opens a little on each kick)
  float r = length(p) * (1.0 - 0.06 * uKick);
  float depth = 0.3 / max(r, 0.012) + uZoom;
  // the song's spiral: the mirrors turn with the depth
  float seg = 6.2831853 / uSeg;
  float a = mod(atan(p.y, p.x) + uRot + uTwist * depth, seg);
  a = abs(a - 0.5 * seg) / seg;
  vec3 c = texture(uCover, vec2(a * 2.0, depth * 0.35)).rgb;
  // light rings riding the depth (the song's spacing), a palette glow at the far end
  float rings = pow(0.5 + 0.5 * sin(depth * uRings), 10.0);
  c = mix(c, uPal[1], 0.3 * rings);
  float far = smoothstep(0.0, 0.45, r);
  // the kick: it opens (above) and turns toward the album's light at the brightness there, hardly brighter (a light
  // cover's light parts a little dimmer)
  c = mix(c, tintAt(uPal[0], dot(c, vec3(0.299, 0.587, 0.114))), 0.55 * uKick);
  float white = smoothstep(0.5, 0.8, min(min(c.r, c.g), c.b));
  c = mix(uPal[0] * 0.7, c, far) * uBright * (1.0 + 0.1 * uKick * mix(1.0, -white, uDarken));
  float edge = smoothstep(2.2, 0.5, r);
  o = vec4(c * uMix * mix(0.35, 1.0, edge), uMix);
}`;

/** One LED per instance: the cover's colour at its cell, left alone by the beat (calm, a slow breath); a drop's
 * shockwave or a gentle one's swell, a build-up's twinkle, and the peak's burst. */
export const WALL_VS = `#version 300 es
precision highp float;
uniform sampler2D uSmall;
uniform vec2 uRes, uCenter;
uniform float uSize, uN, uShatter, uSeed, uTime, uBoom, uTension, uVigor, uBreath, uSwell, uDarken;
uniform vec3 uAccent;
out vec2 vCorner;
out vec3 vColor;
out float vGlow;
${HASH}
${TINT}
void main() {
  float n = uN;
  vec2 ij = vec2(float(gl_InstanceID % int(n)), float(gl_InstanceID / int(n)));
  vec2 cell = (ij + 0.5) / n;
  vec3 col = texture(uSmall, cell).rgb;
  // the colours pop: more saturated (the dull ones most; greys, white and black not at all), a touch more contrast
  float l0 = dot(col, vec3(0.299, 0.587, 0.114));
  float chroma = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
  col = clamp(mix(vec3(l0), col, 1.0 + 0.35 * (1.0 - chroma) * smoothstep(0.03, 0.15, chroma)), 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.2);
  float d = length(cell - 0.5) * 1.4142;
  float spacing = uSize / n;
  // a drop's shockwave: one big ring out through the wall
  float boom = uBoom > 0.0 ? exp(-pow((d - uBoom * 1.3) * 5.0, 2.0)) * (1.0 - uBoom) : 0.0;
  // a build-up: the wall draws in, and it rains: lit LEDs (more and more of them) whose pattern slides a cell down
  // and to the side each step, faster toward the drop (the step shifts the hash's input along the diagonal)
  float tw = uTension * step(1.0 - 0.35 * uTension, hash(ij + floor(uTime * (3.0 + 18.0 * uTension))));
  // the wall stays put on the beat (only its colours move with it); a drop's shockwave pushes the LEDs aside
  vec2 home = (cell - 0.5) * uSize * (1.0 - 0.07 * uTension);
  home += normalize(home + 0.001) * 4.0 * boom * spacing;
  // the peak's burst: out from the centre, tumbling past the screen's edges, then home again (uShatter 0 → 1 → 0)
  float h1 = hash(ij + uSeed);
  float h2 = hash(ij.yx * 1.7 + uSeed);
  vec2 dir = normalize(home + (vec2(h1, h2) - 0.5) * uSize * 0.7 + 0.001);
  float s = uShatter;
  vec2 off = dir * s * (0.3 + 1.1 * h1) * uSize * (1.0 + 1.4 * s) + vec2(cos(h2 * 31.0 + uTime * 2.3), sin(h1 * 29.0 + uTime * 2.1)) * s * uSize * 0.06;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  // the beat leaves the album alone (its colours, light and place); a drop's shockwave and a gentle drop's swell turn
  // the LEDs toward the album's light at their own brightness (black type stays black, a white page takes the hue)
  float tint = 0.7 * boom + 0.5 * uSwell;
  vColor = mix(col, tintAt(uAccent, lum), clamp(tint, 0.0, 0.85));
  float white = smoothstep(0.5, 0.8, min(min(col.r, col.g), col.b));
  // (the shockwave swells them as it passes, the rain's drops too; a light cover's light parts shrink instead: more
  // white would be more light)
  float grow = 1.0 + (0.6 * boom + 0.25 * tw) * mix(1.0, 1.0 - 1.6 * white, uDarken) + 1.6 * s * h2;
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 pos = uCenter + home + off + corner * spacing * 0.8 * grow;
  gl_Position = vec4(pos / uRes * 2.0 - 1.0, 0.0, 1.0);
  vCorner = corner;
  // brightness: steady but for 12 % at most with those, one way (a light cover's light parts dimmer, any other's
  // colours brighter); dimmer and breathing slowly when calm
  float lift = min(0.12, 0.1 * tint) * mix(1.0, -white, uDarken);
  // the rain's drops light up in their own colour (on a light cover they fall darker: a white page never flares)
  float rain = 0.6 * tw * mix(1.0, -0.6 * white, uDarken);
  // (near the cover's own brightness, a little dimmer in the calm parts)
  vGlow = (0.86 + 0.1 * uTension + 0.5 * s + 0.12 * uBreath) * (1.0 + lift + rain) * (0.86 + 0.14 * uVigor);
}`;

export const WALL_FS = `#version 300 es
precision highp float;
uniform float uMix;
in vec2 vCorner;
in vec3 vColor;
in float vGlow;
out vec4 o;
void main() {
  float r = length(vCorner);
  float core = smoothstep(0.6, 0.42, r);
  float halo = exp(-r * r * 5.0) * 0.5;
  vec3 c = vColor * (core + halo * 0.9) * vGlow;
  // brighter keeps the LED's own colour: scaled back as a whole once a channel is full (not clipped toward white)
  float top = max(max(c.r, c.g), c.b);
  if (top > 1.0) c /= top;
  o = vec4(c, core + halo * 0.4) * uMix;
}`;

/** Beams fanning up from both sides of the stage in the album's colours (drawn additively). */
export const LASERS_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uLaser, uSpread, uSweep, uCount, uWidth;
uniform vec3 uPal[4];
out vec4 o;
vec3 beam(vec2 p, vec2 origin, float ang, vec3 col) {
  vec2 d = vec2(sin(ang), cos(ang));
  vec2 v = p - origin;
  float along = dot(v, d);
  if (along < 0.0) return vec3(0.0);
  float perp = abs(v.x * d.y - v.y * d.x);
  float w = uWidth * (1.0 + along / uRes.y);
  float core = exp(-perp * perp / (w * w));
  float glow = exp(-perp / (w * 9.0)) * 0.22;
  return col * (core + glow) * exp(-along / (uRes.y * 1.4));
}
void main() {
  vec2 p = gl_FragCoord.xy;
  vec3 c = vec3(0.0);
  // (uCount is fractional: a pair coming or going fades, and the fan's spacing glides with it)
  float pairs = uCount * 0.5;
  for (int i = 0; i < 12; i++) {
    float j = float(i >> 1);
    float w = clamp(pairs - j, 0.0, 1.0);
    if (w <= 0.0) break;
    float side = (i & 1) == 0 ? -1.0 : 1.0;
    float k = j / max(1.0, pairs - 1.0) - 0.5;
    vec2 origin = vec2(uRes.x * (0.5 + side * 0.46), -uRes.y * 0.02);
    float ang = -side * 0.42 + k * uSpread + side * uSweep;
    c += beam(p, origin, ang, uPal[i % 3]) * w;
  }
  o = vec4(c * uLaser, 0.0);
}`;

/** The final pass: night under the scene, the drop's glitch (sliding blocks, a colour split, scanlines) and its flash
 * (a wash of the album's colour), and the idol cut out of it all: a hole through the stage to whatever is behind it
 * (the player background: the desktop with Transparent or Acrylic), outlined in the album's light. The idol is the
 * logo's drawing (a 24-unit box, y down: head, body, two arms) in the dance's current pose, as a distance field. */
export const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uGlitch, uTime, uFlash;
uniform vec3 uFlashColor;
// the idol: its box's left and top (canvas pixels, y up), pixels per unit, on; the pose (root drop and spin, the nod,
// the squash, the arms, radians); its outline and glow
uniform vec4 uIdol;
uniform vec2 uRoot, uArms;
uniform float uNod, uSquash, uRimW, uGlowR;
uniform vec3 uRim, uGlowC;
out vec4 o;
${HASH}
${TINT}
float sdBox(vec2 p, vec2 c, vec2 h) {
  vec2 q = abs(p - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// SVG's rotate(a, c) (y down: clockwise on screen)
vec2 turn(vec2 p, vec2 c, float a) {
  float s = sin(a), k = cos(a);
  p -= c;
  return c + vec2(k * p.x - s * p.y, s * p.x + k * p.y);
}
// an arm: the curve from p0 (c2-1.6 3.6-1.6 5.5 0) as 8 segments, 1.8 wide
float sdArm(vec2 p, vec2 p0) {
  vec2 b = p0 + vec2(2.0, -1.6), c = p0 + vec2(3.6, -1.6), e = p0 + vec2(5.5, 0.0);
  float d = 1e9;
  vec2 prev = p0;
  for (int i = 1; i <= 8; i++) {
    float t = float(i) / 8.0, u = 1.0 - t;
    vec2 q = u * u * u * p0 + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * e;
    d = min(d, sdSeg(p, prev, q));
    prev = q;
  }
  return d - 0.9;
}
// the transforms logoDance.ts sets, undone: root translate(0 y) rotate(spin 12 12), head translate(0 nod), body
// translate(0 20.5·squash) scale(1 1−squash), arms rotate(a 8.5 14.5) / rotate(a 15.5 14.5)
float idol(vec2 q) {
  vec2 l = turn(q - vec2(0.0, uRoot.x), vec2(12.0), -uRoot.y);
  float d = length(l - vec2(12.0, 4.5 + uNod)) - 2.5;
  float k = 1.0 - uSquash;
  d = min(d, sdBox(vec2(l.x, (l.y - 20.5 * uSquash) / k), vec2(12.0, 15.0), vec2(3.5, 5.5)) * k);
  d = min(d, sdArm(turn(l, vec2(8.5, 14.5), -uArms.x), vec2(3.0, 14.5)));
  d = min(d, sdArm(turn(l, vec2(15.5, 14.5), -uArms.y), vec2(15.5, 14.5)));
  return d;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float g = uGlitch;
  float n = hash(vec2(floor(uv.y * 26.0), floor(uTime * 24.0)));
  float slide = (n - 0.5) * 0.14 * g * step(0.7, n);
  uv.x += slide;
  float split = 0.016 * g;
  vec4 c = texture(uScene, uv);
  vec4 cr = texture(uScene, uv + vec2(split, 0.0));
  vec4 cb = texture(uScene, uv - vec2(split, 0.0));
  c = vec4(cr.r, c.g, cb.b, max(c.a, max(cr.a, cb.a)));
  // night falls over the player background, darker toward the edges (still showing through)
  vec2 nq = vec2((gl_FragCoord.x / uRes.x - 0.5) / 0.5, (1.0 - gl_FragCoord.y / uRes.y - 0.45) / 0.55);
  c.a += mix(0.6, 0.92, clamp(length(nq) / 1.4142, 0.0, 1.0)) * (1.0 - c.a);
  c.rgb *= 1.0 - g * 0.35 * step(0.5, fract(gl_FragCoord.y * 0.5));
  // the drop's flash: a wash of the album's colour at about the brightness already there (a little more), not a flash
  // of light
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  c.rgb = mix(c.rgb, tintAt(uFlashColor, min(1.0, l + 0.12)), uFlash);
  c.a = max(c.a, uFlash * 0.3);
  if (uIdol.w > 0.0) {
    // (it tears with the glitch like the rest)
    vec2 fp = vec2(gl_FragCoord.x + slide * uRes.x, gl_FragCoord.y);
    vec2 q = vec2(fp.x - uIdol.x, uIdol.y - fp.y) / uIdol.z;
    float m = 5.0 * uGlowR / uIdol.z + 4.0;
    if (q.x > -m && q.x < 24.0 + m && q.y > -m && q.y < 24.0 + m) {
      float d = idol(q) * uIdol.z;
      float hole = smoothstep(0.8, -0.8, d);
      float rim = exp(-d * d / (uRimW * uRimW));
      float glow = exp(-max(d, 0.0) / uGlowR) * (1.0 - hole);
      c *= 1.0 - hole;
      c.rgb += uRim * rim + uGlowC * glow;
      c.a = min(1.0, max(c.a, rim) + glow * (1.0 - c.a) * 0.6);
    }
  }
  o = c;
}`;
