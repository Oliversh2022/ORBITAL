(() => {
  const canvas = document.getElementById("ghost-fibers");
  const gl = canvas && canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return;

  const settings = {
    lineColor: [0x14 / 255, 0x0e / 255, 0x35 / 255],
    glowColor: [0x34 / 255, 0x37 / 255, 0xa0 / 255],
    speed: 0.2,
    scale: 2,
    rotation: 0,
    rotationSpeed: 0.25,
    layers: 4,
    waveAmplitude: 0.015,
    waveFrequency: 3,
    waveSpeed: 0.15,
    layerSpeed: 0.08,
    twist: 0.1,
    twistFrequency: 5,
    twistSpeed: 1.2,
    lineFrequency: 5,
    lineSpacing: 2,
    lineSharpness: 16,
    glowFalloff: 10,
    glowIntensity: 1.6,
    brightness: 2,
    blueBoost: 1.25,
    vignette: 0.8,
    grain: 0.05,
    dpr: 1,
  };

  const vertex = `#version 300 es
    in vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragment = `#version 300 es
    precision highp float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uRotation;
    uniform float uLayers;
    uniform float uWaveAmplitude;
    uniform float uWaveFrequency;
    uniform float uWaveSpeed;
    uniform float uLayerSpeed;
    uniform float uTwist;
    uniform float uTwistFrequency;
    uniform float uTwistSpeed;
    uniform float uLineFrequency;
    uniform float uLineSpacing;
    uniform float uLineSharpness;
    uniform float uGlowFalloff;
    uniform float uGlowIntensity;
    uniform float uBrightness;
    uniform float uBlueBoost;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uRotationSpeed;
    uniform vec3 uLineColor;
    uniform vec3 uGlowColor;
    out vec4 fragColor;
    #define MAX_LAYERS 10
    mat2 rotate2d(float angle) {
      float sine = sin(angle);
      float cosine = cos(angle);
      return mat2(cosine, -sine, sine, cosine);
    }
    float grainHash(vec2 point) {
      point = floor(point);
      float hash = 52.9829189 * fract(dot(point, vec2(0.065, 0.005)));
      return fract(hash);
    }
    float layeredGrain(vec2 fragmentPixel) {
      vec2 point = mod(fragmentPixel + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
      vec2 rotated = mat2(0.8, -0.5, 0.5, 0.8) * point;
      float grain = 0.0;
      grain += 0.40 * grainHash(rotated);
      grain += 0.25 * grainHash(rotated * 2.0 + 17.0);
      grain += 0.20 * grainHash(rotated * 4.0 + 47.0);
      grain += 0.10 * grainHash(rotated * 8.0 + 113.0);
      grain += 0.05 * grainHash(rotated * 16.0 + 191.0);
      return grain;
    }
    void main() {
      vec2 resolution = max(uResolution, vec2(1.0));
      vec2 uv = (2.0 * gl_FragCoord.xy - resolution) / resolution.y;
      float time = uTime * uSpeed;
      vec3 backdrop = vec3(0.070588, 0.058824, 0.090196);
      vec3 centerTone = max(uLineColor * 0.85567 - uGlowColor * 0.06186, vec3(0.0));
      vec3 cloudTone = uLineColor * 0.19588 + uGlowColor * 0.2268;
      vec2 p = uv / max(uScale, 0.05);
      p = rotate2d(radians(uRotation) + time * uRotationSpeed) * p;
      vec3 color = vec3(0.0);
      for (int index = 0; index < MAX_LAYERS; index++) {
        float fi = float(index) + 1.0;
        if (fi > uLayers) break;
        p += uWaveAmplitude * sin(p.yx * fi * uWaveFrequency + time * (uWaveSpeed + fi * uLayerSpeed));
        float radius = length(p);
        float polarAngle = atan(p.y, p.x);
        polarAngle += sin(radius * uTwistFrequency - time * uTwistSpeed + fi) * uTwist;
        p = vec2(cos(polarAngle), sin(polarAngle)) * radius;
        float lines = abs(sin(p.x * (uLineFrequency + fi * uLineSpacing) + sin(p.y * 3.0 + time)));
        lines = pow(max(0.0, 1.0 - lines), uLineSharpness);
        color += uLineColor * lines / fi;
        float glow = exp(-uGlowFalloff * abs(sin(p.x * 3.0 + time + fi)));
        color += uGlowColor * glow * uGlowIntensity / (fi * 2.0);
      }
      float center = exp(-2.2 * dot(uv, uv));
      color += centerTone * center;
      float cloud = exp(-1.5 * length(uv + vec2(sin(time * 0.3) * 0.25, cos(time * 0.25) * 0.18)));
      color += cloudTone * cloud;
      float vignette = 1.0 - smoothstep(0.35, 1.45, length(uv));
      color *= mix(1.0 - uVignette, 1.0, vignette);
      color = 1.0 - exp(-color * uBrightness);
      color.b *= uBlueBoost;
      float noise = (layeredGrain(gl_FragCoord.xy) - 0.5) * uGrain;
      fragColor = vec4(clamp(backdrop + color + noise, 0.0, 1.0), 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = name => gl.getUniformLocation(program, name);
  const uniforms = Object.fromEntries([
    "uResolution", "uTime", "uSpeed", "uScale", "uRotation", "uLayers", "uWaveAmplitude",
    "uWaveFrequency", "uWaveSpeed", "uLayerSpeed", "uTwist", "uTwistFrequency", "uTwistSpeed",
    "uLineFrequency", "uLineSpacing", "uLineSharpness", "uGlowFalloff", "uGlowIntensity", "uBrightness",
    "uBlueBoost", "uVignette", "uGrain", "uRotationSpeed", "uLineColor", "uGlowColor"
  ].map(name => [name, uniform(name)]));
  gl.uniform1f(uniforms.uSpeed, settings.speed);
  gl.uniform1f(uniforms.uScale, settings.scale);
  gl.uniform1f(uniforms.uRotation, settings.rotation);
  gl.uniform1f(uniforms.uLayers, settings.layers);
  gl.uniform1f(uniforms.uWaveAmplitude, settings.waveAmplitude);
  gl.uniform1f(uniforms.uWaveFrequency, settings.waveFrequency);
  gl.uniform1f(uniforms.uWaveSpeed, settings.waveSpeed);
  gl.uniform1f(uniforms.uLayerSpeed, settings.layerSpeed);
  gl.uniform1f(uniforms.uTwist, settings.twist);
  gl.uniform1f(uniforms.uTwistFrequency, settings.twistFrequency);
  gl.uniform1f(uniforms.uTwistSpeed, settings.twistSpeed);
  gl.uniform1f(uniforms.uLineFrequency, settings.lineFrequency);
  gl.uniform1f(uniforms.uLineSpacing, settings.lineSpacing);
  gl.uniform1f(uniforms.uLineSharpness, settings.lineSharpness);
  gl.uniform1f(uniforms.uGlowFalloff, settings.glowFalloff);
  gl.uniform1f(uniforms.uGlowIntensity, settings.glowIntensity);
  gl.uniform1f(uniforms.uBrightness, settings.brightness);
  gl.uniform1f(uniforms.uBlueBoost, settings.blueBoost);
  gl.uniform1f(uniforms.uVignette, settings.vignette);
  gl.uniform1f(uniforms.uGrain, settings.grain);
  gl.uniform1f(uniforms.uRotationSpeed, settings.rotationSpeed);
  gl.uniform3fv(uniforms.uLineColor, settings.lineColor);
  gl.uniform3fv(uniforms.uGlowColor, settings.glowColor);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 1;
  let height = 1;
  let start = performance.now();
  const resize = () => {
    const dpr = Math.min(settings.dpr, window.devicePixelRatio || 1);
    width = Math.max(1, Math.floor(window.innerWidth * dpr));
    height = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uResolution, width, height);
  };
  const render = now => {
    gl.uniform1f(uniforms.uTime, reducedMotion ? 0 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reducedMotion) requestAnimationFrame(render);
  };
  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(render);
})();
