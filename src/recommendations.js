// ── INTERACTION TRACKER + GEMINI RECOMMENDATIONS
// Tracks user behaviour in localStorage and calls Gemini to suggest products.

const STORAGE_KEY = 'auris_interactions';
const MAX_EVENTS = 80;

// ── Read / write helpers
function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

// ── Public: record one interaction
export function trackEvent(type, product) {
  const events = loadEvents();
  events.push({
    type,           // 'view' | 'cart_add' | 'filter' | 'search'
    productId: product?.id ?? null,
    category: product?.category ?? null,
    name: product?.name ?? null,
    price: product?.price ?? null,
    ts: Date.now(),
  });
  saveEvents(events);
}

// ── Public: clear history (e.g. after successful checkout)
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Build a compact summary for the prompt
function buildContext(events, allProducts) {
  const counts = {};
  const catCounts = {};
  let maxPrice = 0;
  let minPrice = Infinity;

  for (const e of events) {
    if (e.productId) {
      const key = `${e.productId}`;
      counts[key] = counts[key] || { name: e.name, category: e.category, price: e.price, views: 0, adds: 0 };
      if (e.type === 'view')     counts[key].views++;
      if (e.type === 'cart_add') counts[key].adds++;
    }
    if (e.category) {
      catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    }
    if (e.price) {
      maxPrice = Math.max(maxPrice, e.price);
      minPrice = Math.min(minPrice, e.price);
    }
  }

  const topProducts = Object.values(counts)
    .sort((a, b) => b.adds * 3 + b.views - (a.adds * 3 + a.views))
    .slice(0, 5);

  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const catalog = allProducts.map((p) =>
    `id:${p.id} | "${p.name}" | ${p.category} | €${p.price} | ${p.description}`
  ).join('\n');

  return { topProducts, topCategories, minPrice, maxPrice, catalog };
}

// ── Main: ask Gemini which products to recommend
export async function getRecommendations(allProducts) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return [];

  const events = loadEvents();
  if (events.length < 2) return [];

  const { topProducts, topCategories, minPrice, maxPrice, catalog } = buildContext(events, allProducts);

  const prompt = `You are a luxury e-commerce recommendation engine for "Auris Maison".

Customer behaviour summary:
- Most interacted products: ${topProducts.map((p) => `"${p.name}" (${p.category}, €${p.price}, ${p.adds} cart adds, ${p.views} views)`).join('; ') || 'none'}
- Favourite categories: ${topCategories.join(', ') || 'none'}
- Price range engaged: €${minPrice === Infinity ? 0 : minPrice} – €${maxPrice}

Full product catalog (id | name | category | price | description):
${catalog}

Task: Return a JSON array of exactly 3 product IDs from the catalog that this customer is most likely to buy next, based on their behaviour. Use Amazon-style collaborative filtering logic: consider category affinity, price range, and complementary product types.

Rules:
- Only return IDs that exist in the catalog above
- Do NOT recommend products already added to cart (those with cart adds > 0 in the behaviour summary)
- Return ONLY valid JSON, no explanation: [id1, id2, id3]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 100 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Recommendations] Gemini error:', err);
      return [];
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const match = text.match(/\[[\d,\s]+\]/);
    if (!match) return [];

    const ids = JSON.parse(match[0]);
    return allProducts.filter((p) => ids.includes(p.id));
  } catch (e) {
    console.error('[Recommendations] fetch failed:', e);
    return [];
  }
}
