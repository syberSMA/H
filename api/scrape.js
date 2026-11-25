const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url || (req.body && req.body.url);
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parameter URL wajib diisi.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
  } catch (err) {
    return res.status(400).json({ error: 'Format URL tidak valid.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Target server merespons dengan status HTTP ${response.status}`
      });
    }

    const rawHtml = await response.text();
    const $ = cheerio.load(rawHtml);

    // Resolve relative URLs to absolute URLs so live preview & copied design work properly
    const resolveUrl = (rel) => {
      if (!rel) return rel;
      if (rel.startsWith('data:') || rel.startsWith('blob:') || rel.startsWith('javascript:') || rel.startsWith('#')) {
        return rel;
      }
      try {
        return new URL(rel, parsedUrl.href).href;
      } catch {
        return rel;
      }
    };

    $('[src]').each((_, el) => {
      const val = $(el).attr('src');
      $(el).attr('src', resolveUrl(val));
    });

    $('[href]').each((_, el) => {
      const val = $(el).attr('href');
      $(el).attr('href', resolveUrl(val));
    });

    // Extract inline <style> blocks
    let inlineCss = [];
    $('style').each((i, el) => {
      const content = $(el).html();
      if (content && content.trim()) {
        inlineCss.push(`/* === INLINE STYLE #${i + 1} === */\n${content.trim()}`);
      }
    });

    // Extract external stylesheets (<link rel="stylesheet">)
    const stylesheetUrls = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        stylesheetUrls.push(href);
      }
    });

    // Fetch external CSS files in parallel (limit to 12 stylesheets to keep response fast)
    const externalCssResults = await Promise.allSettled(
      stylesheetUrls.slice(0, 12).map(async (cssUrl) => {
        const cssRes = await fetch(cssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!cssRes.ok) throw new Error(`HTTP ${cssRes.status}`);
        let cssText = await cssRes.text();
        // Rewrite relative url(...) inside CSS to absolute URLs
        cssText = cssText.replace(/url\((['"]?)(?!data:|http:|https:|\/\/)([^)'"]+)\1\)/gi, (match, quote, relPath) => {
          try {
            const abs = new URL(relPath.trim(), cssUrl).href;
            return `url(${quote}${abs}${quote})`;
          } catch {
            return match;
          }
        });
        return { url: cssUrl, css: cssText };
      })
    );

    let externalCss = [];
    const fetchedSheets = [];
    externalCssResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        fetchedSheets.push(result.value);
        externalCss.push(`/* === EXTERNAL CSS: ${result.value.url} === */\n${result.value.css}`);
      }
    });

    // Extract scripts list
    const scripts = [];
    $('script[src]').each((_, el) => {
      scripts.push($(el).attr('src'));
    });

    // Extract meta & page title
    const pageTitle = $('title').text().trim() || parsedUrl.hostname;
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    // Build combined CSS
    const combinedCss = [...externalCss, ...inlineCss].join('\n\n');

    // Build clean HTML with resolved URLs
    const resolvedHtml = $.html();

    // Build Single-File Standalone HTML (HTML + All External CSS inlined into <style>)
    const $standalone = cheerio.load(resolvedHtml);
    $standalone('link[rel="stylesheet"]').remove();
    if (combinedCss.trim()) {
      $standalone('head').append(`\n<style id="extracted-full-css">\n${combinedCss}\n</style>\n`);
    }
    const singleFileHtml = $standalone.html();

    return res.status(200).json({
      success: true,
      url: parsedUrl.href,
      domain: parsedUrl.hostname,
      title: pageTitle,
      description: metaDescription,
      stats: {
        htmlBytes: Buffer.byteLength(resolvedHtml, 'utf8'),
        cssBytes: Buffer.byteLength(combinedCss, 'utf8'),
        externalSheetsCount: fetchedSheets.length,
        inlineStylesCount: inlineCss.length,
        scriptsCount: scripts.length
      },
      html: resolvedHtml,
      css: combinedCss,
      singleFileHtml: singleFileHtml,
      stylesheets: fetchedSheets.map(s => s.url),
      scripts: scripts
    });
  } catch (err) {
    return res.status(500).json({
      error: err.name === 'AbortError'
        ? 'Request timeout (target terlalu lama merespons).'
        : `Gagal mengambil source code: ${err.message}`
    });
  }
};
