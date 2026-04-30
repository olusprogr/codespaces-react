import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { trackEvent, getRecommendations, clearHistory } from './recommendations.js';

// ── ALGORITHMIC ART: Seeded noise-field particle generator
function useAlgorithmicArt(canvasRef, seed = 42) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;

    const seededRand = (s) => {
      let h = s >>> 0;
      return () => {
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      };
    };
    const rand = seededRand(seed);

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    const particles = Array.from({ length: 120 }, () => ({
      x: rand() * 1920,
      y: rand() * 900,
      vx: (rand() - 0.5) * 0.4,
      vy: (rand() - 0.5) * 0.4,
      size: rand() * 2 + 0.5,
      opacity: rand() * 0.6 + 0.1,
      phase: rand() * Math.PI * 2,
    }));

    const draw = () => {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#1c1a14');
      bg.addColorStop(0.4, '#22201a');
      bg.addColorStop(1, '#181610');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.55);
      glow.addColorStop(0, 'rgba(184,134,11,0.12)');
      glow.addColorStop(0.5, 'rgba(140,100,0,0.06)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 0.5;
      for (let i = -h; i < w + h; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i + Math.sin(t * 0.002 + i * 0.01) * 20, 0);
        ctx.lineTo(i + h + Math.sin(t * 0.002 + i * 0.01 + 1) * 20, h);
        ctx.stroke();
      }
      ctx.restore();

      particles.forEach((p) => {
        p.x = (p.x + p.vx + Math.sin(t * 0.01 + p.phase) * 0.15 + w) % w;
        p.y = (p.y + p.vy + Math.cos(t * 0.008 + p.phase) * 0.15 + h) % h;
        const pulse = Math.sin(t * 0.02 + p.phase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.opacity * pulse})`;
        ctx.fill();
      });

      ctx.save();
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.12;
            ctx.strokeStyle = 'rgba(201,168,76,0.06)';
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      t++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, seed]);
}

// ── PRODUCT DATA
const PRODUCTS = [
  {
    id: 1, category: 'Watches',
    name: 'Chrono Obsidian XII',
    brand: 'AURIS MAISON',
    price: 28500,
    originalPrice: 32000,
    description: 'Tourbillon movement with obsidian dial. Swiss-made, titanium case, sapphire crystal.',
    badge: 'Limited Edition',
    emoji: '⌚',
    accent: '#c9a84c',
    details: {
      movement: 'Manual-winding tourbillon, 72h power reserve',
      case: 'Grade 5 titanium, 42mm, 50m water resistance',
      dial: 'Obsidian black with 18k gold indices',
      crystal: 'Domed sapphire, anti-reflective coating',
      strap: 'Alligator leather with titanium deployant clasp',
      origin: 'Swiss Made · Le Brassus, Switzerland',
      reference: 'AM-XII-T001',
    },
  },
];


const CATEGORIES = ['All', 'Watches'];

const fmt = (n) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const scrollTo = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

// ── INFO MODAL (Maisons / Bespoke / Atelier / Contact / etc.)
function InfoModal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal info-modal">
        <div className="info-modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        {children}
        <button className="modal-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ── SEARCH OVERLAY
function SearchOverlay({ onClose, onAddToCart }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.length > 1
    ? PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.brand.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="modal-overlay search-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-panel">
        <div className="search-panel-header">
          <input
            ref={inputRef}
            className="search-big-input"
            placeholder="Search pieces, brands, categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        {results.length > 0 ? (
          <div className="search-results">
            {results.map((p) => (
              <div key={p.id} className="search-result-item">
                <span className="search-result-emoji">{p.emoji}</span>
                <div className="search-result-info">
                  <div className="search-result-name">{p.name}</div>
                  <div className="search-result-brand">{p.brand} · {p.category}</div>
                </div>
                <div className="search-result-price">{fmt(p.price)}</div>
                <button
                  className="search-result-add"
                  onClick={() => { onAddToCart(p); onClose(); }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        ) : query.length > 1 ? (
          <div className="search-empty">No pieces found for "{query}"</div>
        ) : (
          <div className="search-hint">
            {CATEGORIES.slice(1).map((cat) => (
              <span key={cat} className="search-hint-tag" onClick={() => setQuery(cat)}>{cat}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CART ITEM
function CartItem({ item, onRemove, onQty }) {
  return (
    <div className="cart-item">
      <span className="cart-item-emoji">{item.emoji}</span>
      <div className="cart-item-info">
        <div className="cart-item-name">{item.name}</div>
        <div className="cart-item-brand">{item.brand}</div>
        <div className="cart-item-price">{fmt(item.price)}</div>
      </div>
      <div className="cart-item-controls">
        <button onClick={() => onQty(item.id, -1)}>−</button>
        <span>{item.qty}</span>
        <button onClick={() => onQty(item.id, 1)}>+</button>
      </div>
      <button className="cart-remove" onClick={() => onRemove(item.id)}>×</button>
    </div>
  );
}

// ── PRODUCT DETAIL PAGE
function ProductDetail({ product, onAdd, onBack }) {
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };
  return (
    <div className="detail-page">
      <div className="detail-breadcrumb">
        <button className="detail-back" onClick={onBack}>← Collection</button>
        <span className="detail-bc-sep">/</span>
        <span>{product.category}</span>
        <span className="detail-bc-sep">/</span>
        <span>{product.name}</span>
      </div>
      <div className="detail-body">
        <div className="detail-visual">
          <div className="detail-emoji-wrap" style={{ '--accent': product.accent }}>
            <div className="detail-glow" style={{ background: `radial-gradient(circle, ${product.accent}40, transparent 65%)` }} />
            <div className="detail-emoji">{product.emoji}</div>
          </div>
          {product.badge && <div className="detail-badge">{product.badge}</div>}
        </div>
        <div className="detail-info">
          <div className="detail-overline">{product.category}</div>
          <div className="detail-brand">{product.brand}</div>
          <h1 className="detail-name">{product.name}</h1>
          <div className="detail-pricing">
            <span className="detail-price">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(product.price)}</span>
            {product.originalPrice && (
              <span className="detail-original">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(product.originalPrice)}</span>
            )}
          </div>
          <p className="detail-desc">{product.description}</p>
          <button className={`detail-add-btn ${added ? 'added' : ''}`} onClick={handleAdd}>
            {added ? '✓ Added to Cart' : 'Add to Cart'}
          </button>
          <div className="detail-perks">
            <div className="detail-perk">🚁 White Glove Delivery</div>
            <div className="detail-perk">🔐 Certificate of Authenticity</div>
            <div className="detail-perk">🔄 30-Day Returns</div>
          </div>
          {product.details && (
            <div className="detail-specs">
              <div className="detail-specs-title">Specifications</div>
              {Object.entries(product.details).map(([k, v]) => (
                <div key={k} className="detail-spec-row">
                  <span className="detail-spec-key">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                  <span className="detail-spec-val">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PRODUCT CARD
function ProductCard({ product, onAdd, onView, onSelect }) {
  const [hovering, setHovering] = useState(false);
  const [added, setAdded] = useState(false);
  const viewedRef = useRef(false);

  const handleAdd = () => {
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleMouseEnter = () => {
    setHovering(true);
    if (!viewedRef.current) {
      viewedRef.current = true;
      onView?.(product);
    }
  };

  return (
    <div
      className={`product-card ${hovering ? 'hovered' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovering(false)}
      style={{ '--accent': product.accent }}
    >
      {product.badge && <div className="product-badge">{product.badge}</div>}
      <div className="product-card-clickable" onClick={() => onSelect?.(product)}>
        <div className="product-emoji-wrap">
          <div className="product-emoji">{product.emoji}</div>
          <div
            className="product-glow"
            style={{ background: `radial-gradient(circle, ${product.accent}30, transparent 70%)` }}
          />
        </div>
        <div className="product-category">{product.category}</div>
        <div className="product-brand">{product.brand}</div>
        <div className="product-name">{product.name}</div>
        <div className="product-desc">{product.description}</div>
        <div className="product-pricing">
          <span className="product-price">{fmt(product.price)}</span>
          {product.originalPrice && (
            <span className="product-original">{fmt(product.originalPrice)}</span>
          )}
        </div>
      </div>
      <button className={`add-to-cart ${added ? 'added' : ''}`} onClick={handleAdd}>
        {added ? '✓ In der Auswahl' : 'Add to Cart'}
      </button>
    </div>
  );
}

