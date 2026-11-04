import {URL} from 'node:url';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  return false;
}

export async function performWebSearch(query: string, numResults = 5): Promise<SearchResult[]> {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const provider = process.env.SEARCH_PROVIDER || 'duckduckgo';
  const apiKey = process.env.SEARCH_API_KEY;

  if (provider === 'tavily' && apiKey) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({query: trimmed, max_results: numResults, api_key: apiKey}),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data: any = await res.json();
        return (data.results || []).slice(0, numResults).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.content || ''
        }));
      }
    } catch {
      // Fallback
    }
  }

  // Fallback to DuckDuckGo HTML / Instant Answers or public HTML search
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const html = await res.text();
      const results: SearchResult[] = [];
      const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const titleRegex = /<a class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      
      // Extract result blocks
      const blocks = html.split('class="result__body"');
      for (const block of blocks.slice(1, numResults + 1)) {
        const titleMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        if (titleMatch) {
          const rawUrl = titleMatch[1];
          // DuckDuckGo redirect url unwrap: /l/?kh=-1&uddg=https%3A%2F%2Fexample.com
          let targetUrl = rawUrl;
          if (rawUrl.includes('uddg=')) {
            const match = rawUrl.match(/uddg=([^&]+)/);
            if (match) targetUrl = decodeURIComponent(match[1]);
          }
          const cleanTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          const cleanSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
          results.push({title: cleanTitle, url: targetUrl, snippet: cleanSnippet});
        }
      }
      if (results.length > 0) return results.slice(0, numResults);
    }
  } catch (err: any) {
    // If external search network fails, return descriptive empty array
  }

  return [];
}

export function cleanHtmlToMarkdown(html: string): string {
  // 1. Remove script, style, svg, noscript, nav, footer, header tags
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');

  // 2. Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

  // 3. Convert paragraphs, linebreaks and list items
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');

  // 4. Convert links: <a href="url">text</a> -> [text](url)
  text = text.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // 5. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 6. Decode common entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 7. Compress multiple blank lines
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export async function fetchWebContent(targetUrl: string, maxLength = 30000): Promise<{ url: string; content: string; status: number }> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are supported');
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Access to private/local network targets is restricted');
  }

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'SpecboardAgent/1.0 (Mozilla/5.0 Compatible; +https://github.com/specboard)',
      'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(10000)
  });

  const rawText = await response.text();
  const markdown = cleanHtmlToMarkdown(rawText);
  const truncated = markdown.length > maxLength ? markdown.slice(0, maxLength) + '\n\n...[Content truncated]' : markdown;

  return {
    url: targetUrl,
    content: truncated,
    status: response.status
  };
}
