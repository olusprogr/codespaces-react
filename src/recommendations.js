const STORAGE_KEY = 'auris_interactions';
const MAX_EVENTS = 80;

function loadEvents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function trackEvent(type, product) {
  const events = loadEvents();
  events.push({
    type,
    productId: product?.id ?? null,
    category: product?.category ?? null,
    name: product?.name ?? null,
    price: product?.price ?? null,
    ts: Date.now(),
  });
  saveEvents(events);
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function buildContext(events, allProducts) {
  const counts = {};
  const catCounts = {};
  let maxPrice = 0;
  let minPrice = Infinity;

  for (const e of events) {
    if (e.productId) {
      const key = String(e.productId);
      counts[key] = counts[key] || { name: e.name, category: e.category, price: e.price, views: 0, adds: 0 };
      if (e.type === 'view')     counts[key].views++;
      if (e.type === 'cart_add') counts[key].adds++;
    }
    if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    if (e.price) {
      maxPrice = Math.max(maxPrice, e.price);
      minPrice = Math.min(minPrice, e.price);
    }
  }

  const topProducts = Object.values(counts)
    .sort((a, b) => (b.adds * 3 + b.views) - (a.adds * 3 + a.views))
    .slice(0, 5);

  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const catalog = allProducts
    .map(p => `id:${p.id} | "${p.name}" | ${p.category} | €${p.price} | ${p.description}`)
    .join('\n');

  return { topProducts, topCategories, minPrice: minPrice === Infinity ? 0 : minPrice, maxPrice, catalog };
}

// Fix B — robust JSON parsing: strips markdown fences, handles string IDs
function parseIds(text) {
  const cleaned = text.replace(/```[\w]*\n?/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(Number).filter(n => !isNaN(n));
  } catch {
    return null;
  }
}

// Returns: Product[] on success, null on any error (so caller can keep old results)
export async function getRecommendations(allProducts, signal) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const events = loadEvents();
  if (events.length < 2) return null;

  const { topProducts, topCategories, minPrice, maxPrice, catalog } = buildContext(events, allProducts);

  // Fix F — don't hard-exclude cart items; ask for complementary instead
  const cartItems = topProducts.filter(p => p.adds > 0).map(p => `"${p.name}"`).join(', ');
  const viewedItems = topProducts.filter(p => p.views > 0 && p.adds === 0).map(p => `"${p.name}"`).join(', ');

  const prompt = `You are a luxury e-commerce recommendation engine for "Auris Maison".

Customer behaviour:
- Recently added to cart: ${cartItems || 'none'} — suggest complementary pieces, not the same items
- Recently viewed: ${viewedItems || 'none'}
- Favourite categories: ${topCategories.join(', ') || 'none'}
- Price range engaged: €${minPrice} – €${maxPrice}

Full product catalog (id | name | category | price | description):
${catalog}

Return a JSON array of exactly 3 product IDs the customer is most likely to buy next.
Consider: category affinity, price range, and complementary product types.
IMPORTANT: Return ONLY the raw JSON array — no markdown, no explanation. Example: [4,17,23]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 100 },
        }),
      }
    );

    // Fix A — return null on any error so caller keeps old recommendations
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[Recommendations] API error:', err?.error?.message ?? res.status);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const ids = parseIds(text);
    if (!ids) {
      console.warn('[Recommendations] Could not parse IDs from:', text);
      return null;
    }

    const results = allProducts.filter(p => ids.includes(p.id));
    // Fix F fallback — if Gemini gave us fewer than 3, pad with popular items not already shown
    if (results.length < 3) {
      const shown = new Set(results.map(p => p.id));
      const topSellers = allProducts.filter(p => !shown.has(p.id) && p.badge);
      for (const p of topSellers) {
        if (results.length >= 3) break;
        results.push(p);
      }
    }

    return results;
  } catch (e) {
    if (e.name === 'AbortError') return null;
    console.warn('[Recommendations] fetch failed:', e.message);
    return null;
  }
}
