declare module 'gifenc' {
  export type Palette = number[][]
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean; transparentIndex?: number; dispose?: number; first?: boolean },
    ): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean }): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array
}