// ── CHECKOUT MODAL
function CheckoutModal({ cart, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', address: '', card: '', expiry: '', cvv: '' });
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const [orderRef] = useState(() => 'LUX-' + Date.now().toString(36).toUpperCase());

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = total * 0.19;

  const validate1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (!form.address.trim()) e.address = 'Required';
    return e;
  };

  const validate2 = () => {
    const e = {};
    if (form.card.replace(/\s/g, '').length < 16) e.card = '16-digit card number required';
    if (!form.expiry.match(/^\d{2}\/\d{2}$/)) e.expiry = 'MM/YY format';
    if (form.cvv.length < 3) e.cvv = '3-digit CVV required';
    return e;
  };

  const handleNext = () => {
    const e = step === 1 ? validate1() : validate2();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    if (step === 2) {
      setProcessing(true);
      setTimeout(() => { setProcessing(false); setStep(3); onSuccess(); }, 2400);
    } else {
      setStep(2);
    }
  };

  const fmtCard = (v) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExpiry = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && step !== 3 && onClose()}
    >
      <div className="modal">
        {/* PROGRESS BAR */}
        {step < 3 && (
          <div className="modal-progress">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1 · Details</div>
            <div className="progress-line"><div className="progress-fill" style={{ width: step >= 2 ? '100%' : '0%' }} /></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2 · Payment</div>
            <div className="progress-line"><div className="progress-fill" style={{ width: step >= 3 ? '100%' : '0%' }} /></div>
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3 · Confirm</div>
          </div>
        )}

        {/* STEP 1 – SHIPPING */}
        {step === 1 && (
          <>
            <h2 className="modal-title">Shipping Details</h2>
            <div className="form-group">
              <label>Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Alexandre Beaumont"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="alexandre@maison.fr"
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label>Delivery Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="16 Avenue Montaigne, 75008 Paris"
              />
              {errors.address && <span className="form-error">{errors.address}</span>}
            </div>

            {/* ORDER SUMMARY */}
            <div className="order-summary">
              <div className="summary-label">Your Selection</div>
              {cart.map((item) => (
                <div key={item.id} className="summary-product-row">
                  <span>{item.emoji} {item.name} {item.qty > 1 && `×${item.qty}`}</span>
                  <span>{fmt(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="summary-divider" />
              <div className="summary-row"><span>Subtotal</span><span>{fmt(total)}</span></div>
              <div className="summary-row"><span>VAT (19%)</span><span>{fmt(tax)}</span></div>
              <div className="summary-row"><span>White Glove Delivery</span><span>Complimentary</span></div>
              <div className="summary-row total"><span>Total</span><span>{fmt(total + tax)}</span></div>
            </div>
            <button className="modal-btn" onClick={handleNext}>Continue to Payment →</button>
          </>
        )}

        {/* STEP 2 – PAYMENT */}
        {step === 2 && !processing && (
          <>
            <h2 className="modal-title">Secure Payment</h2>
            <div className="secure-badge">🔒 256-bit SSL Encrypted · PCI DSS Compliant</div>
            <div className="form-group">
              <label>Card Number</label>
              <input
                value={form.card}
                onChange={(e) => setForm({ ...form, card: fmtCard(e.target.value) })}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
              />
              {errors.card && <span className="form-error">{errors.card}</span>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expiry</label>
                <input
                  value={form.expiry}
                  onChange={(e) => setForm({ ...form, expiry: fmtExpiry(e.target.value) })}
                  placeholder="MM/YY"
                  maxLength={5}
                />
                {errors.expiry && <span className="form-error">{errors.expiry}</span>}
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input
                  type="password"
                  value={form.cvv}
                  onChange={(e) =>
                    setForm({ ...form, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })
                  }
                  placeholder="•••"
                  maxLength={3}
                />
                {errors.cvv && <span className="form-error">{errors.cvv}</span>}
              </div>
            </div>
            <div className="order-summary" style={{ marginTop: '1.2rem' }}>
              <div className="summary-row total">
                <span>Total Charge</span>
                <span>{fmt(total + tax)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="modal-btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button className="modal-btn" onClick={handleNext} style={{ flex: 1 }}>
                Complete Purchase →
              </button>
            </div>
          </>
        )}

        {/* STEP 2 – PROCESSING */}
        {step === 2 && processing && (
          <div className="processing">
            <div className="processing-ring">
              <div className="processing-spinner" />
              <span className="processing-icon">🔒</span>
            </div>
            <div className="processing-text">Authorizing your purchase…</div>
            <div className="processing-sub">Securely contacting your bank</div>
            <div className="processing-steps">
              <div className="proc-step done">✓ Validating card details</div>
              <div className="proc-step active">⟳ Bank authorization</div>
              <div className="proc-step">○ Confirming order</div>
            </div>
          </div>
        )}

        {/* STEP 3 – SUCCESS */}
        {step === 3 && (
          <div className="success-screen">
            <div className="success-icon-wrap">
              <div className="success-icon">✦</div>
            </div>
            <h2>Purchase Confirmed</h2>
            <p className="success-msg">
              Merci, <strong>{form.name}</strong>.
            </p>
            <p className="success-sub">
              Your order has been received. Our concierge will contact you within 24 hours to
              arrange white-glove delivery to <em>{form.address}</em>.
            </p>
            <div className="success-items">
              {cart.map((item) => (
                <div key={item.id} className="success-item">
                  {item.emoji} {item.name}
                  {item.qty > 1 && <span className="success-qty">×{item.qty}</span>}
                </div>
              ))}
            </div>
            <div className="success-order">
              <div className="success-order-label">Order Reference</div>
              <div className="success-order-number">{orderRef}</div>
            </div>
            <button className="modal-btn" onClick={onClose}>Return to Boutique</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP
export default function App() {
  const canvasRef = useRef(null);
  useAlgorithmicArt(canvasRef, 7331);

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null); // { title, content }
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroVisible, setHeroVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100); }, []);

  // ── Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const recsTimerRef = useRef(null);
  const recsAbortRef = useRef(null);

  // Fix C + D — AbortController prevents stale responses overwriting fresh ones;
  // null result means error → keep whatever recommendations are already shown.
  const refreshRecommendations = useCallback(() => {
    clearTimeout(recsTimerRef.current);
    recsTimerRef.current = setTimeout(async () => {
      recsAbortRef.current?.abort();
      const ctrl = new AbortController();
      recsAbortRef.current = ctrl;
      setRecsLoading(true);
      const recs = await getRecommendations(PRODUCTS, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setRecsLoading(false);
      if (recs === null) return;        // error — keep old results visible
      if (recs.length === 0) return;    // nothing useful — keep old results
      setRecommendations(recs);
    }, 800);
  }, []);

  // ── Cart logic
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    trackEvent('cart_add', product);
    setCartOpen(true);
    refreshRecommendations();
  }, [refreshRecommendations]);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQty = useCallback((id, delta) => {
    setCart((prev) =>
      prev.map((i) => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  }, []);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // ── Filter logic
  const filtered = PRODUCTS.filter((p) => {
    const catMatch = activeCategory === 'All' || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const searchMatch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return catMatch && searchMatch;
  });

  const handleCheckoutSuccess = () => {
    clearHistory();
    setRecommendations([]);
    setTimeout(() => setCart([]), 3500);
  };

  // ── Info modal content definitions
  const openMailson = () => setInfoModal({
    title: 'Our Maisons',
    content: (
      <div className="info-content">
        {[
          { name: 'AURIS MAISON', loc: 'Geneva, Switzerland', desc: 'Master watchmakers since 1908. Every timepiece is a mechanical poem.', emoji: '⌚' },
          { name: 'LUMIÈRE PARIS', loc: 'Paris, France', desc: 'High jewellery atelier on Place Vendôme. Diamonds set by hand.', emoji: '💎' },
          { name: 'MAISON VANEL', loc: 'Paris & Lyon, France', desc: 'Leather goods and silk since 1932. Crafted by 3rd-generation artisans.', emoji: '👜' },
          { name: 'NÉRON PARIS', loc: 'Grasse, France', desc: 'Perfumers in the heartland of fragrance. Rare raw materials only.', emoji: '🌹' },
          { name: 'CALLISTO BESPOKE', loc: 'Florence, Italy', desc: 'Handmade shoes on your personal last. Delivery in 12 weeks.', emoji: '👞' },
        ].map((m) => (
          <div key={m.name} className="info-maison-card">
            <span className="info-maison-emoji">{m.emoji}</span>
            <div>
              <div className="info-maison-name">{m.name}</div>
              <div className="info-maison-loc">{m.loc}</div>
              <div className="info-maison-desc">{m.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  });

  const openBespoke = () => setInfoModal({
    title: 'Bespoke Services',
    content: (
      <div className="info-content">
        <p className="info-text">
          Every piece in our collection can be made entirely to your specification. From engraved
          watch cases to hand-painted shoe patinas — your vision, our craft.
        </p>
        <div className="info-steps">
          {[
            { n: '01', title: 'Private Consultation', desc: 'A dedicated advisor contacts you within 48 hours.' },
            { n: '02', title: 'Design & Selection', desc: 'Materials, dimensions, finishes — all chosen by you.' },
            { n: '03', title: 'Artisan Production', desc: 'Handcrafted in the maison atelier. 4–16 weeks.' },
            { n: '04', title: 'White Glove Delivery', desc: 'Your piece arrives in a custom presentation case.' },
          ].map((s) => (
            <div key={s.n} className="info-step">
              <div className="info-step-n">{s.n}</div>
              <div>
                <div className="info-step-title">{s.title}</div>
                <div className="info-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="info-cta-note">Contact our concierge to begin: <strong>bespoke@aurismaison.com</strong></div>
      </div>
    ),
  });

  const openAtelier = () => setInfoModal({
    title: 'The Atelier',
    content: (
      <div className="info-content">
        <p className="info-text">
          Step inside our virtual atelier — a space where centuries of craft meet contemporary vision.
          Each maison maintains a dedicated workshop where masters pass their skills to the next generation.
        </p>
        <div className="info-grid">
          {[
            { emoji: '🔨', title: 'Hand-Finishing', desc: 'Every surface touched by skilled hands before delivery.' },
            { emoji: '🔬', title: 'Swiss Precision', desc: '1/100mm tolerances in our watchmaking workshops.' },
            { emoji: '🧵', title: 'Saddle Stitch', desc: 'Hand-stitched leather goods that last a lifetime.' },
            { emoji: '🌿', title: 'Sustainable Materials', desc: 'Responsibly sourced from certified suppliers only.' },
          ].map((i) => (
            <div key={i.title} className="info-grid-card">
              <div className="info-grid-emoji">{i.emoji}</div>
              <div className="info-grid-title">{i.title}</div>
              <div className="info-grid-desc">{i.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  const openContact = () => setInfoModal({
    title: 'Private Concierge',
    content: (
      <div className="info-content">
        <p className="info-text">
          Our private client advisors are available around the clock to assist with purchases,
          bespoke orders, and any enquiries.
        </p>
        <div className="info-contact-list">
          {[
            { icon: '📞', label: 'Phone', value: '+33 1 42 65 00 00' },
            { icon: '✉️', label: 'Email', value: 'concierge@aurismaison.com' },
            { icon: '💬', label: 'WhatsApp', value: '+33 6 12 34 56 78' },
            { icon: '🕐', label: 'Hours', value: '24 / 7 · Every day of the year' },
          ].map((c) => (
            <div key={c.label} className="info-contact-row">
              <span className="info-contact-icon">{c.icon}</span>
              <div>
                <div className="info-contact-label">{c.label}</div>
                <div className="info-contact-value">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  return (
    <div className="shop">

      {/* ── NAV (always at top, sticky) */}
      <nav className="nav">
        <button className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          AURIS
        </button>
        <div className="nav-links">
          <button className="nav-link-btn" onClick={() => scrollTo('catalog')}>Collection</button>
          <button className="nav-link-btn" onClick={openMailson}>Maisons</button>
          <button className="nav-link-btn" onClick={openBespoke}>Bespoke</button>
          <button className="nav-link-btn" onClick={openAtelier}>Atelier</button>
        </div>
        <div className="nav-actions">
          <button className="nav-search-btn" aria-label="search" onClick={() => setSearchOpen(true)}>
            ⌕
          </button>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            <span className="cart-icon">🛍</span>
            <span className="cart-label">Cart</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
        {/* Mobile hamburger */}
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)}>
          {mobileMenuOpen ? '×' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <button onClick={() => { scrollTo('catalog'); setMobileMenuOpen(false); }}>Collection</button>
          <button onClick={() => { openMailson(); setMobileMenuOpen(false); }}>Maisons</button>
          <button onClick={() => { openBespoke(); setMobileMenuOpen(false); }}>Bespoke</button>
          <button onClick={() => { openAtelier(); setMobileMenuOpen(false); }}>Atelier</button>
          <button onClick={() => { openContact(); setMobileMenuOpen(false); }}>Concierge</button>
        </div>
      )}

      {/* ── PRODUCT DETAIL PAGE */}
      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onAdd={addToCart}
          onBack={() => setSelectedProduct(null)}
        />
      )}

      {/* ── MAIN CONTENT (hidden when detail page is open) */}
      {!selectedProduct && <div className="hero">
        <canvas ref={canvasRef} className="hero-canvas" />
        <div className={`hero-content ${heroVisible ? 'visible' : ''}`}>
          <div className="hero-overline">MAISON AURIS · EST. MMXIX</div>
          <h1 className="hero-title">
            <span>L'Art du</span>
            <span className="hero-gold">Luxe</span>
          </h1>
          <p className="hero-tagline">Curated objects of desire. Crafted for those who know.</p>
          <div className="hero-cta-group">
            <button
              className="hero-cta primary"
              onClick={() => scrollTo('catalog')}
            >
              Explore Collection
            </button>
            <button className="hero-cta secondary" onClick={openMailson}>
              Our Maisons
            </button>
          </div>
        </div>
        <div className="hero-scroll-hint" onClick={() => scrollTo('catalog')}>
          <div className="scroll-line" />
          <span>Scroll</span>
        </div>
      </div>}

      {!selectedProduct && <>
      {/* ── MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee">
          {['White Glove Delivery', 'Certified Authenticity', 'Swiss Craftsmanship', 'Parisian Ateliers', '30-Day Returns', 'Private Concierge', 'Complimentary Engraving'].map((t, i) => (
            <span key={i}>✦ {t} </span>
          ))}
          {['White Glove Delivery', 'Certified Authenticity', 'Swiss Craftsmanship', 'Parisian Ateliers', '30-Day Returns', 'Private Concierge', 'Complimentary Engraving'].map((t, i) => (
            <span key={`b${i}`}>✦ {t} </span>
          ))}
        </div>
      </div>

      {/* ── RECOMMENDATIONS (above catalog, shown once data exists) */}
      {(recsLoading || recommendations.length > 0) && (
        <section className="recommendations">
          <div className="recs-header">
            <div className="recs-overline">Powered by Gemini AI</div>
            <h2 className="recs-title">Curated For You</h2>
            <p className="recs-subtitle">Based on your browsing — pieces you may desire.</p>
          </div>
          {recsLoading ? (
            <div className="recs-loading">
              <div className="recs-spinner" />
              <span>Analysing your taste…</span>
            </div>
          ) : (
            <div className="recs-grid">
              {recommendations.map((p) => (
                <ProductCard key={`rec-${p.id}`} product={p} onAdd={addToCart} onSelect={setSelectedProduct} onView={(prod) => { trackEvent('view', prod); refreshRecommendations(); }} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── CATALOG */}
      <section id="catalog" className="catalog">
        <div className="catalog-header">
          <h2 className="catalog-title">The Collection</h2>
          <p className="catalog-subtitle">
            Objects of singular craftsmanship, selected from the world's finest maisons.
          </p>
        </div>

        {/* FILTERS */}
        <div className="filters">
          <div className="category-filters">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat);
                  if (cat !== 'All') {
                    trackEvent('filter', { category: cat });
                    refreshRecommendations();
                  }
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="filter-right">
            <input
              className="search-input"
              placeholder="Search pieces…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
        </div>

        {/* PRODUCT COUNT */}
        <div className="product-count">
          {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'} found
          {activeCategory !== 'All' && ` in ${activeCategory}`}
        </div>

        {/* PRODUCT GRID */}
        {filtered.length > 0 ? (
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={addToCart} onSelect={setSelectedProduct} onView={(prod) => { trackEvent('view', prod); refreshRecommendations(); }} />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <p>No pieces match your search.</p>
            <button className="cat-btn active" onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>
              Show All Pieces
            </button>
          </div>
        )}
      </section>
      </>}

      {/* ── FEATURES STRIP */}
      <section className="features">
        {[
          { icon: '🚁', title: 'White Glove Delivery', desc: 'Private courier to your door, worldwide.', action: openContact },
          { icon: '🔐', title: 'Certificate of Authenticity', desc: 'Every piece verified and documented.', action: null },
          { icon: '🔄', title: '30-Day Returns', desc: 'No questions asked return policy.', action: openContact },
          { icon: '📞', title: 'Private Concierge', desc: 'Dedicated client advisor, 24/7.', action: openContact },
        ].map((f, i) => (
          <div
            key={i}
            className={`feature-card ${f.action ? 'clickable' : ''}`}
            onClick={f.action || undefined}
          >
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
            {f.action && <div className="feature-cta">Learn more →</div>}
          </div>
        ))}
      </section>

      {/* ── FOOTER */}
      <footer className="footer">
        <div className="footer-top">
          <button className="footer-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            AURIS
          </button>
          <div className="footer-tagline">Maison de Luxe · Paris · Geneva · Tokyo</div>
        </div>
        <div className="footer-links">
          <button onClick={openContact}>Contact</button>
          <button onClick={openBespoke}>Bespoke</button>
          <button onClick={openMailson}>Maisons</button>
          <button onClick={openAtelier}>Atelier</button>
          <button onClick={() => setInfoModal({ title: 'Privacy Policy', content: <div className="info-content"><p className="info-text">We collect only what is necessary to process your order and provide our concierge service. Your data is never sold to third parties. Full policy available on request.</p></div> })}>
            Privacy
          </button>
          <button onClick={() => setInfoModal({ title: 'Legal Notice', content: <div className="info-content"><p className="info-text">AURIS MAISON SAS · 16 Avenue Montaigne · 75008 Paris · France. SIRET: 123 456 789 00010. VAT: FR12345678900. All prices include applicable taxes.</p></div> })}>
            Legal
          </button>
        </div>
        <div className="footer-copy">© 2026 Auris Maison. All rights reserved.</div>
      </footer>

      {/* ── CART DRAWER */}
      {cartOpen && (
        <div className="drawer-overlay" onClick={() => setCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h3>Your Selection {cartCount > 0 && <span className="cart-header-count">({cartCount})</span>}</h3>
              <button className="drawer-close" onClick={() => setCartOpen(false)}>×</button>
            </div>
            {cart.length === 0 ? (
              <div className="cart-empty">
                <div className="cart-empty-icon">🛍</div>
                <p>Your cart is empty.</p>
                <p className="cart-empty-sub">Begin your selection below.</p>
                <button
                  className="cat-btn active"
                  style={{ marginTop: '1rem' }}
                  onClick={() => { setCartOpen(false); scrollTo('catalog'); }}
                >
                  Browse Collection
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <CartItem key={item.id} item={item} onRemove={removeFromCart} onQty={updateQty} />
                  ))}
                </div>
                <div className="cart-footer">
                  <div className="cart-total-row">
                    <span>Subtotal</span>
                    <span className="cart-total-amount">{fmt(cartTotal)}</span>
                  </div>
                  <div className="cart-tax-note">VAT & delivery calculated at checkout</div>
                  <button
                    className="checkout-btn"
                    onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  >
                    Proceed to Checkout →
                  </button>
                  <button
                    className="continue-btn"
                    onClick={() => setCartOpen(false)}
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHECKOUT MODAL */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* ── SEARCH OVERLAY */}
      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onAddToCart={(p) => { addToCart(p); setCartOpen(true); }}
        />
      )}

      {/* ── INFO MODAL */}
      {infoModal && (
        <InfoModal title={infoModal.title} onClose={() => setInfoModal(null)}>
          {infoModal.content}
        </InfoModal>
      )}
    </div>
  );
}
