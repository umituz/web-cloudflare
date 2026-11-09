export interface EdgeRouteMeta {
  title?: string;
  description?: string;
  keywords?: string[] | string;
  canonical?: string;
  robots?: string;
  lang?: string;
  og?: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    url?: string;
    siteName?: string;
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    site?: string;
    creator?: string;
  };
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface EdgeSeoConfig {
  routes?: Record<string, EdgeRouteMeta>;
  defaultMeta?: EdgeRouteMeta;
  siteUrl?: string;
}

export function matchRouteMeta(
  pathname: string,
  config: EdgeSeoConfig
): EdgeRouteMeta | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (config.routes && config.routes[normalizedPath]) {
    return { ...config.defaultMeta, ...config.routes[normalizedPath] };
  }
  return config.defaultMeta || null;
}

export function applyEdgeSeo(
  response: Response,
  meta: EdgeRouteMeta,
  options?: { siteUrl?: string; routePath?: string }
): Response {
  if (typeof HTMLRewriter === 'undefined') {
    return response;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const normalizedSiteUrl = (options?.siteUrl || '').replace(/\/$/, '');
  const routePath = options?.routePath || '';
  const canonicalUrl =
    meta.canonical ||
    (normalizedSiteUrl ? `${normalizedSiteUrl}${routePath === '/' ? '' : routePath}` : undefined);

  let rewriter = new HTMLRewriter();

  if (meta.lang) {
    const langValue = meta.lang;
    rewriter = rewriter.on('html', {
      element(e) {
        e.setAttribute('lang', langValue);
      },
    });
  }

  if (meta.title) {
    const titleValue = meta.title;
    rewriter = rewriter.on('title', {
      element(e) {
        e.setInnerContent(titleValue);
      },
    });
  }

  if (meta.description) {
    const descValue = meta.description;
    rewriter = rewriter.on('meta[name="description"]', {
      element(e) {
        e.setAttribute('content', descValue);
      },
    });
  }

  const kw = Array.isArray(meta.keywords) ? meta.keywords.join(', ') : meta.keywords;
  if (kw) {
    rewriter = rewriter.on('meta[name="keywords"]', {
      element(e) {
        e.setAttribute('content', kw);
      },
    });
  }

  if (meta.robots) {
    const robotsValue = meta.robots;
    rewriter = rewriter.on('meta[name="robots"]', {
      element(e) {
        e.setAttribute('content', robotsValue);
      },
    });
  }

  if (canonicalUrl) {
    rewriter = rewriter.on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute('href', canonicalUrl);
      },
    });
  }

  const ogTitle = meta.og?.title || meta.title;
  if (ogTitle) {
    rewriter = rewriter.on('meta[property="og:title"]', {
      element(e) {
        e.setAttribute('content', ogTitle);
      },
    });
  }

  const ogDesc = meta.og?.description || meta.description;
  if (ogDesc) {
    rewriter = rewriter.on('meta[property="og:description"]', {
      element(e) {
        e.setAttribute('content', ogDesc);
      },
    });
  }

  if (meta.og?.image) {
    const ogImg = meta.og.image;
    rewriter = rewriter.on('meta[property="og:image"]', {
      element(e) {
        e.setAttribute('content', ogImg);
      },
    });
  }

  const twTitle = meta.twitter?.title || meta.title;
  if (twTitle) {
    rewriter = rewriter.on('meta[name="twitter:title"]', {
      element(e) {
        e.setAttribute('content', twTitle);
      },
    });
  }

  const twDesc = meta.twitter?.description || meta.description;
  if (twDesc) {
    rewriter = rewriter.on('meta[name="twitter:description"]', {
      element(e) {
        e.setAttribute('content', twDesc);
      },
    });
  }

  const twImage = meta.twitter?.image || meta.og?.image;
  if (twImage) {
    rewriter = rewriter.on('meta[name="twitter:image"]', {
      element(e) {
        e.setAttribute('content', twImage);
      },
    });
  }

  if (meta.jsonLd) {
    const jsonString = JSON.stringify(meta.jsonLd, null, 2);
    rewriter = rewriter.on('head', {
      element(e) {
        e.append(
          `\n    <script type="application/ld+json" data-seo="true">\n${jsonString}\n    </script>\n  `,
          { html: true }
        );
      },
    });
  }

  return rewriter.transform(response);
}
