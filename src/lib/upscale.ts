/// <reference types="@webgpu/types" />

/** WebGPU is needed for the Anime4K upscaler. */
export const gpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator

// Zero-copy: the decoder frame is sampled as an external texture straight into the CNN input (no CPU readback).
const WGSL = /* wgsl */ `
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var pos = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  var o: V;
  o.p = vec4f(pos[i], 0, 1);
  o.uv = vec2f((pos[i].x + 1) * 0.5, (1 - pos[i].y) * 0.5);
  return o;
}
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: texture_2d<f32>;
@fragment fn fs(v: V) -> @location(0) vec4f { return textureSample(t, s, v.uv); }
@group(0) @binding(1) var ext: texture_external;
@fragment fn fsExt(v: V) -> @location(0) vec4f { return textureSampleBaseClampToEdge(ext, s, v.uv); }`

export type Anime4KMode = 'modeA' | 'modeB' | 'modeC' | 'modeAA' | 'denoise' | 'fast'

export interface UpscaleOptions {
  mode?: Anime4KMode
  onSlow?: (reason?: string) => void
}

/**
 * Anime4K on the GPU: video -> canvas. Supports multiple shader presets (Mode A, Mode B, Mode C, Mode AA, Denoise, Fast).
 * Canvas is sized to the screen (max 2x source), never blindly 4K.
 * Resolves to a stop() function.
 */
export async function startUpscale(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  optionsOrSlow?: (() => void) | UpscaleOptions,
): Promise<() => void> {
  const onSlow = typeof optionsOrSlow === 'function' ? optionsOrSlow : optionsOrSlow?.onSlow
  const mode = typeof optionsOrSlow === 'object' ? optionsOrSlow.mode : 'modeA'

  if (!gpuSupported) throw new Error('WebGPU is not available in this browser')

  if (!video.videoWidth) {
    await new Promise<void>((r) => {
      const done = () => {
        video.removeEventListener('loadedmetadata', done)
        video.removeEventListener('loadeddata', done)
        video.removeEventListener('canplay', done)
        r()
      }
      video.addEventListener('loadedmetadata', done)
      video.addEventListener('loadeddata', done)
      video.addEventListener('canplay', done)
      setTimeout(done, 1500)
    })
  }

  const w = video.videoWidth || 1920
  const h = video.videoHeight || 1080
  if (h >= 1440 || w >= 2560) throw new Error('Source is already high resolution (1440p+)')

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('No GPU adapter found')
  const device = await adapter.requestDevice()
  const { ModeA, ModeB, ModeC, ModeAA, DenoiseCNNx2VL, CNNx2M } = await import('anime4k-webgpu')

  // Screen-conscious scaling: scale up to 2× source resolution to fit screen
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const k = Math.max(1, Math.min(2, (screen.width * dpr) / w, (screen.height * dpr) / h))
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  const ctx = canvas.getContext('webgpu')
  if (!ctx) throw new Error('Could not open a WebGPU canvas')
  const format = navigator.gpu.getPreferredCanvasFormat()
  ctx.configure({ device, format, alphaMode: 'opaque' })

  const input = device.createTexture({
    size: [w, h],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  })

  const dims = {
    nativeDimensions: { width: w, height: h },
    targetDimensions: { width: canvas.width, height: canvas.height },
  }

  let preset: any
  switch (mode) {
    case 'modeB':
      preset = new ModeB({ device, inputTexture: input, ...dims })
      break
    case 'modeC':
      preset = new ModeC({ device, inputTexture: input, ...dims })
      break
    case 'modeAA':
      preset = new ModeAA({ device, inputTexture: input, ...dims })
      break
    case 'denoise':
      preset = new DenoiseCNNx2VL({ device, inputTexture: input })
      break
    case 'fast':
      preset = new CNNx2M({ device, inputTexture: input })
      break
    case 'modeA':
    default:
      preset = new ModeA({ device, inputTexture: input, ...dims })
      break
  }

  const module = device.createShaderModule({ code: WGSL })
  const mk = (fs: string, f: GPUTextureFormat) =>
    device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: fs, targets: [{ format: f }] },
      primitive: { topology: 'triangle-list' },
    })
  const load = mk('fsExt', 'rgba16float')
  const pipe = mk('fs', format)
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' })
  const bind = device.createBindGroup({
    layout: pipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: preset.getOutputTexture().createView() },
    ],
  })
  const inView = input.createView()

  let alive = true
  let cb = 0
  let inFlight = 0

  device.lost?.then((info) => {
    if (alive) {
      alive = false
      onSlow?.(info.message || 'GPU device lost')
    }
  })

  const draw = () => {
    if (!alive || video.readyState < 2) return
    // Allow pipelining (up to 2 command buffers in flight) so GPU never starves, but prevent memory backlog
    if (inFlight >= 2) return

    inFlight++
    try {
      const enc = device.createCommandEncoder()
      const up = enc.beginRenderPass({ colorAttachments: [{ view: inView, loadOp: 'clear', storeOp: 'store' }] })
      up.setPipeline(load)
      up.setBindGroup(
        0,
        device.createBindGroup({
          layout: load.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: device.importExternalTexture({ source: video }) },
          ],
        }),
      )
      up.draw(3)
      up.end()

      preset.pass(enc)

      const rp = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }],
      })
      rp.setPipeline(pipe)
      rp.setBindGroup(0, bind)
      rp.draw(3)
      rp.end()

      device.queue.submit([enc.finish()])
      device.queue
        .onSubmittedWorkDone()
        .then(() => {
          inFlight = Math.max(0, inFlight - 1)
        })
        .catch(() => {
          inFlight = Math.max(0, inFlight - 1)
        })
    } catch {
      inFlight = Math.max(0, inFlight - 1)
    }
  }

  // Redraws on every presented frame (also after seeks while paused); rAF is the fallback.
  const loop = () => {
    draw()
    if (alive) {
      cb = video.requestVideoFrameCallback
        ? video.requestVideoFrameCallback(loop)
        : requestAnimationFrame(loop)
    }
  }
  loop()

  return () => {
    alive = false
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(cb)
    else cancelAnimationFrame(cb)
    try {
      device.destroy()
    } catch {}
  }
}
