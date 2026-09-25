// ─────────────────────────────────────────────────────────────────────────────
//  gl.js — the "camera": a WebGL2 post pipeline.
//  The 2D scene canvas is uploaded as a texture every sub-frame and run through
//  a lens shader (chromatic aberration, barrel warp, liquid layer, refraction,
//  flash, vignette, grain). Sub-frames are accumulated into a half-float target
//  to produce true, shutter-weighted motion blur, then resolved with dithering.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*.5+.5; gl_Position = vec4(aPos,0.,1.); }`;

const POST = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime, uChroma, uGrain, uVig, uLiquid, uRefract, uFlash, uInvert, uWeight, uFrame, uLiqT, uWarp;
in vec2 vUv; out vec4 o;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
uvec2 pcg2d(uvec2 v){ v = v*1664525u + 1013904223u; v.x += v.y*1664525u; v.y += v.x*1664525u; v ^= v>>16u;
  v.x += v.y*1664525u; v.y += v.x*1664525u; v ^= v>>16u; return v; }
float grainAt(vec2 fc, float fr){ return float(pcg2d(uvec2(fc) + uvec2(uint(fr)*7919u, uint(fr)*104729u)).x)/4294967295.; }

float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y);
}
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v+=a*vnoise(p); p=m*p; a*=.5; } return v; }

const vec3 INK=vec3(.047,.047,.063), COBALT=vec3(.18,.294,1.), CORAL=vec3(1.,.294,.169),
           LIME=vec3(.831,1.,.227), PAPER=vec3(.937,.918,.878), VIOLET=vec3(.545,.361,1.);

vec3 liquid(vec2 uv, float t, out vec2 grad){
  vec2 p = (uv-.5)*vec2(uRes.x/uRes.y,1.)*2.4;
  vec2 q = vec2(fbm(p+vec2(0.,0.)+.20*t), fbm(p+vec2(5.2,1.3)-.17*t));
  vec2 r = vec2(fbm(p+3.6*q+vec2(1.7,9.2)+.34*t), fbm(p+3.6*q+vec2(8.3,2.8)-.29*t));
  float f = fbm(p+3.2*r);
  grad = (r-.5);
  vec3 col = mix(INK, COBALT, clamp(f*f*3.2,0.,1.));
  col = mix(col, VIOLET, clamp(length(q)*1.1-.55,0.,1.)*.8);
  col = mix(col, CORAL, smoothstep(.55,.85,r.y));
  col = mix(col, LIME, smoothstep(.72,.95,r.x)*.9);
  // glossy highlight bands — the "liquid chrome" read
  float band = smoothstep(.0,.02,abs(fract(f*9.)-.5)-.44);
  col = mix(col, PAPER, band*.35*smoothstep(.45,.8,f));
  col += pow(clamp(f*1.25,0.,1.),6.)*.55;
  return col;
}

void main(){
  vec2 uv = vUv;
  vec2 c = uv-.5;
  float d2 = dot(c*vec2(1.78,1.),c*vec2(1.78,1.));
  // lens: barrel warp grows with impact energy
  uv = .5 + c*(1. - uWarp*.10*d2);
  vec2 g = vec2(0.);
  vec3 liq = vec3(0.);
  if(uLiquid>0.){ liq = liquid(uv, uLiqT, g); }
  vec2 ruv = uv + g*uRefract;
  vec2 off = (uv-.5)*uChroma*.0055;
  vec4 tg = texture(uTex, ruv);
  float r = texture(uTex, ruv+off).r, b = texture(uTex, ruv-off).b;
  vec3 col = vec3(r, tg.g, b);          // premultiplied scene
  col = col + liq*(1.-tg.a);            // scene over liquid
  col = mix(col, 1.-col, uInvert);
  col += uFlash;
  col *= 1. - uVig*smoothstep(.35,1.25,sqrt(d2));
  float n = grainAt(gl_FragCoord.xy, uFrame) - .5;
  col += n*uGrain;
  o = vec4(col*uWeight, uWeight);
}`;

const RESOLVE = `#version 300 es
precision highp float;
uniform sampler2D uAcc; uniform float uFrame;
in vec2 vUv; out vec4 o;
uvec2 pcg2d(uvec2 v){ v = v*1664525u + 1013904223u; v.x += v.y*1664525u; v.y += v.x*1664525u; v ^= v>>16u;
  v.x += v.y*1664525u; v.y += v.x*1664525u; v ^= v>>16u; return v; }
float grainAt(vec2 fc, float fr){ return float(pcg2d(uvec2(fc) + uvec2(uint(fr)*7919u, uint(fr)*104729u)).x)/4294967295.; }
void main(){
  vec4 a = texture(uAcc, vUv);
  vec3 col = a.rgb/max(a.a,1e-5);
  col += (grainAt(gl_FragCoord.xy, uFrame+500.)-.5)/255.;   // dither away banding
  o = vec4(clamp(col,0.,1.),1.);
}`;

class Lens {
  constructor(canvas) {
    const gl = (this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false }));
    if (!gl) throw new Error('WebGL2 unavailable');
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    const mk = (fs) => {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p, u };
    };
    this.post = mk(POST);
    this.resolve = mk(RESOLVE);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.src = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.acc = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.acc);
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.acc, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  begin() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // Add one sub-frame (the 2D canvas + its fx) with the given weight.
  add(canvas2d, fx, weight, frame) {
    const gl = this.gl, { p, u } = this.post;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uChroma, fx.chroma);
    gl.uniform1f(u.uWarp, fx.warp);
    gl.uniform1f(u.uGrain, fx.grain);
    gl.uniform1f(u.uVig, fx.vig);
    gl.uniform1f(u.uLiquid, fx.liquid);
    gl.uniform1f(u.uLiqT, fx.liqT);
    gl.uniform1f(u.uRefract, fx.refract);
    gl.uniform1f(u.uFlash, fx.flash);
    gl.uniform1f(u.uInvert, fx.invert);
    gl.uniform1f(u.uWeight, weight);
    gl.uniform1f(u.uFrame, frame % 997);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  end(frame) {
    const gl = this.gl, { p, u } = this.resolve;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.acc);
    gl.uniform1i(u.uAcc, 0);
    gl.uniform1f(u.uFrame, frame % 991);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
