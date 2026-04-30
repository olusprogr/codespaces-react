import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
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

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    const particles = Array.from({ length: 120 }, () => ({
      x: rand() * 1920, y: rand() * 900,
      vx: (rand() - 0.5) * 0.4, vy: (rand() - 0.5) * 0.4,
      size: rand() * 2 + 0.5, opacity: rand() * 0.6 + 0.1,
      phase: rand() * Math.PI * 2,
    }));

    const draw = () => {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#1c1a14'); bg.addColorStop(0.4, '#22201a'); bg.addColorStop(1, '#181610');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.55);
      glow.addColorStop(0, 'rgba(184,134,11,0.12)'); glow.addColorStop(0.5, 'rgba(140,100,0,0.06)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalAlpha = 0.04; ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 0.5;
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
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.opacity * pulse})`; ctx.fill();
      });
      ctx.save(); ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.12;
            ctx.strokeStyle = 'rgba(201,168,76,0.06)';
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
          }
        }
      }
      ctx.restore();
      t++; animId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [canvasRef, seed]);
}

// ── PRODUCT DATA
const PRODUCTS = [
  {
    id: 1, category: 'Watches', name: 'Chrono Obsidian XII', brand: 'AURIS MAISON',
    price: 28500, originalPrice: 32000,
    description: 'Tourbillon movement with obsidian dial. Swiss-made, titanium case, sapphire crystal.',
    badge: 'Limited Edition', emoji: '⌚', accent: '#c9a84c',
    details: { movement: 'Manual-winding tourbillon, 72h power reserve', case: 'Grade 5 titanium, 42mm, 50m WR', dial: 'Obsidian black with 18k gold indices', crystal: 'Domed sapphire, AR coating both sides', strap: 'Alligator leather, titanium deployant clasp', origin: 'Swiss Made · Le Brassus', reference: 'AM-XII-T001' },
  },
  {
    id: 2, category: 'Jewelry', name: 'Celestia Diamond Ring', brand: 'LUMIÈRE PARIS',
    price: 14200, originalPrice: null,
    description: '3.2ct VVS1 diamond, platinum band. GIA certified. Handcrafted in Paris.',
    badge: 'Bestseller', emoji: '💎', accent: '#b8d4e8',
    details: { metal: 'Platinum 950', stone: '3.2ct round brilliant, VVS1 D-colour', setting: 'Six-claw solitaire', band: '2.2mm tapered, polished finish', certification: 'GIA #2417830291', weight: '5.4g total', origin: 'Paris, France', reference: 'LP-CDR-001' },
  },
  {
    id: 3, category: 'Handbags', name: 'Noir Structuré Bag', brand: 'MAISON VANEL',
    price: 4750, originalPrice: null,
    description: 'Full-grain calf leather, 18k gold hardware. Hand-stitched by Parisian artisans.',
    badge: 'New Arrival', emoji: '👜', accent: '#a0856c',
    details: { material: 'Full-grain French calf leather', hardware: '18k gold-plated brass', lining: 'Grosgrain silk, suede-lined pockets', dimensions: '30 × 22 × 12 cm', strap: 'Detachable leather shoulder strap', closure: 'Magnetic turnlock', origin: 'Paris, France', reference: 'MV-NSB-030' },
  },
  {
    id: 4, category: 'Perfume', name: 'Oud Imperiale', brand: 'NÉRON PARIS',
    price: 890, originalPrice: null,
    description: 'Aged Cambodian oud, Bulgarian rose, ambergris. 100ml flacon de parfum.',
    badge: null, emoji: '🌹', accent: '#9b6b9b',
    details: { concentration: 'Parfum (30% aromatic compounds)', topNotes: 'Pink pepper, bergamot', heartNotes: 'Aged Cambodian oud, Bulgarian rose', baseNotes: 'Grey ambergris, sandalwood, musk', volume: '100ml', longevity: '12–18 hours', projection: 'Moderate–heavy', origin: 'Grasse, France', reference: 'NP-OI-100' },
  },
  {
    id: 5, category: 'Watches', name: 'Perpetuel Blanc', brand: 'AURIS MAISON',
    price: 41000, originalPrice: null,
    description: 'Perpetual calendar, moonphase complication. 18k white gold, crocodile strap.',
    badge: 'Haute Horlogerie', emoji: '🕰️', accent: '#e8e0d0',
    details: { movement: 'Cal. AM-500PC, perpetual calendar, moonphase', case: '18k white gold, 41mm, 30m WR', dial: 'Silver guilloché with blued moonphase disc', crystal: 'Flat sapphire, single AR coating', strap: 'Porosus crocodile, 18k white gold buckle', powerReserve: '56 hours', origin: 'Swiss Made · Geneva', reference: 'AM-PB-4100' },
  },
  {
    id: 6, category: 'Jewelry', name: 'Serpentine Bracelet', brand: 'LUMIÈRE PARIS',
    price: 6800, originalPrice: 7500,
    description: 'Articulated 18k yellow gold with pavé emeralds. Inspired by Art Deco movement.',
    badge: 'Special Price', emoji: '✨', accent: '#4caf7a',
    details: { metal: '18k yellow gold', stones: 'Colombian emeralds 1.8ct total, F1 quality', setting: 'Pavé, hand-set', length: '18cm, adjustable to 20cm', clasp: 'Hidden box clasp with safety', weight: '28g', origin: 'Paris, France', reference: 'LP-SB-068' },
  },
  {
    id: 7, category: 'Shoes', name: 'Velours Noir Derby', brand: 'CALLISTO BESPOKE',
    price: 1950, originalPrice: null,
    description: 'Bespoke calfskin derby with hand-painted patina. Goodyear-welted construction.',
    badge: null, emoji: '👞', accent: '#8b6347',
    details: { material: 'Box calf leather, hand-painted patina', sole: 'Double leather sole, hand-stitched welt', construction: 'Goodyear-welted', last: 'Classic Oxford, medium width', lining: 'Full leather lining', heel: '28mm', origin: 'Florence, Italy', reference: 'CB-VND-001' },
  },
  {
    id: 8, category: 'Accessories', name: 'Plissé Silk Scarf', brand: 'MAISON VANEL',
    price: 680, originalPrice: null,
    description: 'Hand-rolled edges, 140×140cm pure silk. Printed in Lyon, finished in Paris.',
    badge: 'Artisan Craft', emoji: '🧣', accent: '#d4a0c8',
    details: { material: 'Pure silk twill, 65g/m²', dimensions: '140 × 140 cm', print: 'Screen-printed in Lyon, 32 colours', edges: 'Hand-rolled and hand-stitched', finish: 'Steam-pressed, plissé fold', care: 'Dry clean only', origin: 'Lyon & Paris, France', reference: 'MV-PSS-140' },
  },
  {
    id: 9, category: 'Perfume', name: 'Blanc de Lune', brand: 'NÉRON PARIS',
    price: 650, originalPrice: null,
    description: 'White musk, iris root, Tahitian vanilla. An ethereal nocturnal fragrance.',
    badge: null, emoji: '🌙', accent: '#d8d0f0',
    details: { concentration: 'Eau de Parfum (22% aromatic compounds)', topNotes: 'Aldehydes, neroli', heartNotes: 'Iris root absolute, violet', baseNotes: 'White musk, Tahitian vanilla, cedarwood', volume: '75ml', longevity: '8–12 hours', origin: 'Grasse, France', reference: 'NP-BDL-075' },
  },
  {
    id: 10, category: 'Watches', name: 'Squelette Doré', brand: 'AURIS MAISON',
    price: 67000, originalPrice: null,
    description: 'Open-worked skeleton dial in 18k rose gold. Hand-engraved bridges, 72h power reserve.',
    badge: 'Exclusive', emoji: '🕰️', accent: '#d4a84c',
    details: { movement: 'Manual-winding skeleton, hand-engraved', case: '18k rose gold, 43mm, 30m WR', dial: 'Open-worked, rhodium-plated bridges', finishing: 'Côtes de Genève, bevelled edges', strap: 'Dark brown alligator, rose gold clasp', powerReserve: '72 hours', origin: 'Swiss Made · Le Brassus', reference: 'AM-SQD-001' },
  },
  {
    id: 11, category: 'Watches', name: 'Diver Noir 500', brand: 'AURIS MAISON',
    price: 12800, originalPrice: 14500,
    description: '500m water-resistant, ceramic bezel, Super-LumiNova indices. ISO 6425 certified.',
    badge: 'Special Price', emoji: '⌚', accent: '#3a5a7c',
    details: { movement: 'Cal. AM-200A, automatic, 42h reserve', case: 'Grade 5 titanium, 44mm, 500m WR', bezel: 'Unidirectional, black ceramic insert', dial: 'Matte black, Super-LumiNova C3 indices', crystal: 'Domed sapphire, anti-reflective', bracelet: 'Titanium with wetsuit extension', certification: 'ISO 6425', origin: 'Swiss Made · Geneva', reference: 'AM-DN5-044' },
  },
  {
    id: 12, category: 'Watches', name: 'Grand Feu Émail', brand: 'AURIS MAISON',
    price: 54000, originalPrice: null,
    description: 'Hand-painted grand feu enamel dial depicting the Paris skyline. Unique piece.',
    badge: 'One of a Kind', emoji: '🕰️', accent: '#c8b8a2',
    details: { movement: 'Cal. AM-100M, manual-winding', case: '18k yellow gold, 40mm, 30m WR', dial: 'Grand feu enamel, hand-painted Paris skyline', artist: 'Maison Duval, Vallée de Joux', crystal: 'Flat sapphire, single AR coating', strap: 'Black alligator, 18k yellow gold buckle', edition: 'Unique piece, certificate included', origin: 'Swiss Made · Le Brassus', reference: 'AM-GFE-UNIQUE' },
  },
  {
    id: 13, category: 'Jewelry', name: 'Étoile Sapphire Necklace', brand: 'LUMIÈRE PARIS',
    price: 22500, originalPrice: null,
    description: 'Ceylon sapphire 8ct centre stone, pavé diamond surround. 18k white gold chain.',
    badge: 'New Arrival', emoji: '💙', accent: '#4a6fa5',
    details: { metal: '18k white gold', centreStone: 'Ceylon sapphire 8.04ct, no heat, AGL certified', surroundStones: 'Pavé diamonds 1.2ct, VVS1 E', chain: '18k white gold, 45cm', clasp: 'Lobster claw with safety', totalWeight: '12.3g', origin: 'Paris, France', reference: 'LP-ESN-001' },
  },
  {
    id: 14, category: 'Jewelry', name: 'Panthère Cuff', brand: 'LUMIÈRE PARIS',
    price: 18900, originalPrice: 21000,
    description: 'Articulated 18k yellow gold cuff with onyx spots and emerald eyes. Art Deco.',
    badge: 'Bestseller', emoji: '✨', accent: '#c8a832',
    details: { metal: '18k yellow gold', stones: 'Black onyx, Colombian emeralds (eyes)', construction: 'Articulated links, hand-assembled', width: '28mm at centre tapering to 14mm', clasp: 'Hidden hinge with double safety', weight: '64g', origin: 'Paris, France', reference: 'LP-PC-189' },
  },
  {
    id: 15, category: 'Jewelry', name: 'Pearl Rivière', brand: 'LUMIÈRE PARIS',
    price: 9400, originalPrice: null,
    description: 'Perfectly matched South Sea pearls, 12–14mm diameter. Diamond-set 18k clasp.',
    badge: null, emoji: '🪬', accent: '#f0ece4',
    details: { pearls: 'South Sea, 12–14mm, matched for colour and lustre', count: '17 pearls', clasp: '18k white gold, 0.3ct pavé diamonds', length: '45cm', grading: 'AAA quality, natural colour', thread: 'Hand-knotted silk between each pearl', origin: 'Australia · Paris', reference: 'LP-PR-094' },
  },
  {
    id: 16, category: 'Handbags', name: 'Croco Minaudière', brand: 'MAISON VANEL',
    price: 8200, originalPrice: null,
    description: 'Genuine niloticus crocodile, gold-plated brass frame. Evening clutch, limited run.',
    badge: 'Limited Edition', emoji: '👛', accent: '#7a6a40',
    details: { material: 'Nile crocodile (CITES certified)', hardware: '18k gold-plated brass frame', lining: 'Ivory silk', dimensions: '22 × 12 × 4 cm', closure: 'Push-lock clasp', strap: 'Removable gold chain, 80cm', edition: '12 pieces worldwide', origin: 'Paris, France', reference: 'MV-CM-012' },
  },
  {
    id: 17, category: 'Handbags', name: 'Toile Monogram Tote', brand: 'MAISON VANEL',
    price: 3100, originalPrice: null,
    description: 'Signature woven toile canvas, calfskin trim, gold hardware. A Parisian staple.',
    badge: null, emoji: '🛍️', accent: '#b8a87c',
    details: { material: 'Woven toile canvas, calfskin leather trim', hardware: 'Gold-tone brass', lining: 'Cotton canvas with zipper pocket', dimensions: '38 × 30 × 14 cm', straps: 'Double leather handles, 24cm drop', closure: 'Open top with magnetic snap', origin: 'Paris, France', reference: 'MV-TMT-038' },
  },
  {
    id: 18, category: 'Handbags', name: 'Python Kelly', brand: 'MAISON VANEL',
    price: 14600, originalPrice: null,
    description: 'Diamond python skin, palladium hardware, hand-stitched turnlock. Made to order.',
    badge: 'Bespoke', emoji: '👜', accent: '#6b8a6b',
    details: { material: 'Diamond python (CITES certified)', hardware: 'Palladium-plated brass', stitching: 'Saddle-stitched by hand, linen thread', dimensions: '35 × 25 × 10 cm', lock: 'Turnlock with key and padlock', lining: 'Chevre goatskin', leadTime: '10–14 weeks', origin: 'Paris, France', reference: 'MV-PK-BESPOKE' },
  },
  {
    id: 19, category: 'Perfume', name: 'Iris Gris Absolu', brand: 'NÉRON PARIS',
    price: 1200, originalPrice: null,
    description: 'Orris butter from Tuscany, vetiver, grey musk. A powdery architectural fragrance.',
    badge: 'New Arrival', emoji: '🌸', accent: '#b0a0c8',
    details: { concentration: 'Extrait de Parfum (35% aromatic compounds)', topNotes: 'Bergamot, green aldehydes', heartNotes: 'Tuscan orris butter, violet leaf', baseNotes: 'Haitian vetiver, grey musk, ambrette', volume: '50ml', longevity: '16–24 hours', origin: 'Grasse, France', reference: 'NP-IGA-050' },
  },
  {
    id: 20, category: 'Perfume', name: 'Cuir de Russie', brand: 'NÉRON PARIS',
    price: 780, originalPrice: null,
    description: 'Birch tar, leather accord, aldehydes. A cold-weather icon revived for the modern age.',
    badge: null, emoji: '🍂', accent: '#8b5e3c',
    details: { concentration: 'Eau de Parfum (22%)', topNotes: 'Bergamot, aldehydes, neroli', heartNotes: 'Leather accord, birch tar, iris', baseNotes: 'Ambergris, vetiver, castoreum', volume: '100ml', longevity: '10–14 hours', origin: 'Grasse, France', reference: 'NP-CDR-100' },
  },
  {
    id: 21, category: 'Perfume', name: 'Ambre Nomade', brand: 'NÉRON PARIS',
    price: 920, originalPrice: 1050,
    description: 'Laotian benzoin, labdanum absolute, saffron. A warm desert accord.',
    badge: 'Special Price', emoji: '✦', accent: '#c8882c',
    details: { concentration: 'Eau de Parfum (25%)', topNotes: 'Saffron, cardamom, pink pepper', heartNotes: 'Labdanum, rose otto, patchouli', baseNotes: 'Laotian benzoin, amber, vanilla absolute', volume: '100ml', longevity: '12–16 hours', origin: 'Grasse, France', reference: 'NP-AN-100' },
  },
  {
    id: 22, category: 'Shoes', name: 'Opera Pump', brand: 'CALLISTO BESPOKE',
    price: 2400, originalPrice: null,
    description: 'Patent calfskin opera pump, 90mm stiletto heel, hand-lasted on your personal form.',
    badge: 'Bespoke', emoji: '👠', accent: '#c03050',
    details: { material: 'Patent calfskin leather', heel: '90mm stiletto, lacquered wood', sole: 'Leather outsole, rubber heel tip', construction: 'Blake-stitched, hand-lasted', lining: 'Full leather lining, padded insole', last: 'Personal last created at first fitting', leadTime: '8–12 weeks', origin: 'Florence, Italy', reference: 'CB-OP-BESPOKE' },
  },
  {
    id: 23, category: 'Shoes', name: 'Monk Strap Cognac', brand: 'CALLISTO BESPOKE',
    price: 2100, originalPrice: null,
    description: 'Double monk strap in cognac museum calf. Blake-stitched, cedar shoe trees included.',
    badge: null, emoji: '👟', accent: '#9b6b3c',
    details: { material: 'Museum calf leather, cognac colour', sole: 'Single leather sole, rubber insert', construction: 'Blake-stitched', last: 'Elegant Oxford, narrow width', buckles: 'Double monk strap, brass hardware', extras: 'Cedar shoe trees included', lining: 'Full leather lining', origin: 'Florence, Italy', reference: 'CB-MSC-210' },
  },
  {
    id: 24, category: 'Shoes', name: 'Velvet Loafer', brand: 'CALLISTO BESPOKE',
    price: 1750, originalPrice: 2000,
    description: 'Silk velvet upper, leather sole, gold horse-bit. Perfect for black tie evenings.',
    badge: 'Special Price', emoji: '🥿', accent: '#4a3070',
    details: { material: 'Silk velvet upper, midnight navy', sole: 'Single leather sole, hand-stitched', hardware: '18k gold-plated brass horse-bit', construction: 'Cemented', lining: 'Leather and suede lining', heel: '18mm', origin: 'Florence, Italy', reference: 'CB-VL-175' },
  },
  {
    id: 25, category: 'Accessories', name: 'Alligator Belt', brand: 'MAISON VANEL',
    price: 1480, originalPrice: null,
    description: 'Full-grain alligator leather, 18k gold buckle. Sizes 70–110cm, made to order.',
    badge: null, emoji: '🪢', accent: '#5a4a2c',
    details: { material: 'Mississippi alligator (CITES certified)', buckle: '18k gold-plated solid brass', width: '30mm', thickness: '3.5mm', sizes: '70–110cm, half-size increments', finish: 'Matte, natural scale pattern', lining: 'Calfskin leather', origin: 'Paris, France', reference: 'MV-AB-BESPOKE' },
  },
  {
    id: 26, category: 'Accessories', name: 'Cashmere Travel Wrap', brand: 'MAISON VANEL',
    price: 890, originalPrice: null,
    description: 'Grade A Mongolian cashmere, 200×90cm. Reversible ivory and midnight blue.',
    badge: 'Artisan Craft', emoji: '🧥', accent: '#a8b8c8',
    details: { material: 'Grade A Mongolian cashmere, 2-ply', dimensions: '200 × 90 cm', weight: '280g', colours: 'Reversible: ivory and midnight blue', finish: 'Brushed, hand-hemmed edges', care: 'Hand wash cold or dry clean', origin: 'Mongolia · Lyon', reference: 'MV-CTW-200' },
  },
  {
    id: 27, category: 'Accessories', name: 'Cufflinks Émail Bleu', brand: 'LUMIÈRE PARIS',
    price: 2200, originalPrice: null,
    description: 'Grand feu enamel in cobalt blue, 18k white gold setting, toggleback closure.',
    badge: null, emoji: '🔵', accent: '#1a4a8a',
    details: { metal: '18k white gold', enamel: 'Grand feu enamel, cobalt blue, hand-fired', face: '16mm round', closure: 'Whalebone toggleback', finishing: 'High polish setting, brushed back', weight: '8g per pair', origin: 'Paris, France', reference: 'LP-CEB-001' },
  },
  {
    id: 28, category: 'Accessories', name: 'Leather Portfolio', brand: 'MAISON VANEL',
    price: 1950, originalPrice: null,
    description: 'Full-grain black calfskin, 24 card slots, document sleeve. Engraving included.',
    badge: 'New Arrival', emoji: '🗂️', accent: '#2a2a2a',
    details: { material: 'Full-grain French calfskin, black', slots: '24 card slots, 6 hidden pockets', sleeve: 'Document sleeve, A4/letter format', dimensions: '22 × 12 × 2 cm', closure: 'Press-stud button', engraving: 'Complimentary initials (up to 3 characters)', origin: 'Paris, France', reference: 'MV-LP-001' },
  },
  {
    id: 29, category: 'Watches', name: 'Régulateur Acier', brand: 'AURIS MAISON',
    price: 19500, originalPrice: null,
    description: 'Regulator display with separate seconds, minutes, and hours. Brushed steel case.',
    badge: null, emoji: '⌚', accent: '#8a9aaa',
    details: { movement: 'Cal. AM-300R, manual-winding regulator display', case: 'Brushed 316L steel, 40mm, 50m WR', dial: 'Silver sector dial, blued steel hands', crystal: 'Flat sapphire, single AR coating', strap: 'Steel mesh bracelet with butterfly clasp', powerReserve: '48 hours', origin: 'Swiss Made · Le Brassus', reference: 'AM-RA-195' },
  },
  {
    id: 30, category: 'Jewelry', name: 'Bague Chevalière', brand: 'LUMIÈRE PARIS',
    price: 4800, originalPrice: null,
    description: 'Signet ring in 18k yellow gold, hand-engraved heraldic motif. Personalised.',
    badge: null, emoji: '💍', accent: '#c8a832',
    details: { metal: '18k yellow gold', face: '18 × 15mm oval table', engraving: 'Hand-engraved heraldic motif, personalised', shank: '4mm, comfort-fit', weight: '22g (size 58)', sizing: 'Available 50–68, half sizes', leadTime: '4–6 weeks for engraving', origin: 'Paris, France', reference: 'LP-BCH-BESPOKE' },
  },
  {
    id: 31, category: 'Handbags', name: 'Sac Pochette Soirée', brand: 'MAISON VANEL',
    price: 2650, originalPrice: null,
    description: 'Ivory satin with hand-beaded floral motif. Gold chain strap, silk-lined interior.',
    badge: 'New Arrival', emoji: '👛', accent: '#e8dcc8',
    details: { material: 'Duchesse satin, ivory', embellishment: 'Hand-beaded floral motif, glass seed beads', hardware: '18k gold-plated chain, 80cm', lining: 'Ivory silk charmeuse', dimensions: '24 × 14 × 4 cm', closure: 'Magnetic clasp', care: 'Professional cleaning only', origin: 'Paris, France', reference: 'MV-SPS-001' },
  },
  {
    id: 32, category: 'Perfume', name: 'Vétiver Encens', brand: 'NÉRON PARIS',
    price: 840, originalPrice: null,
    description: 'Haitian vetiver, church incense, smoked cedar. A meditative, unisex composition.',
    badge: null, emoji: '🕯️', accent: '#6a7a5a',
    details: { concentration: 'Eau de Parfum (22%)', topNotes: 'Green vetiver, black pepper', heartNotes: 'Church incense, olibanum', baseNotes: 'Smoked cedar, patchouli, oakmoss', volume: '100ml', longevity: '10–14 hours', origin: 'Grasse, France', reference: 'NP-VE-100' },
  },
  {
    id: 33, category: 'Shoes', name: 'Chelsea Boot Suède', brand: 'CALLISTO BESPOKE',
    price: 2250, originalPrice: null,
    description: 'Midnight suede Chelsea boot, elastic gore, leather insole. Hand-welted in Florence.',
    badge: 'Bestseller', emoji: '🥾', accent: '#2c2c4a',
    details: { material: 'Water-resistant midnight suede', gore: 'Elastic side panels, hand-stitched', sole: 'Dainite rubber sole', construction: 'Hand-welted', heel: '32mm stacked leather', lining: 'Full leather lining', insole: 'Cushioned leather insole', origin: 'Florence, Italy', reference: 'CB-CBS-225' },
  },
  {
    id: 34, category: 'Accessories', name: 'Montre Gousset', brand: 'AURIS MAISON',
    price: 7400, originalPrice: null,
    description: 'Pocket watch in sterling silver, hunter case, Roman numerals. A timeless heirloom.',
    badge: null, emoji: '🕰️', accent: '#c0c0c0',
    details: { movement: 'Manual-winding, 17 jewels, adjusted 5 positions', case: 'Sterling silver, 52mm hunter case', dial: 'White enamel, Roman numerals, blued hands', crystal: 'Mineral glass, anti-reflective', chain: 'Sterling silver Albert chain, 30cm', powerReserve: '36 hours', origin: 'Swiss Made · La Chaux-de-Fonds', reference: 'AM-MG-001' },
  },
  {
    id: 35, category: 'Jewelry', name: 'Collier Rivière Diamants', brand: 'LUMIÈRE PARIS',
    price: 31000, originalPrice: null,
    description: '47 round brilliant diamonds totalling 8.4ct. 18k white gold rivière, 42cm.',
    badge: 'Haute Joaillerie', emoji: '💎', accent: '#e8f0f8',
    details: { metal: '18k white gold', stones: '47 round brilliant diamonds, 8.4ct total, D–E VVS1', setting: 'Shared-prong rivière, hand-set', length: '42cm with additional extension', clasp: '18k white gold box clasp with safety', totalWeight: '18.2g', certification: 'GIA individual certificates for 5 anchor stones', origin: 'Paris, France', reference: 'LP-CRD-840' },
  },
  {
    id: 36, category: 'Handbags', name: 'Besace Cuir Végétal', brand: 'MAISON VANEL',
    price: 3800, originalPrice: null,
    description: 'Vegetable-tanned French calf, brass hardware. Ages beautifully with daily use.',
    badge: null, emoji: '🎒', accent: '#b89060',
    details: { material: 'Vegetable-tanned Chamonix calf, natural', hardware: 'Solid brass, unlacquered', dimensions: '36 × 26 × 10 cm', strap: 'Adjustable leather strap, 80–130cm', closure: 'Brass buckle with leather loop', lining: 'Cotton canvas', aging: 'Develops rich patina over years of use', origin: 'Paris, France', reference: 'MV-BCV-038' },
  },
  {
    id: 37, category: 'Perfume', name: 'Rose Absolue de Mai', brand: 'NÉRON PARIS',
    price: 1650, originalPrice: null,
    description: 'Rosa centifolia absolute from Grasse, 50ml. One of the rarest perfume ingredients.',
    badge: 'Rare Edition', emoji: '🌹', accent: '#e05870',
    details: { concentration: 'Extrait de Parfum (40% aromatic compounds)', mainIngredient: 'Rosa centifolia absolute, Grasse — 2 tons of petals per kg', topNotes: 'Aldehydes, lychee, citrus', heartNotes: 'Rose centifolia absolute, geranium', baseNotes: 'Musk, vetiver, benzoin', volume: '50ml', batch: 'Annual limited release, ~120 flacons', origin: 'Grasse, France', reference: 'NP-RADM-050' },
  },
  {
    id: 38, category: 'Accessories', name: 'Chapeau Fedora Feutre', brand: 'MAISON VANEL',
    price: 560, originalPrice: null,
    description: 'Hand-blocked rabbit felt fedora, grosgrain ribbon, satin lining. Sizes 54–60.',
    badge: null, emoji: '🎩', accent: '#3a3020',
    details: { material: 'Rabbit felt, charcoal brown', brim: '7cm, curved', ribbon: 'Moiré grosgrain, 3cm', lining: 'Striped cotton satin', blocking: 'Hand-blocked on wooden form', sizing: 'Available 54–60 (half sizes)', care: 'Steam only, store on a hat stand', origin: 'Paris, France', reference: 'MV-CFF-001' },
  },
  {
    id: 39, category: 'Watches', name: 'Chronographe Flyback', brand: 'AURIS MAISON',
    price: 36500, originalPrice: null,
    description: 'Flyback chronograph, column wheel, vertical clutch. Salmon dial, 42mm.',
    badge: null, emoji: '⌚', accent: '#e8a070',
    details: { movement: 'Cal. AM-CF42, flyback chronograph, column wheel', case: '18k rose gold, 42mm, 30m WR', dial: 'Salmon guilloché, applied gold hour markers', chronograph: 'Flyback function, 30-min counter at 3, seconds at 9', crystal: 'Domed sapphire, double AR coating', strap: 'Tan alligator, 18k rose gold deployant', powerReserve: '60 hours', origin: 'Swiss Made · Le Brassus', reference: 'AM-CF-365' },
  },
];

const CATEGORIES = ['All', 'Watches', 'Jewelry', 'Handbags', 'Perfume', 'Shoes', 'Accessories'];

const fmt = (n) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const scrollTo = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

const fmtKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

// ── PROFILE DRAWER
function ProfileDrawer({ onClose }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [errors, setErrors] = useState({});
  const [loggedIn, setLoggedIn] = useState(false);

  const validateLogin = () => {
    const e = {};
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (form.password.length < 6) e.password = 'Min. 6 characters';
    return e;
  };
  const validateRegister = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (form.password.length < 6) e.password = 'Min. 6 characters';
    return e;
  };

  const handleSubmit = () => {
    const e = tab === 'login' ? validateLogin() : validateRegister();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoggedIn(true);
  };

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(ev) => setForm({ ...form, [key]: ev.target.value })}
        placeholder={placeholder}
      />
      {errors[key] && <span className="form-error">{errors[key]}</span>}
    </div>
  );

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="profile-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cart-header">
          <h3>{loggedIn ? 'My Account' : 'Private Access'}</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>

        {loggedIn ? (
          <div className="profile-body">
            <div className="profile-logged-in">
              <div className="profile-avatar-large">✦</div>
              <div className="profile-email">{form.email}</div>
              <div className="profile-member-badge">Member · Maison Auris</div>
            </div>
            <div className="profile-menu">
              {['My Orders', 'Bespoke Commissions', 'Wishlist', 'Address Book', 'Preferences'].map((item) => (
                <button key={item} className="profile-menu-item">{item} <span>→</span></button>
              ))}
            </div>
            <button
              className="continue-btn"
              style={{ marginTop: '1rem' }}
              onClick={() => { setLoggedIn(false); setForm({ email: '', password: '', name: '' }); }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="profile-body">
            <div className="profile-welcome">
              <div className="profile-avatar-large">◉</div>
              <p className="profile-tagline">
                Access your orders, bespoke commissions and private client services.
              </p>
            </div>
            <div className="profile-tabs">
              <button
                className={`profile-tab ${tab === 'login' ? 'active' : ''}`}
                onClick={() => { setTab('login'); setErrors({}); }}
              >
                Sign In
              </button>
              <button
                className={`profile-tab ${tab === 'register' ? 'active' : ''}`}
                onClick={() => { setTab('register'); setErrors({}); }}
              >
                Create Account
              </button>
            </div>
            {tab === 'register' && field('name', 'Full Name', 'text', 'Alexandre Beaumont')}
            {field('email', 'Email', 'email', 'alexandre@maison.fr')}
            {field('password', 'Password', 'password', '••••••••')}
            <button className="checkout-btn" style={{ marginTop: '0.5rem' }} onClick={handleSubmit}>
              {tab === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
            {tab === 'login' && (
              <button className="profile-forgot">Forgot password?</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── INFO MODAL
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
  const navigate = useNavigate();
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
                  <div
                    className="search-result-name"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { onClose(); navigate(`/product/${p.id}`); }}
                  >
                    {p.name}
                  </div>
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

// ── SORT DROPDOWN
const SORT_OPTIONS = [
  { value: 'default',    label: 'Featured' },
  { value: 'price-asc',  label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'alpha-asc',  label: 'Name: A → Z' },
  { value: 'alpha-desc', label: 'Name: Z → A' },
];

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SORT_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="sort-dropdown" ref={ref}>
      <button
        className={`sort-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sort-trigger-label">
          <span className="sort-trigger-prefix">Sort</span>
          <span className="sort-trigger-value">{current.label}</span>
        </span>
        <svg className="sort-chevron" width="10" height="6" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="sort-menu">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`sort-option ${opt.value === value ? 'active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.value === value && <span className="sort-option-tick">✦</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PRODUCT CARD
function ProductCard({ product, onAdd, onView }) {
  const navigate = useNavigate();
  const [hovering, setHovering] = useState(false);
  const [added, setAdded] = useState(false);
  const viewedRef = useRef(false);

  const handleAdd = (e) => {
    e.stopPropagation();
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
      onClick={() => navigate(`/product/${product.id}`)}
      style={{ '--accent': product.accent, cursor: 'pointer' }}
    >
      {product.badge && <div className="product-badge">{product.badge}</div>}
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
      <button className={`add-to-cart ${added ? 'added' : ''}`} onClick={handleAdd}>
        {added ? '✓ In der Auswahl' : 'Add to Cart'}
      </button>
    </div>
  );
}

// ── PRODUCT DETAIL (sticky-visual layout)
function ProductDetail({ product, onAdd }) {
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleAdd = () => {
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="detail-page">
      <div className="detail-layout">

        {/* LEFT — sticky visual, doesn't scroll */}
        <div className="detail-visual-panel" style={{ '--accent': product.accent }}>
          <div
            className="detail-visual-bg"
            style={{ background: `radial-gradient(circle at 50% 50%, ${product.accent}55, transparent 65%)` }}
          />
          <div className="detail-emoji">{product.emoji}</div>
          {product.badge && <div className="detail-badge">{product.badge}</div>}
        </div>

        {/* RIGHT — scrollable info */}
        <div className="detail-info-panel">
          <button className="detail-back" onClick={() => navigate(-1)}>
            ← Back to Collection
          </button>
          <div className="detail-overline">{product.category}</div>
          <div className="detail-brand">{product.brand}</div>
          <h1 className="detail-name">{product.name}</h1>
          <div className="detail-pricing">
            <span className="detail-price">{fmt(product.price)}</span>
            {product.originalPrice && (
              <span className="detail-original">{fmt(product.originalPrice)}</span>
            )}
          </div>
          <p className="detail-desc">{product.description}</p>
          <button
            className={`detail-add-btn ${added ? 'added' : ''}`}
            onClick={handleAdd}
          >
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
                  <span className="detail-spec-key">{fmtKey(k)}</span>
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

// ── PRODUCT PAGE (route component)
function ProductPage({ addToCart }) {
  const { id } = useParams();
  const product = PRODUCTS.find((p) => p.id === parseInt(id, 10));
  if (!product) return <Navigate to="/" replace />;
  return <ProductDetail product={product} onAdd={addToCart} />;
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
    } else { setStep(2); }
  };

  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExpiry = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && step !== 3 && onClose()}>
      <div className="modal">
        {step < 3 && (
          <div className="modal-progress">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1 · Details</div>
            <div className="progress-line"><div className="progress-fill" style={{ width: step >= 2 ? '100%' : '0%' }} /></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2 · Payment</div>
            <div className="progress-line"><div className="progress-fill" style={{ width: step >= 3 ? '100%' : '0%' }} /></div>
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3 · Confirm</div>
          </div>
        )}

        {step === 1 && (
          <>
            <h2 className="modal-title">Shipping Details</h2>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alexandre Beaumont" />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alexandre@maison.fr" />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label>Delivery Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="16 Avenue Montaigne, 75008 Paris" />
              {errors.address && <span className="form-error">{errors.address}</span>}
            </div>
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

        {step === 2 && !processing && (
          <>
            <h2 className="modal-title">Secure Payment</h2>
            <div className="secure-badge">🔒 256-bit SSL Encrypted · PCI DSS Compliant</div>
            <div className="form-group">
              <label>Card Number</label>
              <input value={form.card} onChange={(e) => setForm({ ...form, card: fmtCard(e.target.value) })} placeholder="4242 4242 4242 4242" maxLength={19} />
              {errors.card && <span className="form-error">{errors.card}</span>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expiry</label>
                <input value={form.expiry} onChange={(e) => setForm({ ...form, expiry: fmtExpiry(e.target.value) })} placeholder="MM/YY" maxLength={5} />
                {errors.expiry && <span className="form-error">{errors.expiry}</span>}
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input type="password" value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="•••" maxLength={3} />
                {errors.cvv && <span className="form-error">{errors.cvv}</span>}
              </div>
            </div>
            <div className="order-summary" style={{ marginTop: '1.2rem' }}>
              <div className="summary-row total"><span>Total Charge</span><span>{fmt(total + tax)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="modal-btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button className="modal-btn" onClick={handleNext} style={{ flex: 1 }}>Complete Purchase →</button>
            </div>
          </>
        )}

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

        {step === 3 && (
          <div className="success-screen">
            <div className="success-icon-wrap">
              <div className="success-icon">✦</div>
            </div>
            <h2>Purchase Confirmed</h2>
            <p className="success-msg">Merci, <strong>{form.name}</strong>.</p>
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

// ── SHOP PAGE (main content: hero, catalog, footer)
function ShopPage({ onAdd, openMailson, openBespoke, openAtelier, openContact, setInfoModal }) {
  const canvasRef = useRef(null);
  useAlgorithmicArt(canvasRef, 7331);

  const [heroVisible, setHeroVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const recsTimerRef = useRef(null);
  const recsAbortRef = useRef(null);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100); }, []);

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
      if (recs === null) return;
      if (recs.length === 0) return;
      setRecommendations(recs);
    }, 800);
  }, []);

  const addToCart = useCallback((product) => {
    onAdd(product);
    refreshRecommendations();
  }, [onAdd, refreshRecommendations]);

  const filtered = PRODUCTS.filter((p) => {
    const catMatch = activeCategory === 'All' || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const searchMatch = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return catMatch && searchMatch;
  }).slice().sort((a, b) => {
    if (sortOrder === 'alpha-asc') return a.name.localeCompare(b.name);
    if (sortOrder === 'alpha-desc') return b.name.localeCompare(a.name);
    if (sortOrder === 'price-asc') return a.price - b.price;
    if (sortOrder === 'price-desc') return b.price - a.price;
    return 0;
  });

  return (
    <>
      {/* ── HERO */}
      <div className="hero">
        <canvas ref={canvasRef} className="hero-canvas" />
        <div className={`hero-content ${heroVisible ? 'visible' : ''}`}>
          <div className="hero-overline">MAISON AURIS · EST. MMXIX</div>
          <h1 className="hero-title">
            <span>L'Art du</span>
            <span className="hero-gold">Luxe</span>
          </h1>
          <p className="hero-tagline">Curated objects of desire. Crafted for those who know.</p>
          <div className="hero-cta-group">
            <button className="hero-cta primary" onClick={() => scrollTo('catalog')}>Explore Collection</button>
            <button className="hero-cta secondary" onClick={openMailson}>Our Maisons</button>
          </div>
        </div>
        <div className="hero-scroll-hint" onClick={() => scrollTo('catalog')}>
          <div className="scroll-line" />
          <span>Scroll</span>
        </div>
      </div>

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

      {/* ── RECOMMENDATIONS */}
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
                <ProductCard key={`rec-${p.id}`} product={p} onAdd={addToCart} onView={(prod) => { trackEvent('view', prod); refreshRecommendations(); }} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── CATALOG */}
      <section id="catalog" className="catalog">
        <div className="catalog-header">
          <h2 className="catalog-title">The Collection</h2>
          <p className="catalog-subtitle">Objects of singular craftsmanship, selected from the world's finest maisons.</p>
        </div>
        <div className="filters">
          <div className="category-filters">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat);
                  if (cat !== 'All') { trackEvent('filter', { category: cat }); refreshRecommendations(); }
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="filter-right">
            <SortDropdown value={sortOrder} onChange={setSortOrder} />
            <input
              className="search-input"
              placeholder="Search pieces…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>}
          </div>
        </div>
        <div className="product-count">
          {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'} found
          {activeCategory !== 'All' && ` in ${activeCategory}`}
        </div>
        {filtered.length > 0 ? (
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={addToCart} onView={(prod) => { trackEvent('view', prod); refreshRecommendations(); }} />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <p>No pieces match your search.</p>
            <button className="cat-btn active" onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>Show All Pieces</button>
          </div>
        )}
      </section>

      {/* ── FEATURES STRIP */}
      <section className="features">
        {[
          { icon: '🚁', title: 'White Glove Delivery', desc: 'Private courier to your door, worldwide.', action: openContact },
          { icon: '🔐', title: 'Certificate of Authenticity', desc: 'Every piece verified and documented.', action: null },
          { icon: '🔄', title: '30-Day Returns', desc: 'No questions asked return policy.', action: openContact },
          { icon: '📞', title: 'Private Concierge', desc: 'Dedicated client advisor, 24/7.', action: openContact },
        ].map((f, i) => (
          <div key={i} className={`feature-card ${f.action ? 'clickable' : ''}`} onClick={f.action || undefined}>
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
          <button className="footer-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AURIS</button>
          <div className="footer-tagline">Maison de Luxe · Paris · Geneva · Tokyo</div>
        </div>
        <div className="footer-links">
          <button onClick={openContact}>Contact</button>
          <button onClick={openBespoke}>Bespoke</button>
          <button onClick={openMailson}>Maisons</button>
          <button onClick={openAtelier}>Atelier</button>
          <button onClick={() => setInfoModal({ title: 'Privacy Policy', content: <div className="info-content"><p className="info-text">We collect only what is necessary to process your order and provide our concierge service. Your data is never sold to third parties. Full policy available on request.</p></div> })}>Privacy</button>
          <button onClick={() => setInfoModal({ title: 'Legal Notice', content: <div className="info-content"><p className="info-text">AURIS MAISON SAS · 16 Avenue Montaigne · 75008 Paris · France. SIRET: 123 456 789 00010. VAT: FR12345678900. All prices include applicable taxes.</p></div> })}>Legal</button>
        </div>
        <div className="footer-copy">© 2026 Auris Maison. All rights reserved.</div>
      </footer>
    </>
  );
}

// ── MAIN APP
export default function App() {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const anyOpen = cartOpen || checkoutOpen || searchOpen || !!infoModal || profileOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen, checkoutOpen, searchOpen, infoModal, profileOpen]);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    trackEvent('cart_add', product);
    setCartOpen(true);
  }, []);

  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), []);
  const updateQty = useCallback((id, delta) => setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)), []);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const handleCheckoutSuccess = () => {
    clearHistory();
    setTimeout(() => setCart([]), 3500);
  };

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
        <p className="info-text">Every piece in our collection can be made entirely to your specification. From engraved watch cases to hand-painted shoe patinas — your vision, our craft.</p>
        <div className="info-steps">
          {[
            { n: '01', title: 'Private Consultation', desc: 'A dedicated advisor contacts you within 48 hours.' },
            { n: '02', title: 'Design & Selection', desc: 'Materials, dimensions, finishes — all chosen by you.' },
            { n: '03', title: 'Artisan Production', desc: 'Handcrafted in the maison atelier. 4–16 weeks.' },
            { n: '04', title: 'White Glove Delivery', desc: 'Your piece arrives in a custom presentation case.' },
          ].map((s) => (
            <div key={s.n} className="info-step">
              <div className="info-step-n">{s.n}</div>
              <div><div className="info-step-title">{s.title}</div><div className="info-step-desc">{s.desc}</div></div>
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
        <p className="info-text">Step inside our virtual atelier — a space where centuries of craft meet contemporary vision. Each maison maintains a dedicated workshop where masters pass their skills to the next generation.</p>
        <div className="info-grid">
          {[
            { emoji: '🔨', title: 'Hand-Finishing', desc: 'Every surface touched by skilled hands before delivery.' },
            { emoji: '🔬', title: 'Swiss Precision', desc: '1/100mm tolerances in our watchmaking workshops.' },
            { emoji: '🧵', title: 'Saddle Stitch', desc: 'Hand-stitched leather goods that last a lifetime.' },
            { emoji: '🌿', title: 'Sustainable Materials', desc: 'Responsibly sourced from certified suppliers only.' },
          ].map((item) => (
            <div key={item.title} className="info-grid-card">
              <div className="info-grid-emoji">{item.emoji}</div>
              <div className="info-grid-title">{item.title}</div>
              <div className="info-grid-desc">{item.desc}</div>
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
        <p className="info-text">Our private client advisors are available around the clock to assist with purchases, bespoke orders, and any enquiries.</p>
        <div className="info-contact-list">
          {[
            { icon: '📞', label: 'Phone', value: '+33 1 42 65 00 00' },
            { icon: '✉️', label: 'Email', value: 'concierge@aurismaison.com' },
            { icon: '💬', label: 'WhatsApp', value: '+33 6 12 34 56 78' },
            { icon: '🕐', label: 'Hours', value: '24 / 7 · Every day of the year' },
          ].map((c) => (
            <div key={c.label} className="info-contact-row">
              <span className="info-contact-icon">{c.icon}</span>
              <div><div className="info-contact-label">{c.label}</div><div className="info-contact-value">{c.value}</div></div>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  return (
    <div className="shop">

      {/* ── NAV */}
      <nav className="nav">
        <button className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AURIS</button>
        <div className="nav-links">
          <button className="nav-link-btn" onClick={() => scrollTo('catalog')}>Collection</button>
          <button className="nav-link-btn" onClick={openMailson}>Maisons</button>
          <button className="nav-link-btn" onClick={openBespoke}>Bespoke</button>
          <button className="nav-link-btn" onClick={openAtelier}>Atelier</button>
        </div>
        <div className="nav-actions">
          <button className="nav-search-btn" aria-label="search" onClick={() => setSearchOpen(true)}>⌕</button>
          <button className="nav-profile-btn" aria-label="profile" onClick={() => setProfileOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </button>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            <span className="cart-icon">🛍</span>
            <span className="cart-label">Cart</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)}>
          {mobileMenuOpen ? '×' : '☰'}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <button onClick={() => { scrollTo('catalog'); setMobileMenuOpen(false); }}>Collection</button>
          <button onClick={() => { openMailson(); setMobileMenuOpen(false); }}>Maisons</button>
          <button onClick={() => { openBespoke(); setMobileMenuOpen(false); }}>Bespoke</button>
          <button onClick={() => { openAtelier(); setMobileMenuOpen(false); }}>Atelier</button>
          <button onClick={() => { openContact(); setMobileMenuOpen(false); }}>Concierge</button>
        </div>
      )}

      {/* ── ROUTES */}
      <Routes>
        <Route path="/" element={
          <ShopPage
            onAdd={addToCart}
            openMailson={openMailson}
            openBespoke={openBespoke}
            openAtelier={openAtelier}
            openContact={openContact}
            setInfoModal={setInfoModal}
          />
        } />
        <Route path="/product/:id" element={<ProductPage addToCart={addToCart} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
                <button className="cat-btn active" style={{ marginTop: '1rem' }} onClick={() => { setCartOpen(false); scrollTo('catalog'); }}>Browse Collection</button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => <CartItem key={item.id} item={item} onRemove={removeFromCart} onQty={updateQty} />)}
                </div>
                <div className="cart-footer">
                  <div className="cart-total-row">
                    <span>Subtotal</span>
                    <span className="cart-total-amount">{fmt(cartTotal)}</span>
                  </div>
                  <div className="cart-tax-note">VAT & delivery calculated at checkout</div>
                  <button className="checkout-btn" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Proceed to Checkout →</button>
                  <button className="continue-btn" onClick={() => setCartOpen(false)}>Continue Shopping</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHECKOUT MODAL */}
      {checkoutOpen && (
        <CheckoutModal cart={cart} onClose={() => setCheckoutOpen(false)} onSuccess={handleCheckoutSuccess} />
      )}

      {/* ── PROFILE DRAWER */}
      {profileOpen && <ProfileDrawer onClose={() => setProfileOpen(false)} />}

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
