import {encode} from 'jpeg-js';
import PNG from 'png-js';

const DEFAULT_QUALITY = 50;

/*
 * Replaces the `png-to-jpeg` package, whose fork this project depended on no
 * longer exists on GitHub. It was a thin wrapper over exactly these two
 * libraries, so this is the same decode-then-encode with the same defaults,
 * minus a dependency that cannot be installed.
 */
export default async function pngToJpeg(
  data: Uint8Array,
  quality = DEFAULT_QUALITY,
): Promise<Buffer> {
  const png = new PNG(data);
  const pixels = await new Promise<Uint8Array>((resolve) => {
    png.decode(resolve);
  });
  return encode({data: pixels, width: png.width, height: png.height}, quality)
    .data;
}
