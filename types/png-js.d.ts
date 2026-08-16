/*
 * No types ship with png-js, and it has no @types package. Only the decoding half is
 * declared here — `src/tileSources/pngToJpeg.ts` is the single caller, and it
 * needs the dimensions plus one callback-style decode.
 */
declare module 'png-js' {
  class PNG {
    constructor(data: Uint8Array);

    readonly width: number;

    readonly height: number;

    /*
     * Callback-style, and deliberately not error-first: png-js throws
     * synchronously out of the constructor on a malformed file rather than
     * reporting it here. The pixels are RGBA, four bytes per pixel, which is
     * the layout jpeg-js encodes from.
     */
    decode(callback: (pixels: Uint8Array) => void): void;
  }

  export default PNG;
}
