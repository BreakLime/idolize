// Draws a ShowState with WebGL2: tunnel and LED wall into an offscreen target, lasers added on top, then the final pass
// (night, glitch, flash, the idol cut out) onto the canvas. The canvas lets the player background through: dimmed by
// the night, and clear inside the idol.
import type { ShowState } from './director';
import { FULLSCREEN_VS, program, Target, texture, uniforms } from './gl';
import { DARKEN_SHARE, whiteShare } from './palette';
import { LASERS_FS, POST_FS, TUNNEL_FS, WALL_FS, WALL_VS } from './shaders';

/** Where the cover sits on the canvas, in canvas pixels (y up). */
export interface WallPlace {
  cx: number;
  cy: number;
  size: number;
}

/** The idol on the canvas: its 24-unit box (left and top in canvas pixels, y up; pixels per unit), the dance's pose
 * (radians for turns, units for moves), its outline width and glow radius (canvas pixels). */
export interface IdolPlace {
  left: number;
  top: number;
  unit: number;
  y: number;
  spin: number;
  nod: number;
  squash: number;
  armL: number;
  armR: number;
  rim: number;
  glow: number;
}

const LEDS = 72;

export class StageRenderer {
  private gl: WebGL2RenderingContext;
  private tunnel: WebGLProgram;
  private wall: WebGLProgram;
  private lasers: WebGLProgram;
  private post: WebGLProgram;
  private u: Record<'tunnel' | 'wall' | 'lasers' | 'post', ReturnType<typeof uniforms>>;
  private target: Target;
  private cover: WebGLTexture | null = null;
  private small: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject;
  private pal = new Float32Array(12);
  private darken = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.tunnel = program(gl, FULLSCREEN_VS, TUNNEL_FS);
    this.wall = program(gl, WALL_VS, WALL_FS);
    this.lasers = program(gl, FULLSCREEN_VS, LASERS_FS);
    this.post = program(gl, FULLSCREEN_VS, POST_FS);
    this.u = { tunnel: uniforms(gl, this.tunnel), wall: uniforms(gl, this.wall), lasers: uniforms(gl, this.lasers), post: uniforms(gl, this.post) };
    this.target = new Target(gl);
    this.vao = gl.createVertexArray()!; // nothing bound: the shaders build their vertices from their ids
  }

  /** The album cover: big (mipmapped) for the tunnel, one texel per LED for the wall. */
  setCover(img: HTMLImageElement) {
    const gl = this.gl;
    if (this.cover) gl.deleteTexture(this.cover);
    if (this.small) gl.deleteTexture(this.small);
    this.cover = texture(gl, img, true);
    const c = document.createElement('canvas');
    c.width = LEDS;
    c.height = LEDS;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, LEDS, LEDS);
    this.small = texture(gl, c, false);
    // a mostly white or light cover pulses darker (its light parts dip), any other brighter (its colours)
    this.darken = whiteShare(g.getImageData(0, 0, LEDS, LEDS).data) >= DARKEN_SHARE ? 1 : 0;
  }

  /** whether this cover's pulse darkens its light parts (a mostly white or light cover) */
  get darkens() {
    return this.darken === 1;
  }

  get ready() {
    return !!this.cover;
  }

  render(s: ShowState, place: WallPlace, idol: IdolPlace | null) {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!this.cover || !this.small || !w || !h) return;
    s.pal.forEach((c, i) => this.pal.set(c, i * 3));
    this.target.size(w, h);
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    if (s.tunnelMix > 0.003) {
      const u = this.u.tunnel;
      gl.useProgram(this.tunnel);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.cover);
      u.i('uCover', 0);
      u.f('uCenter', place.cx, place.cy);
      u.f('uScale', place.size);
      u.f('uZoom', s.zoom);
      u.f('uRot', s.rot);
      u.f('uSeg', s.seg);
      u.f('uTwist', s.twist);
      u.f('uDarken', this.darken);
      u.f('uRings', s.rings);
      u.f('uKick', s.kick);
      u.f('uMix', s.tunnelMix);
      u.f('uBright', s.bright);
      u.v3('uPal', this.pal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (s.wallMix > 0.003) {
      const u = this.u.wall;
      gl.useProgram(this.wall);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.small);
      u.i('uSmall', 0);
      u.f('uRes', w, h);
      u.f('uCenter', place.cx, place.cy);
      u.f('uSize', place.size);
      u.f('uN', LEDS);
      u.f('uShatter', s.shatter);
      u.f('uSeed', s.seed);
      u.f('uTime', s.time);
      u.f('uBoom', s.boom);
      u.f('uTension', s.tension);
      u.f('uVigor', s.vigor);
      u.f('uDarken', this.darken);
      // (the beat's colour: the album's light)
      u.f('uAccent', ...s.pal[0]);
      u.f('uBreath', s.breath);
      u.f('uSwell', s.swell);
      u.f('uMix', s.wallMix);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, LEDS * LEDS);
    }
    if (s.laser > 0.01) {
      const u = this.u.lasers;
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.lasers);
      u.f('uRes', w, h);
      u.f('uLaser', s.laser);
      u.f('uSpread', s.spread);
      u.f('uSweep', s.sweep);
      u.f('uCount', s.lasers);
      u.f('uWidth', Math.max(1, h / 700));
      u.v3('uPal', this.pal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // onto the canvas: night, glitch, flash and the idol
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    const u = this.u.post;
    gl.useProgram(this.post);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.target.tex);
    u.i('uScene', 0);
    u.f('uRes', w, h);
    u.f('uGlitch', s.glitch);
    u.f('uTime', s.time);
    u.f('uFlash', s.flash);
    // (the drop's flash washes the album's colour over it)
    u.f('uFlashColor', ...s.pal[1]);
    if (idol) {
      u.f('uIdol', idol.left, idol.top, idol.unit, 1);
      u.f('uRoot', idol.y, idol.spin);
      u.f('uNod', idol.nod);
      u.f('uSquash', idol.squash);
      u.f('uArms', idol.armL, idol.armR);
      u.f('uRimW', idol.rim);
      u.f('uGlowR', idol.glow);
      // the outline in the album's light (toward white), the glow in its second colour
      const [l, gc] = [s.pal[0], s.pal[1]];
      u.f('uRim', 0.55 + 0.45 * l[0], 0.55 + 0.45 * l[1], 0.55 + 0.45 * l[2]);
      u.f('uGlowC', gc[0] * 0.6, gc[1] * 0.6, gc[2] * 0.6);
    } else u.f('uIdol', 0, 0, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
