type RequestLike = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  setHeader: (name: string, value: string) => ResponseLike;
  end: (body?: string | Uint8Array) => void;
};

const FILE_PATH = /^\/v1\/files\/file_[A-Za-z0-9_-]+(?:\/content)?$/;

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response: ResponseLike, status: number, body: object) {
  response.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
}

/**
 * Narrow same-origin proxy for Files API reads. Anthropic's Files endpoints do
 * not answer browser CORS preflights, while the rest of Darkwords intentionally
 * talks to the Messages API directly from the browser.
 */
export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const requestUrl = new URL(request.url ?? '/', 'https://darkwords.local');
  const upstreamPath = requestUrl.pathname.replace(/^\/api\/anthropic/, '');
  if (!FILE_PATH.test(upstreamPath) || requestUrl.searchParams.get('beta') !== 'true') {
    sendJson(response, 404, { error: 'Unsupported Anthropic API path' });
    return;
  }

  const apiKey = headerValue(request.headers['x-api-key']);
  if (!apiKey) {
    sendJson(response, 401, { error: 'Missing Anthropic API key' });
    return;
  }

  const upstream = await fetch(`https://api.anthropic.com${upstreamPath}?beta=true`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': headerValue(request.headers['anthropic-version']) ?? '2023-06-01',
      'anthropic-beta': headerValue(request.headers['anthropic-beta']) ?? 'files-api-2025-04-14',
      Accept: headerValue(request.headers.accept) ?? '*/*',
    },
  });

  response.status(upstream.status);
  response.setHeader('Cache-Control', 'private, no-store');
  const contentType = upstream.headers.get('content-type');
  const contentDisposition = upstream.headers.get('content-disposition');
  if (contentType) response.setHeader('Content-Type', contentType);
  if (contentDisposition) response.setHeader('Content-Disposition', contentDisposition);

  response.end(new Uint8Array(await upstream.arrayBuffer()));
}
