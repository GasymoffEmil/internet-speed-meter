const CHECK_CONNECTION = 'check your internet connection';
const UNRESOLVED_HOST =
  'could not resolve the host name — check the URL and your internet connection';

const EXPLANATIONS = new Map<string, string>([
  ['ENOTFOUND', UNRESOLVED_HOST],
  ['EAI_AGAIN', UNRESOLVED_HOST],
  ['ENETUNREACH', `the network is unreachable — ${CHECK_CONNECTION}`],
  ['EHOSTUNREACH', `the host is unreachable — ${CHECK_CONNECTION}`],
  ['ENETDOWN', `the network is down — ${CHECK_CONNECTION}`],
  ['ETIMEDOUT', `the connection timed out — ${CHECK_CONNECTION}`],
  ['ECONNREFUSED', 'the server refused the connection'],
  ['ECONNRESET', `the connection was lost — ${CHECK_CONNECTION}`],
  ['EPIPE', `the connection was lost — ${CHECK_CONNECTION}`],
  ['UND_ERR_SOCKET', `the connection was lost — ${CHECK_CONNECTION}`],
]);

/**
 * Turns a fetch failure into a human-readable message. fetch reports every network failure as
 * `TypeError: fetch failed` (or `terminated` once the body has started); the actual reason, with
 * a Node or undici error code, is in `cause`.
 */
export function describeNetworkFailure(error: unknown): string {
  const reason = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (!(reason instanceof Error)) {
    return `Network error: ${String(reason)}`;
  }

  const code = 'code' in reason && typeof reason.code === 'string' ? reason.code : '';
  const details = formatDetails(code, reason.message) || reason.name;
  const explanation = EXPLANATIONS.get(code);

  return explanation === undefined
    ? `Network error: ${details}`
    : `Network error: ${explanation} (${details})`;
}

function formatDetails(code: string, message: string): string {
  // Node often repeats the code inside the message ("getaddrinfo ENOTFOUND host").
  if (code === '' || message.includes(code)) {
    return message;
  }
  return message === '' ? code : `${code}: ${message}`;
}
