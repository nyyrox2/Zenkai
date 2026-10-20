/// <reference types="vite/client" />

declare module 'hls.js' {
  class Hls {
    constructor(config?: any)
    static isSupported(): boolean
    static Events: Record<string, string>
    static ErrorTypes: Record<string, string>
    loadSource(url: string): void
    attachMedia(media: HTMLMediaElement): void
    destroy(): void
    on(event: string, callback: (...args: any[]) => void): void
    startLoad(): void
    recoverMediaError(): void
    audioTrack: number
    autoLevelCapping: number
    [key: string]: any
  }
  export default Hls
}
