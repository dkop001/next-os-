export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    
    // Normalize target URL
    let targetUrl = decodedUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    console.log(`[Reader Proxy] Fetching article: ${targetUrl}`);

    const targetRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!targetRes.ok) {
      throw new Error(`Mainframe link returned status code ${targetRes.status}`);
    }

    const contentType = targetRes.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Requested resource is not an HTML document (Content-Type: ${contentType})`);
    }

    const html = await targetRes.text();

    // 1. Extract Page Title
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>?/gm, '').trim() : 'Cybernetic Intelligence briefing';

    // 2. Heavy HTML stripping to isolate core readability content
    let cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, ''); // strip comments

    // Extract structured readable block elements (h1, h2, h3, p, li)
    const elementRegex = /<(h1|h2|h3|p|li)[\s\S]*?>([\s\S]*?)<\/\1>/gi;
    let match;
    const elements = [];

    while ((match = elementRegex.exec(cleanedHtml)) !== null) {
      const type = match[1].toLowerCase();
      let content = match[2]
        .replace(/<[^>]*>?/gm, '') // strip nested HTML
        .trim();

      // Decode standard HTML entities
      content = content
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"');

      // Filter out empty, trivial or navigation text lines
      if (content.length > 12 && !content.includes('javascript:') && !content.includes('cookie') && content.split(' ').length > 2) {
        elements.push({ type, content });
      }
    }

    // Fallback if structured regex returned too little text
    if (elements.length < 5) {
      const fallbackText = cleanedHtml
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const sentences = fallbackText.split(/(?:\. |\n)+/);
      sentences.forEach(sentence => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length > 35 && cleanSentence.split(' ').length > 4) {
          elements.push({ type: 'p', content: cleanSentence });
        }
      });
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    return res.status(200).json({
      title,
      url: targetUrl,
      elements: elements.slice(0, 150) // Return up to 150 readable blocks
    });

  } catch (err) {
    console.error(`[Reader API Error] Target ${url}:`, err);
    return res.status(500).json({ 
      error: `Proxy Uplink Connection Failed: ${err.message}` 
    });
  }
}
