/**
 * WebGL Compositor for GPU-Accelerated Video Rendering
 * Uses WebGL2 for hardware-accelerated compositing with shader-based effects
 * Similar to CapCut's rendering engine
 */

export interface WebGLLayer {
  id: string;
  type: 'video' | 'image' | 'text';
  frame: ImageBitmap | VideoFrame | HTMLImageElement | null;
  startTime: number;
  duration: number;
  zIndex: number;

  // Visual properties
  position?: { x: number; y: number; width: number; height: number };
  opacity?: number;

  // Text properties (rendered to texture first)
  text?: {
    content: string;
    fontSize: number;
    color: string;
    position: { x: number; y: number };
    fontFamily?: string;
  };

  // Effects (GPU-accelerated via shaders)
  effects?: {
    blur?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number;
  };

  // Transition properties (within single layer - fade in/out)
  transition?: {
    type: 'fade' | 'dissolve' | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'wipeDown';
    duration: number;
  };

  // Cross-layer transition (blend with another layer)
  crossTransition?: {
    type: string; // fade, dissolve, wipeleft, wiperight, wipeup, wipedown, fadeblack, fadewhite, slideleft, slideright
    progress: number; // 0-1, how far through the transition
    otherLayerId: string; // The layer to blend with
    isSource: boolean; // true = this is the outgoing layer, false = incoming
  };
}

export interface WebGLCompositorConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor?: string;
}

/**
 * WebGL2-based compositor for professional video editing
 */
export class WebGLCompositor {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGL2RenderingContext;
  private config: WebGLCompositorConfig;

  // Shader programs
  private basicProgram: WebGLProgram | null = null;
  private effectsProgram: WebGLProgram | null = null;
  private transitionProgram: WebGLProgram | null = null;

  // WebGL resources
  private textures: Map<string, WebGLTexture> = new Map();
  private framebuffer: WebGLFramebuffer | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private textureBuffer: WebGLBuffer | null = null;

  // Layer management
  private layers: Map<string, WebGLLayer> = new Map();
  private sortedLayersCache: WebGLLayer[] | null = null;
  private lastUploadedFrames: Map<string, ImageBitmap | VideoFrame | HTMLImageElement | null> = new Map();

