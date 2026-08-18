/*
 * Its own module rather than living beside the code that throws it: the OSM
 * client raises this, and `metrics.ts` reads it to tell a mistyped relation id
 * apart from the API failing — so keeping the class here is what stops those
 * two from forming an import cycle.
 *
 * `name` is assigned as a field so it survives into logs, where the class name
 * alone would not appear.
 *
 * Ported from ATGardner/OSMExport, which reached the same shape first.
 */

/*
 * The requested relation is not something OSM can hand back — it never
 * existed, or it has been deleted.
 */
export class NotFoundError extends Error {
  name = 'NotFoundError';
}
