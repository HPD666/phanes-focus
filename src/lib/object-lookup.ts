/**
 * PHANES OBJECT WEB LOOKUP
 * ------------------------
 * Real product/object enrichment using free, keyless web APIs.
 *
 * When COCO-SSD identifies an object (e.g. "chair", "bottle", "laptop"),
 * this module searches DuckDuckGo's Instant Answer API to find:
 *   - Real description of the object type
 *   - Real source URL (Wikipedia, product pages, etc.)
 *   - Real price when available from shopping results
 *
 * Everything is free forever — DuckDuckGo's API requires no key.
 */

export interface WebEnrichment {
  label: string;
  description: string | null;
  price: string | null;
  url: string | null;
  imageUrl: string | null;
  source: string | null;
}

/**
 * Enrich a detected object label with real web data.
 * Returns null only if the network is completely unavailable.
 */
export async function lookupObjectWeb(
  label: string,
): Promise<WebEnrichment> {
  const enriched = await duckDuckGoLookup(label);
  return enriched ?? {
    label,
    description: null,
    price: null,
    url: null,
    imageUrl: null,
    source: null,
  };
}

/**
 * DuckDuckGo Instant Answer API — free, no key required.
 * Returns structured data about a topic when available.
 */
async function duckDuckGoLookup(
  query: string,
): Promise<WebEnrichment | null> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    const abstract = data.AbstractText ?? "";
    const abstractUrl = data.AbstractURL ?? null;
    const heading = data.Heading ?? query;
    const image = data.Image ?? null;

    // Try to get shopping results for price info
    let price: string | null = null;
    const results: unknown[] = data.Results ?? [];
    for (const r of results) {
      if (typeof r === "object" && r !== null) {
        const result = r as Record<string, unknown>;
        const text = String(result.Text ?? "");
        const priceMatch = text.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          price = priceMatch[0];
          break;
        }
      }
    }

    // Also check RelatedTopics for price or description
    const related: unknown[] = data.RelatedTopics ?? [];
    let bestDescription = abstract;
    let bestUrl = abstractUrl;
    for (const topic of related.slice(0, 5)) {
      if (typeof topic === "object" && topic !== null) {
        const t = topic as Record<string, unknown>;
        const text = String(t.Text ?? "");
        if (!bestDescription && text.length > 20) {
          bestDescription = text;
        }
        if (!bestUrl && typeof t.FirstURL === "string") {
          bestUrl = t.FirstURL;
        }
      }
    }

    if (!bestDescription && results.length > 0) {
      const first = results[0] as Record<string, unknown>;
      bestDescription = String(first.Text ?? "");
      if (!bestUrl && typeof first.FirstURL === "string") {
        bestUrl = first.FirstURL;
      }
    }

    return {
      label: heading || query,
      description: bestDescription || null,
      price,
      url: bestUrl,
      imageUrl: image || null,
      source: "DuckDuckGo",
    };
  } catch {
    return null;
  }
}