  // Animation
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private lastRenderTime: number = 0;
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private frameInterval: number;
  private onTimeUpdate?: (time: number) => void;
  private layerProvider?: (time: number) => WebGLLayer[]; // Called before each render

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, config: WebGLCompositorConfig) {
    this.canvas = canvas;
    this.config = config;
    this.frameInterval = 1000 / config.fps;

    // Set canvas dimensions
    this.canvas.width = config.width;
    this.canvas.height = config.height;

    // Initialize WebGL2 context
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;

    // Initialize shaders and buffers
    this.initializeShaders();
    this.initializeBuffers();

    // Set viewport
    gl.viewport(0, 0, config.width, config.height);
  }

  /**
   * Initialize shader programs
   */
  private initializeShaders(): void {
    const gl = this.gl;

    // Basic vertex shader (used by all programs)
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;

      uniform mat4 u_matrix;

      void main() {
        gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Basic fragment shader (for simple rendering)
    const basicFragmentShaderSource = `#version 300 es
      precision highp float;

      in vec2 v_texCoord;
      out vec4 outColor;

      uniform sampler2D u_texture;
      uniform float u_opacity;

      void main() {
        vec4 color = texture(u_texture, v_texCoord);
        outColor = vec4(color.rgb, color.a * u_opacity);
      }
    `;

    // Effects fragment shader (with blur, brightness, contrast, etc.)
    const effectsFragmentShaderSource = `#version 300 es
      precision highp float;

      in vec2 v_texCoord;
      out vec4 outColor;

      uniform sampler2D u_texture;
      uniform float u_opacity;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_hue;
      uniform float u_blur;

      // Convert RGB to HSL
      vec3 rgb2hsl(vec3 color) {
        float maxC = max(max(color.r, color.g), color.b);
        float minC = min(min(color.r, color.g), color.b);
        float delta = maxC - minC;

        float h = 0.0;
        float s = 0.0;
        float l = (maxC + minC) / 2.0;

        if (delta > 0.0) {
          s = l < 0.5 ? delta / (maxC + minC) : delta / (2.0 - maxC - minC);

          if (color.r == maxC) {
            h = (color.g - color.b) / delta + (color.g < color.b ? 6.0 : 0.0);
          } else if (color.g == maxC) {
            h = (color.b - color.r) / delta + 2.0;
          } else {
            h = (color.r - color.g) / delta + 4.0;
          }
          h /= 6.0;
        }

        return vec3(h, s, l);
      }

      // Convert HSL to RGB
      vec3 hsl2rgb(vec3 hsl) {
        float h = hsl.x;
        float s = hsl.y;
        float l = hsl.z;

        float c = (1.0 - abs(2.0 * l - 1.0)) * s;
        float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
        float m = l - c / 2.0;

        vec3 rgb;
        if (h < 1.0/6.0) {
          rgb = vec3(c, x, 0.0);
        } else if (h < 2.0/6.0) {
          rgb = vec3(x, c, 0.0);
        } else if (h < 3.0/6.0) {
          rgb = vec3(0.0, c, x);
        } else if (h < 4.0/6.0) {
          rgb = vec3(0.0, x, c);
        } else if (h < 5.0/6.0) {
          rgb = vec3(x, 0.0, c);
        } else {
          rgb = vec3(c, 0.0, x);
        }

        return rgb + m;
      }

      void main() {
        vec4 color = texture(u_texture, v_texCoord);

        // Apply brightness
        color.rgb += u_brightness;

        // Apply contrast
        color.rgb = ((color.rgb - 0.5) * u_contrast) + 0.5;

        // Apply saturation and hue
        vec3 hsl = rgb2hsl(color.rgb);
        hsl.x = mod(hsl.x + u_hue, 1.0);
        hsl.y *= u_saturation;
        color.rgb = hsl2rgb(hsl);

        // Simple box blur (if needed, sample neighboring pixels)
        // For performance, we skip blur in this version

        // Apply opacity
        outColor = vec4(color.rgb, color.a * u_opacity);
      }
    `;

    // Transition fragment shader - blends two textures with various transition effects
    const transitionFragmentShaderSource = `#version 300 es
      precision highp float;

      in vec2 v_texCoord;
      out vec4 outColor;

      uniform sampler2D u_textureFrom;  // Outgoing clip
      uniform sampler2D u_textureTo;    // Incoming clip  
      uniform float u_progress;          // 0-1 transition progress
      uniform int u_transitionType;      // 0=fade, 1=dissolve, 2=wipeLeft, 3=wipeRight, 4=wipeUp, 5=wipeDown, 6=fadeBlack, 7=fadeWhite, 8=slideLeft, 9=slideRight
      uniform float u_opacity;

      // Simple hash for dissolve effect
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec4 colorFrom = texture(u_textureFrom, v_texCoord);
        vec4 colorTo = texture(u_textureTo, v_texCoord);
        
        float mixFactor = u_progress;
        vec4 color;
        
        if (u_transitionType == 0) {
          // Fade: simple linear blend
          color = mix(colorFrom, colorTo, u_progress);
        } else if (u_transitionType == 1) {
          // Dissolve: random pixel threshold
          float threshold = hash(v_texCoord * 100.0);
          mixFactor = step(threshold, u_progress);
          color = mix(colorFrom, colorTo, mixFactor);
        } else if (u_transitionType == 2) {
          // Wipe Left: reveal from right
          mixFactor = step(1.0 - v_texCoord.x, u_progress);
          color = mix(colorFrom, colorTo, mixFactor);
        } else if (u_transitionType == 3) {
          // Wipe Right: reveal from left  
          mixFactor = step(v_texCoord.x, u_progress);
          color = mix(colorFrom, colorTo, mixFactor);
        } else if (u_transitionType == 4) {
          // Wipe Up: reveal from bottom
          mixFactor = step(1.0 - v_texCoord.y, u_progress);
          color = mix(colorFrom, colorTo, mixFactor);
        } else if (u_transitionType == 5) {
          // Wipe Down: reveal from top
          mixFactor = step(v_texCoord.y, u_progress);
          color = mix(colorFrom, colorTo, mixFactor);
        } else if (u_transitionType == 6) {
          // Fade Black: fade out to black, then fade in from black
          vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
          if (u_progress < 0.5) {
            color = mix(colorFrom, black, u_progress * 2.0);
          } else {
            color = mix(black, colorTo, (u_progress - 0.5) * 2.0);
          }
        } else if (u_transitionType == 7) {
          // Fade White: fade out to white, then fade in from white
          vec4 white = vec4(1.0, 1.0, 1.0, 1.0);
          if (u_progress < 0.5) {
            color = mix(colorFrom, white, u_progress * 2.0);
          } else {
            color = mix(white, colorTo, (u_progress - 0.5) * 2.0);
          }
        } else if (u_transitionType == 8) {
          // Slide Left: new clip slides in from the right
          float slidePos = 1.0 - u_progress;
          vec2 fromCoord = v_texCoord + vec2(u_progress, 0.0);
          vec2 toCoord = v_texCoord - vec2(slidePos, 0.0);
          if (v_texCoord.x < u_progress) {
            color = texture(u_textureTo, toCoord + vec2(1.0, 0.0));
          } else {
            color = texture(u_textureFrom, fromCoord - vec2(1.0, 0.0));
          }
        } else if (u_transitionType == 9) {
          // Slide Right: new clip slides in from the left
          float slidePos = 1.0 - u_progress;
          if (v_texCoord.x > slidePos) {
            vec2 toCoord = v_texCoord - vec2(slidePos, 0.0);
            color = texture(u_textureTo, toCoord);
          } else {
            vec2 fromCoord = v_texCoord + vec2(u_progress, 0.0);
            color = texture(u_textureFrom, fromCoord);
          }
        } else if (u_transitionType == 10) {
          // Slide Up: new clip slides in from the bottom
          float slidePos = 1.0 - u_progress;
          if (v_texCoord.y > slidePos) {
            vec2 toCoord = v_texCoord - vec2(0.0, slidePos);
            color = texture(u_textureTo, toCoord);
          } else {
            vec2 fromCoord = v_texCoord + vec2(0.0, u_progress);
            color = texture(u_textureFrom, fromCoord);
          }
        } else if (u_transitionType == 11) {
          // Slide Down: new clip slides in from the top
          if (v_texCoord.y < u_progress) {
            vec2 toCoord = v_texCoord + vec2(0.0, 1.0 - u_progress);
            color = texture(u_textureTo, toCoord);
          } else {
            vec2 fromCoord = v_texCoord - vec2(0.0, u_progress);
            color = texture(u_textureFrom, fromCoord);
          }
        } else {
          // Default: simple fade
          color = mix(colorFrom, colorTo, u_progress);
        }
        
        outColor = vec4(color.rgb, color.a * u_opacity);
      }
    `;

    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const basicFragmentShader = this.compileShader(gl.FRAGMENT_SHADER, basicFragmentShaderSource);
    const effectsFragmentShader = this.compileShader(gl.FRAGMENT_SHADER, effectsFragmentShaderSource);
    const transitionFragmentShader = this.compileShader(gl.FRAGMENT_SHADER, transitionFragmentShaderSource);

    if (!vertexShader || !basicFragmentShader || !effectsFragmentShader || !transitionFragmentShader) {
      throw new Error('Failed to compile shaders');
    }

    // Create programs
    this.basicProgram = this.createProgram(vertexShader, basicFragmentShader);
    this.effectsProgram = this.createProgram(vertexShader, effectsFragmentShader);
    this.transitionProgram = this.createProgram(vertexShader, transitionFragmentShader);

    if (!this.basicProgram || !this.effectsProgram || !this.transitionProgram) {
      throw new Error('Failed to create shader programs');
    }
  }

  /**
   * Compile a shader
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create a shader program
   */
  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  /**
   * Initialize geometry buffers
   */
  private initializeBuffers(): void {
    const gl = this.gl;

    // Create vertex buffer (quad)
    const vertices = new Float32Array([
      -1, -1,  // bottom-left
       1, -1,  // bottom-right
      -1,  1,  // top-left
       1,  1,  // top-right
    ]);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create texture coordinate buffer
    const texCoords = new Float32Array([
      0, 1,  // bottom-left
      1, 1,  // bottom-right
      0, 0,  // top-left
      1, 0,  // top-right
    ]);

    this.textureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  /**
   * Update layers
   */
  setLayers(layers: WebGLLayer[], renderImmediately = true): void {
    this.layers.clear();
    layers.forEach(layer => this.layers.set(layer.id, layer));
    this.sortedLayersCache = null;

    // Only render immediately if not playing (avoid double renders with animate loop)
    // When playing, the animate() loop handles rendering
    if (renderImmediately && !this.isPlaying) {
      this.renderFrame();
    }
  }

  /**
   * Get sorted layers by z-index
   */
  private getSortedLayers(): WebGLLayer[] {
    if (!this.sortedLayersCache) {
      this.sortedLayersCache = Array.from(this.layers.values())
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    }
    return this.sortedLayersCache;
  }

  /**
   * Check if layer is active
   */
  private isLayerActive(layer: WebGLLayer): boolean {
    const endTime = layer.startTime + layer.duration;
    return this.currentTime >= layer.startTime && this.currentTime < endTime;
  }

  /**
   * Calculate transition opacity
   */
  private getTransitionOpacity(layer: WebGLLayer): number {
    if (!layer.transition) return 1;

    const timeInLayer = this.currentTime - layer.startTime;
    const transitionDuration = layer.transition.duration;

    // Fade in
    if (timeInLayer < transitionDuration) {
      return timeInLayer / transitionDuration;
    }

    // Fade out
    const timeUntilEnd = layer.duration - timeInLayer;
    if (timeUntilEnd < transitionDuration) {
      return timeUntilEnd / transitionDuration;
    }

    return 1;
  }

  /**
   * Render a single frame
   */
  private renderFrame(): void {
    const gl = this.gl;

    // Clear canvas
    const bgColor = this.config.backgroundColor || '#000000';
    const r = parseInt(bgColor.slice(1, 3), 16) / 255;
    const g = parseInt(bgColor.slice(3, 5), 16) / 255;
    const b = parseInt(bgColor.slice(5, 7), 16) / 255;
    gl.clearColor(r, g, b, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Get active layers
    const sortedLayers = this.getSortedLayers();
    const activeLayers = sortedLayers.filter(layer => this.isLayerActive(layer));

    // Track which layers have been rendered via transition (to skip duplicate rendering)
    const renderedViaTransition = new Set<string>();

    // Find and render cross-layer transitions first
    for (const layer of activeLayers) {
      if ((layer.type === 'video' || layer.type === 'image') && 
          layer.crossTransition && 
          layer.crossTransition.isSource && 
          !renderedViaTransition.has(layer.id)) {
        // Find the other layer in the transition
        const otherLayer = activeLayers.find(l => l.id === layer.crossTransition!.otherLayerId);
        if (otherLayer && otherLayer.frame) {
          this.renderTransition(layer, otherLayer, layer.crossTransition);
          renderedViaTransition.add(layer.id);
          renderedViaTransition.add(otherLayer.id);
        }
      }
    }

    // Render remaining layers normally
    for (const layer of activeLayers) {
      if ((layer.type === 'video' || layer.type === 'image') && 
          !renderedViaTransition.has(layer.id)) {
        this.renderLayer(layer);
      }
    }
  }

  /**
   * Get transition type enum value for shader
   */
  private getTransitionTypeValue(type: string): number {
    // Normalize type to handle both camelCase and lowercase
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'fade': return 0;
      case 'dissolve': return 1;
      case 'wipeleft': return 2;
      case 'wiperight': return 3;
      case 'wipeup': return 4;
      case 'wipedown': return 5;
      case 'fadeblack': return 6;
      case 'fadewhite': return 7;
      case 'slideleft': return 8;
      case 'slideright': return 9;
      case 'slideup': return 10;
      case 'slidedown': return 11;
      default: return 0; // Default to fade
    }
  }

  /**
   * Render a cross-layer transition using the transition shader
   */
  private renderTransition(
    fromLayer: WebGLLayer, 
    toLayer: WebGLLayer, 
    transition: NonNullable<WebGLLayer['crossTransition']>
  ): void {
    const gl = this.gl;
    if (!fromLayer.frame || !toLayer.frame || !this.transitionProgram) return;

    gl.useProgram(this.transitionProgram);

    // Setup textures for both layers
    // Texture unit 0: From layer (outgoing)
    let fromTexture = this.textures.get(fromLayer.id);
    if (!fromTexture) {
      const newTexture = gl.createTexture();
      if (!newTexture) return;
      fromTexture = newTexture;
      this.textures.set(fromLayer.id, fromTexture);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fromTexture);
    const lastFromFrame = this.lastUploadedFrames.get(fromLayer.id);
    if (fromLayer.frame !== lastFromFrame) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fromLayer.frame);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.lastUploadedFrames.set(fromLayer.id, fromLayer.frame);
    }

    // Texture unit 1: To layer (incoming)
    let toTexture = this.textures.get(toLayer.id);
    if (!toTexture) {
      const newTexture = gl.createTexture();
      if (!newTexture) return;
      toTexture = newTexture;
      this.textures.set(toLayer.id, toTexture);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, toTexture);
    const lastToFrame = this.lastUploadedFrames.get(toLayer.id);
    if (toLayer.frame !== lastToFrame) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, toLayer.frame);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.lastUploadedFrames.set(toLayer.id, toLayer.frame);
    }

    // Set uniforms
    const textureFromLoc = gl.getUniformLocation(this.transitionProgram, 'u_textureFrom');
    gl.uniform1i(textureFromLoc, 0);
    
    const textureToLoc = gl.getUniformLocation(this.transitionProgram, 'u_textureTo');
    gl.uniform1i(textureToLoc, 1);

    const progressLoc = gl.getUniformLocation(this.transitionProgram, 'u_progress');
    gl.uniform1f(progressLoc, transition.progress);

    const typeLoc = gl.getUniformLocation(this.transitionProgram, 'u_transitionType');
    gl.uniform1i(typeLoc, this.getTransitionTypeValue(transition.type));

    const opacityLoc = gl.getUniformLocation(this.transitionProgram, 'u_opacity');
    gl.uniform1f(opacityLoc, 1.0);

    // Setup vertex positions
    const positionLoc = gl.getAttribLocation(this.transitionProgram, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Setup texture coordinates
    const texCoordLoc = gl.getAttribLocation(this.transitionProgram, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Set transformation matrix (use full canvas for transitions)
    const matrixLoc = gl.getUniformLocation(this.transitionProgram, 'u_matrix');
    const matrix = this.createTransformMatrix(fromLayer); // Use from layer's position
    gl.uniformMatrix4fv(matrixLoc, false, matrix);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // Reset to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * Render a single layer
   */
  private renderLayer(layer: WebGLLayer): void {
    const gl = this.gl;
    if (!layer.frame) return;

    // Choose program based on whether effects are needed
    const hasEffects = layer.effects && Object.values(layer.effects).some(v => v !== undefined && v !== 1);
    const program = hasEffects ? this.effectsProgram : this.basicProgram;
    if (!program) return;

    gl.useProgram(program);

    // Create or update texture
    let texture = this.textures.get(layer.id);
    if (!texture) {
      const newTexture = gl.createTexture();
      if (!newTexture) return;
      texture = newTexture;
      this.textures.set(layer.id, texture);
    }

    // Upload frame to texture only if frame changed (prevents GPU stalls)
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const lastFrame = this.lastUploadedFrames.get(layer.id);
    if (layer.frame !== lastFrame) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.frame);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.lastUploadedFrames.set(layer.id, layer.frame);
    }

    // Setup vertex positions
    const positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Setup texture coordinates
    const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Set transformation matrix (for positioning/scaling)
    const matrixLoc = gl.getUniformLocation(program, 'u_matrix');
    const matrix = this.createTransformMatrix(layer);
    gl.uniformMatrix4fv(matrixLoc, false, matrix);

    // Set opacity
    const opacity = (layer.opacity ?? 1) * this.getTransitionOpacity(layer);
    const opacityLoc = gl.getUniformLocation(program, 'u_opacity');
    gl.uniform1f(opacityLoc, opacity);

    // Set effects if using effects program
    if (hasEffects && layer.effects) {
      const brightnessLoc = gl.getUniformLocation(program, 'u_brightness');
      gl.uniform1f(brightnessLoc, layer.effects.brightness ?? 0);

      const contrastLoc = gl.getUniformLocation(program, 'u_contrast');
      gl.uniform1f(contrastLoc, layer.effects.contrast ?? 1);

      const saturationLoc = gl.getUniformLocation(program, 'u_saturation');
      gl.uniform1f(saturationLoc, layer.effects.saturation ?? 1);

      const hueLoc = gl.getUniformLocation(program, 'u_hue');
      gl.uniform1f(hueLoc, layer.effects.hue ?? 0);
    }

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Create transformation matrix for layer positioning
   */
  private createTransformMatrix(layer: WebGLLayer): Float32Array {
    const pos = layer.position || {
      x: 0,
      y: 0,
      width: this.config.width,
      height: this.config.height,
    };

    // Convert to normalized device coordinates (-1 to 1)
    const x = (pos.x / this.config.width) * 2 - 1;
    const y = -((pos.y / this.config.height) * 2 - 1); // Flip Y
    const w = (pos.width / this.config.width) * 2;
    const h = (pos.height / this.config.height) * 2;

    // Create scale and translation matrix
    return new Float32Array([
      w/2,   0,    0,  0,
      0,    h/2,   0,  0,
      0,     0,    1,  0,
      x+w/2, y-h/2, 0,  1,
    ]);
  }

  /**
   * Animation loop
   */
  private animate = (timestamp: number): void => {
    if (!this.isPlaying) {
      console.warn('[WebGLCompositor] animate called but isPlaying=false');
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);

    if (document.hidden) {
      console.warn('[WebGLCompositor] animate skipped - document hidden');
      return;
    }

    const timeSinceLastRender = timestamp - this.lastRenderTime;
    if (timeSinceLastRender < this.frameInterval) {
      return;
    }

    const deltaTime = this.lastFrameTime ? (timestamp - this.lastFrameTime) / 1000 : 0;
    this.lastFrameTime = timestamp;
    this.lastRenderTime = timestamp - (timeSinceLastRender % this.frameInterval);

    if (deltaTime > 0) {
      this.currentTime += deltaTime;
    }

    // Log every ~1 second (30 frames at 30fps)
    if (Math.floor(this.currentTime * 30) % 30 === 0) {
      console.log(`[WebGLCompositor] animate: time=${this.currentTime.toFixed(2)}s, hasLayerProvider=${!!this.layerProvider}`);
    }

    // Get fresh layers from provider BEFORE rendering (synchronous)
    if (this.layerProvider) {
      const freshLayers = this.layerProvider(this.currentTime);
      this.setLayers(freshLayers, false);
    }

    // Render the frame
    this.renderFrame();

    // Notify time update AFTER render
    this.onTimeUpdate?.(this.currentTime);
  };

  /**
   * Start playback
   */
  play(): void {
    console.log('[WebGLCompositor] play() called, isPlaying=', this.isPlaying, 'hasLayerProvider=', !!this.layerProvider);
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastFrameTime = 0;
    this.lastRenderTime = 0;

    console.log('[WebGLCompositor] Starting animation loop');
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    this.currentTime = Math.max(0, time);
    this.renderFrame();
    this.onTimeUpdate?.(this.currentTime);
  }

  /**
   * Set layer provider callback (called synchronously before each render)
   */
  setLayerProvider(provider: ((time: number) => WebGLLayer[]) | undefined): void {
    this.layerProvider = provider;
  }

  /**
   * Set time update callback
   */
  setOnTimeUpdate(callback: (time: number) => void): void {
    this.onTimeUpdate = callback;
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Get is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.pause();

    const gl = this.gl;

    // Delete textures
    this.textures.forEach(texture => gl.deleteTexture(texture));
    this.textures.clear();

    // Delete buffers
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.textureBuffer) gl.deleteBuffer(this.textureBuffer);

    // Delete programs
    if (this.basicProgram) gl.deleteProgram(this.basicProgram);
    if (this.effectsProgram) gl.deleteProgram(this.effectsProgram);

    this.layers.clear();
  }

  /**
   * Check if WebGL2 is supported
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch {
      return false;
    }
  }
}
