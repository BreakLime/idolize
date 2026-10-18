// A few WebGL2 helpers for the stage: programs, the fullscreen triangle, textures and an offscreen target.

export function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`stage shader: ${gl.getShaderInfoLog(sh)}`);
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`stage program: ${gl.getProgramInfoLog(p)}`);
  return p;
}

/** Uniform setter by name (locations cached per program). */
export function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram) {
  const loc = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!loc.has(name)) loc.set(name, gl.getUniformLocation(p, name));
    return loc.get(name)!;
  };
  return {
    f: (name: string, ...v: number[]) => {
      const l = at(name);
      if (!l) return;
      if (v.length === 1) gl.uniform1f(l, v[0]);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
      else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    },
    i: (name: string, v: number) => {
      const l = at(name);
      if (l) gl.uniform1i(l, v);
    },
    v3: (name: string, v: Float32Array) => {
      const l = at(name);
      if (l) gl.uniform3fv(l, v);
    },
  };
}

/** A texture from an image (mipmapped, for the tunnel's far end) or a small canvas. */
export function texture(gl: WebGL2RenderingContext, src: TexImageSource, mipmaps: boolean): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mipmaps) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  return t;
}

/** An offscreen colour target the scenes draw into before the glitch pass. */
export class Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w = 0;
  h = 0;
  constructor(private gl: WebGL2RenderingContext) {
    this.tex = gl.createTexture()!;
    this.fbo = gl.createFramebuffer()!;
  }
  size(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w;
    this.h = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

/** The fullscreen pass's vertex shader (one triangle covering the screen; no buffers needed). */
export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
