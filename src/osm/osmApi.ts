import {NotFoundError} from '../errors.ts';
import {observeOsmApiQuery} from '../metrics.ts';
import {userAgent} from '../userAgent.ts';

const API_BASE = 'https://api.openstreetmap.org/api/0.6';

/*
 * 404 is a relation id that was never used, 410 one whose relation has since
 * been deleted. Both are the caller naming something OSM cannot return, as
 * opposed to OSM failing, so both become the same error here — the distinction
 * survives in the message rather than the type.
 */
const MISSING_STATUSES = new Map([
  [404, 'was not found'],
  [410, 'has been deleted'],
]);

/*
 * Enough to carry the API's own sentence, short enough that a proxy's HTML
 * error page cannot flood the log line it ends up on.
 */
const MAX_ERROR_DETAIL = 500;

/*
 * Failures arrive as a plain text body, and sometimes in an `Error` response
 * header instead — never as JSON, which is why parsing the body as JSON would
 * leave every failure indistinguishable from every other one. Whitespace is
 * collapsed so a multi-line body stays a single log line.
 *
 * Falling back on emptiness rather than absence: the API answers a deleted
 * relation with an `Error` header that is present but blank, which `??` would
 * take for a message and stop looking.
 */
async function describeFailure(response: Response): Promise<string> {
  const header = response.headers.get('Error')?.trim() ?? '';
  /*
   * Only `text/plain`, which is what the API itself answers with. A path it
   * does not route at all falls through to the Rails frontend and comes back
   * as a full HTML page, and half a kilobyte of markup in the log line says
   * strictly less than the status code does.
   */
  const isPlainText = response.headers
    .get('Content-Type')
    ?.startsWith('text/plain');
  const body = header || !isPlainText ? '' : await response.text();
  const detail = (header || body).replace(/\s+/g, ' ').trim();
  const status = `${response.status} ${response.statusText}`.trim();
  return detail
    ? `Request failed with status ${status} - ${detail.slice(0, MAX_ERROR_DETAIL)}`
    : `Request failed with status ${status}`;
}

/*
 * `kind` is what labels the metric — the path embeds the relation id, so using
 * it would mint a new series per relation downloaded. `subject` is the
 * opposite: it names the specific thing that was missing, and is only ever
 * read by a human.
 */
function osmApiRequest(
  kind: string,
  baseUrl: string,
  path: string,
  subject: string,
): Promise<unknown> {
  return observeOsmApiQuery(kind, async () => {
    const result = await fetch(`${baseUrl}${path}`, {
      /*
       * The editing API serves an anonymous request where Overpass answered it
       * with a 406, but its usage policy asks for an identifying agent and
       * blocks by agent when it has to, so this stays.
       */
      headers: {'User-Agent': userAgent},
    });
    if (!result.ok) {
      const missing = MISSING_STATUSES.get(result.status);
      /*
       * Ahead of `describeFailure`, which would only reach for a message the
       * API does not send for these two: both answer with an empty body and,
       * for 410, an empty `Error` header.
       */
      if (missing) {
        throw new NotFoundError(`${subject} ${missing}`);
      }

      throw new Error(await describeFailure(result));
    }

    return result.json();
  });
}

/*
 * `/full` returns the relation, its member ways, and every node of those ways
 * — precisely what the Overpass `(._;>;)` recursion this replaces produced, in
 * the same OSM JSON shape `osmtogeojson` consumes.
 *
 * Overpass was answering the same query with 504s
 * (`Dispatcher_Client::request_read_and_idx::timeout`): its public instance
 * allows two concurrent slots per IP and the query never got one. The editing
 * API has no such queue, and served the same relation in a third of the time
 * when the two were measured against each other.
 *
 * `baseUrl` is a parameter only so the tests can point it at a local server;
 * every caller takes the default.
 */
export function fetchRelation(
  relationId: number,
  baseUrl: string = API_BASE,
): Promise<unknown> {
  return osmApiRequest(
    'relation',
    baseUrl,
    `/relation/${relationId}/full.json`,
    `Relation ${relationId}`,
  );
}
