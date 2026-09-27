// HTML/CSS label designs used to render the sample labels.
// Every design is deliberately different (fonts, colours, layout) so the OCR
// pipeline is exercised on serif, script, condensed, thin and light-on-dark type.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.resolve(here, '../../node_modules/@fontsource');

const FONTS = [
  ['Playfair Display', 'playfair-display', [400, 700, 900]],
  ['Libre Baskerville', 'libre-baskerville', [400, 700], true],
  ['Oswald', 'oswald', [400, 500, 700]],
  ['Bebas Neue', 'bebas-neue', [400]],
  ['Cinzel', 'cinzel', [400, 700, 900]],
  ['Great Vibes', 'great-vibes', [400]],
  ['Arimo', 'arimo', [400, 700]],
  ['Abril Fatface', 'abril-fatface', [400]],
  ['Lobster', 'lobster', [400]],
  ['Montserrat', 'montserrat', [200, 300, 500, 700]],
  ['Josefin Sans', 'josefin-sans', [300, 600, 700]],
  ['EB Garamond', 'eb-garamond', [400, 600], true],
];

const fontFaces = FONTS.flatMap(([family, pkg, weights, italic]) =>
  weights.flatMap((w) =>
    [['normal'], ...(italic ? [['italic']] : [])].map(
      ([style]) => `@font-face{font-family:'${family}';font-style:${style};font-weight:${w};
        src:url('file://${fontDir}/${pkg}/files/${pkg}-latin-${w}-${style}.woff2') format('woff2');}`,
    ),
  ),
).join('\n');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function warningHtml(w, cls = '') {
  if (!w) return '';
  return `<p class="warning ${cls}"><span class="wh" style="font-weight:${w.headerBold ? 700 : 400}">${esc(w.header)}</span> ${esc(w.body)}</p>`;
}

const brandLines = (brand) => (Array.isArray(brand) ? brand : [brand]);

// ---------------------------------------------------------------------------
const designs = {
  bourbon: (l) => ({
    css: `
      .label{background:radial-gradient(ellipse at 50% 40%,#f7ecd2 0%,#ecdbb4 70%,#dcc594 100%);color:#3a2413;padding:26px}
      .b1{border:6px double #3a2413;height:100%;padding:10px}
      .b2{border:2px solid #b08a3e;height:100%;padding:34px 44px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .est{font:700 22px 'Cinzel';letter-spacing:10px;color:#7a5424}
      .brand0{font:900 132px/1 'Playfair Display';margin-top:26px;letter-spacing:2px}
      .brand1{font:700 70px/1 'Playfair Display';letter-spacing:12px;margin-top:6px}
      .orn{width:70%;height:2px;background:#3a2413;margin:26px 0 14px;position:relative}
      .orn:after{content:'';position:absolute;left:50%;top:-8px;width:14px;height:14px;background:#b08a3e;transform:translateX(-50%) rotate(45deg)}
      .tag{font:700 20px 'Cinzel';letter-spacing:6px;color:#7a5424;margin-top:10px}
      .class{font:italic 400 44px/1.15 'Libre Baskerville';margin-top:34px}
      .row{display:flex;justify-content:space-between;width:100%;font:400 34px 'Libre Baskerville';margin-top:40px}
      .bottler{font:400 21px/1.35 'Libre Baskerville';margin-top:34px;max-width:90%}
      .warning{font:400 17px/1.3 'Arimo';text-align:left;margin-top:auto;border-top:1.5px solid #3a2413;padding-top:12px}`,
    html: `<div class="b1"><div class="b2">
      <div class="est">EST. 1887</div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="orn"></div>
      <div class="tag">SMALL BATCH · HAND CRAFTED</div>
      <div class="class">${esc(l.classType)}</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      <div class="bottler">${esc(l.bottler)}</div>
      ${warningHtml(l.warning)}
    </div></div>`,
  }),

  gin: (l) => ({
    css: `
      .label{background:linear-gradient(160deg,#10263c 0%,#0b1b2c 100%);color:#d9b45a;padding:40px}
      .frame{border:3px solid #d9b45a;height:100%;padding:44px 48px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative}
      .frame:before{content:'';position:absolute;inset:10px;border:1px solid #8c7440}
      .fan{width:220px;height:110px;border-radius:220px 220px 0 0;background:repeating-conic-gradient(from 270deg at 50% 100%,#d9b45a 0 6deg,transparent 6deg 12deg);margin-top:12px;opacity:.85}
      .brand0{font:700 104px/1.05 'Cinzel';letter-spacing:4px;margin-top:30px;color:#e8c872}
      .class{font:600 46px 'Josefin Sans';letter-spacing:10px;margin-top:34px;color:#f1e6c8;text-transform:uppercase}
      .botan{font:300 24px 'Josefin Sans';letter-spacing:4px;margin-top:18px;color:#bca97a}
      .row{display:flex;gap:80px;font:600 36px 'Josefin Sans';letter-spacing:3px;margin-top:46px;color:#f1e6c8}
      .bottler{font:300 22px/1.4 'Josefin Sans';margin-top:40px;color:#e6dcc0}
      .warning{font:400 16px/1.32 'Arimo';text-align:left;margin-top:auto;color:#f3ecd8}`,
    html: `<div class="frame">
      <div class="fan"></div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="botan">JUNIPER · CORIANDER · ORRIS ROOT</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      <div class="bottler">${esc(l.bottler)}</div>
      ${warningHtml(l.warning)}
    </div>`,
  }),

  beer: (l) => ({
    css: `
      .label{background:linear-gradient(180deg,#0f7c7a 0%,#0b5e63 55%,#083f46 100%);color:#fff;padding:0;display:flex;flex-direction:column;align-items:center;text-align:center}
      .sun{position:absolute;top:210px;left:50%;width:360px;height:360px;margin-left:-180px;border-radius:50%;background:#f59f2a}
      .mtn{position:absolute;top:360px;left:0;right:0;height:260px;background:#063036;clip-path:polygon(0 100%,0 55%,18% 20%,32% 52%,50% 8%,66% 45%,82% 18%,100% 50%,100% 100%)}
      .top{position:relative;margin-top:60px;font:500 30px 'Oswald';letter-spacing:8px;color:#ffd48a}
      .brand0{position:relative;font:400 170px/0.95 'Bebas Neue';letter-spacing:4px;margin-top:10px;text-shadow:0 5px 0 #083f46}
      .class{position:relative;margin-top:300px;font:500 54px 'Oswald';letter-spacing:6px;text-transform:uppercase}
      .row{position:relative;display:flex;gap:90px;font:700 40px 'Oswald';margin-top:22px;color:#ffd48a}
      .bottler{position:relative;font:400 22px 'Oswald';letter-spacing:1px;margin-top:26px;color:#e8f4f2}
      .band{position:absolute;left:0;right:0;bottom:0;background:#062a30;padding:22px 60px}
      .warning{font:400 16px/1.3 'Arimo';text-align:left;color:#ffffff}`,
    html: `<div class="sun"></div><div class="mtn"></div>
      <div class="top">BEND · OREGON</div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      <div class="bottler">${esc(l.bottler)}</div>
      <div class="band">${warningHtml(l.warning)}</div>`,
  }),

  tequila: (l) => ({
    css: `
      .label{background:#fbfaf6;color:#123a7a;padding:30px}
      .tile{position:absolute;inset:0;background:
        radial-gradient(circle at 0 0,#1b4fa0 0 26px,transparent 27px) 0 0/70px 70px,
        radial-gradient(circle at 35px 35px,#e0a526 0 7px,transparent 8px) 0 0/70px 70px;opacity:.9}
      .panel{position:relative;background:#fbfaf6;height:100%;margin:0 14px;padding:50px 40px;border-left:4px solid #123a7a;border-right:4px solid #123a7a;display:flex;flex-direction:column;align-items:center;text-align:center}
      .brand0{font:400 118px/1 'Abril Fatface';color:#123a7a;margin-top:30px}
      .class{font:700 44px 'Montserrat';letter-spacing:8px;margin-top:36px;text-transform:uppercase;color:#1b4fa0}
      .agave{font:italic 400 28px 'EB Garamond';margin-top:14px;color:#6b5a2a}
      .row{display:flex;gap:60px;font:500 33px 'Montserrat';margin-top:52px}
      .country{font:700 30px 'Montserrat';letter-spacing:3px;margin-top:30px;text-transform:uppercase;color:#b3261e}
      .bottler{font:500 21px/1.4 'Montserrat';margin-top:26px;color:#123a7a}
      .warning{font:400 16px/1.3 'Arimo';text-align:left;margin-top:auto;color:#111}`,
    html: `<div class="tile"></div><div class="panel">
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="agave">100% de Agave · Hecho a mano</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      ${l.country ? `<div class="country">${esc(l.country)}</div>` : ''}
      <div class="bottler">${esc(l.bottler)}</div>
      ${warningHtml(l.warning)}
    </div>`,
  }),

  vodka: (l) => ({
    css: `
      .label{background:linear-gradient(180deg,#f4f7f9 0%,#e3eaef 100%);color:#16212b;padding:70px 64px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .star{width:90px;height:90px;background:#16212b;clip-path:polygon(50% 0,61% 38%,100% 50%,61% 62%,50% 100%,39% 62%,0 50%,39% 38%)}
      .brand0{font:300 96px/1.1 'Montserrat';letter-spacing:22px;margin-top:40px;margin-right:-22px}
      .class{font:500 60px 'Montserrat';letter-spacing:30px;margin-top:40px;margin-right:-30px;text-transform:uppercase}
      .line{width:120px;height:2px;background:#16212b;margin-top:40px}
      .sub{font:300 26px 'Montserrat';letter-spacing:6px;margin-top:30px}
      .row{display:flex;gap:70px;font:500 32px 'Montserrat';margin-top:60px}
      .bottler{font:300 21px/1.4 'Montserrat';margin-top:36px}
      .warning{font:400 16px/1.3 'Arimo';text-align:left;margin-top:auto;color:#16212b}`,
    html: `<div class="star"></div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="line"></div>
      <div class="sub">DISTILLED FROM WINTER WHEAT</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      <div class="bottler">${esc(l.bottler)}</div>
      ${warningHtml(l.warning)}`,
  }),

  scotch: (l) => ({
    css: `
      .label{background:#173d2c;padding:34px;color:#2a2112}
      .panel{background:linear-gradient(180deg,#f3ead3,#e8dcbc);height:100%;border-radius:10px;padding:46px 50px;display:flex;flex-direction:column;align-items:center;text-align:center;border:3px solid #b8964a}
      .crest{width:110px;height:130px;background:#173d2c;clip-path:polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)}
      .brand0{font:900 104px/1 'Cinzel';margin-top:30px;letter-spacing:3px;color:#173d2c}
      .class{font:600 38px/1.2 'EB Garamond';letter-spacing:5px;margin-top:28px;text-transform:uppercase}
      .age{font:italic 400 34px 'EB Garamond';margin-top:16px;color:#6b4f1d}
      .row{display:flex;gap:70px;font:600 34px 'EB Garamond';margin-top:42px}
      .country{font:600 28px 'EB Garamond';letter-spacing:4px;margin-top:22px;text-transform:uppercase;color:#173d2c}
      .bottler{font:400 23px/1.35 'EB Garamond';margin-top:24px}
      .warning{font:400 16px/1.3 'Arimo';text-align:left;margin-top:auto;color:#1c1a14}`,
    html: `<div class="panel">
      <div class="crest"></div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="age">Aged 12 Years</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      ${l.country ? `<div class="country">${esc(l.country)}</div>` : ''}
      <div class="bottler">${esc(l.bottler)}</div>
      ${warningHtml(l.warning)}
    </div>`,
  }),

  rum: (l) => ({
    css: `
      .label{background:linear-gradient(180deg,#ffcf5c 0%,#ff8a3d 45%,#c2413a 100%);color:#2b1606;padding:50px 56px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .palm{position:absolute;right:-40px;top:120px;width:300px;height:520px;background:#3b1f10;opacity:.18;clip-path:polygon(45% 100%,55% 100%,58% 30%,100% 18%,60% 22%,90% 0,55% 16%,40% 0,48% 18%,0 10%,44% 26%)}
      .top{font:500 28px 'Oswald';letter-spacing:10px;color:#5a2a0c}
      .brand0{position:relative;font:400 132px/1.05 'Lobster';margin-top:40px;color:#2b1606}
      .class{position:relative;font:700 58px 'Oswald';letter-spacing:10px;margin-top:40px;text-transform:uppercase}
      .spice{font:400 28px 'Oswald';letter-spacing:5px;margin-top:10px;color:#4a230a}
      .row{display:flex;gap:70px;font:500 36px 'Oswald';margin-top:56px}
      .bottler{font:400 23px/1.35 'Oswald';margin-top:34px}
      .warning{font:400 17px/1.3 'Arimo';text-align:left;margin-top:auto;color:#1a0d04}
      .tag{margin-top:auto;font:400 30px 'Lobster';color:#4a230a}`,
    html: `<div class="palm"></div>
      <div class="top">CARIBBEAN STYLE</div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="spice">VANILLA · CINNAMON · ORANGE PEEL</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      <div class="bottler">${esc(l.bottler)}</div>
      ${l.warning ? warningHtml(l.warning) : '<div class="tag">Sip slow, live easy.</div>'}`,
  }),

  wine: (l) => ({
    css: `
      .label{background:#fdfbf5;color:#2d2416;padding:36px}
      .frame{border:2px solid #b89b5e;height:100%;padding:60px 50px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative}
      .frame:before{content:'';position:absolute;inset:8px;border:1px solid #d9c79c}
      .vint{font:600 40px 'EB Garamond';letter-spacing:10px;color:#8a6d2f}
      .castle{width:220px;height:120px;margin-top:30px;background:#2d2416;opacity:.85;clip-path:polygon(0 100%,0 40%,8% 40%,8% 30%,16% 30%,16% 40%,24% 40%,24% 10%,32% 0,40% 10%,40% 40%,60% 40%,60% 10%,68% 0,76% 10%,76% 40%,84% 40%,84% 30%,92% 30%,92% 40%,100% 40%,100% 100%)}
      .brand0{font:400 104px/1.15 'Great Vibes';margin-top:36px;color:#2d2416}
      .class{font:600 44px 'EB Garamond';letter-spacing:6px;margin-top:30px;text-transform:uppercase}
      .app{font:italic 400 30px 'EB Garamond';margin-top:10px;color:#6c5731}
      .row{display:flex;gap:70px;font:400 30px 'EB Garamond';margin-top:auto}
      .country{font:600 26px 'EB Garamond';letter-spacing:5px;margin-top:18px;text-transform:uppercase}`,
    html: `<div class="frame">
      <div class="vint">2021</div>
      <div class="castle"></div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="app">Bordeaux · Grand Vin</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      ${l.country ? `<div class="country">${esc(l.country)}</div>` : ''}
    </div>`,
  }),

  'wine-back': (l) => ({
    css: `
      .label{background:#fdfbf5;color:#2d2416;padding:56px 60px;display:flex;flex-direction:column}
      .story{font:400 25px/1.45 'EB Garamond';text-align:left}
      .pair{font:italic 400 24px/1.4 'EB Garamond';margin-top:24px;color:#6c5731}
      .bottler{font:600 23px/1.4 'EB Garamond';margin-top:36px}
      .extra{font:700 22px 'Arimo';margin-top:14px;letter-spacing:1px}
      .warning{font:400 17px/1.32 'Arimo';text-align:left;margin-top:30px;border:1.5px solid #2d2416;padding:14px 16px}
      .bars{margin-top:auto;align-self:flex-end;width:230px;height:90px;background:repeating-linear-gradient(90deg,#111 0 3px,transparent 3px 5px,#111 5px 6px,transparent 6px 10px,#111 10px 14px,transparent 14px 16px)}`,
    html: `<p class="story">Our Cabernet Sauvignon comes from gravel slopes above the river, where old vines give
      small berries with deep colour. Aged eighteen months in French oak, it shows blackcurrant, cedar and a long,
      firm finish.</p>
      <p class="pair">Serve at 17°C with roasted lamb or aged cheeses.</p>
      <div class="bottler">${esc(l.bottler)}</div>
      ${(l.extra || []).map((e) => `<div class="extra">${esc(e.toUpperCase())}</div>`).join('')}
      ${warningHtml(l.warning)}
      <div class="bars"></div>`,
  }),
};

// --- Designs used only by the held-out evaluation set (holdout.mjs) --------
Object.assign(designs, {
  'whiskey-dark': (l) => ({
    css: `
      .label{background:radial-gradient(ellipse at 50% 30%,#2a2521 0%,#12100e 80%);color:#efe4cc;padding:60px 64px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .top{font:400 22px 'Libre Baskerville';letter-spacing:8px;color:#c9a96b}
      .brand0{font:700 88px/1.05 'Libre Baskerville';margin-top:40px;letter-spacing:1px}
      .brand1{font:italic 400 40px 'Libre Baskerville';margin-top:6px;color:#c9a96b}
      .rule{width:60%;border-top:1px solid #c9a96b;margin:34px 0}
      .class{font:400 36px/1.25 'Libre Baskerville';text-transform:uppercase;letter-spacing:4px}
      .row{display:flex;gap:60px;font:400 30px 'Libre Baskerville';margin-top:44px}
      .bottler{font:400 20px/1.5 'Libre Baskerville';margin-top:36px;color:#d9cdb3;max-width:80%}
      .warning{font:400 15px/1.35 'Arimo';text-align:left;margin-top:auto;color:#efe4cc;text-transform:uppercase}`,
    html: `<div class="top">SINGLE BARREL</div>
      ${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="rule"></div>
      <div class="class">${esc(l.classType)}</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      <div class="bottler">${esc(l.bottler)}</div>
      ${warningHtml(l.warning)}`,
  }),

  'wine-vertical': (l) => ({
    css: `
      .label{background:#ffffff;color:#1d1d1f;padding:70px 150px 70px 70px;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid #ddd}
      .brand0{font:400 84px/1.1 'Playfair Display';margin-top:60px}
      .class{font:500 34px 'Montserrat';letter-spacing:12px;margin-top:40px;text-transform:uppercase}
      .region{font:italic 400 30px 'EB Garamond';margin-top:18px;color:#6b6b6b}
      .row{display:flex;gap:50px;font:500 28px 'Montserrat';margin-top:auto}
      .country{font:600 24px 'Montserrat';letter-spacing:6px;margin-top:20px;text-transform:uppercase}
      .bottler{font:400 20px 'Montserrat';margin-top:16px}
      .side{position:absolute;right:28px;top:60px;width:90px;height:calc(100% - 120px)}
      .side .warning{position:absolute;left:50%;top:50%;width:980px;transform:translate(-50%,-50%) rotate(90deg);font:400 16px/1.3 'Arimo';text-align:left}`,
    html: `${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="region">Willamette Valley</div>
      <div class="row"><span>${esc(l.abv)}</span><span>${esc(l.net)}</span></div>
      ${l.country ? `<div class="country">${esc(l.country)}</div>` : ''}
      <div class="bottler">${esc(l.bottler)}</div>
      <div class="side">${warningHtml(l.warning)}</div>`,
  }),

  'cider-can': (l) => ({
    css: `
      .label{background:linear-gradient(135deg,#fde2e4 0%,#fad2a8 100%);color:#3d1f2b;padding:56px 60px;display:grid;grid-template-rows:auto auto 1fr auto;gap:10px}
      .brand0{font:800 110px/1 'Montserrat';letter-spacing:-2px;color:#b23a48}
      .class{font:600 40px 'Montserrat';margin-top:10px}
      .apple{justify-self:center;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e76f51,#9d2235);margin:30px 0;align-self:center}
      .cols{display:grid;grid-template-columns:1fr 1.4fr;gap:28px;align-items:start}
      .facts{font:600 30px/1.5 'Montserrat'}
      .bottler{font:400 18px/1.4 'Montserrat';margin-top:12px}
      .warning{font:400 14px/1.35 'Arimo';text-align:left;border-left:3px solid #b23a48;padding-left:14px}`,
    html: `${brandLines(l.brand).map((b, i) => `<div class="brand${i}">${esc(b)}</div>`).join('')}
      <div class="class">${esc(l.classType)}</div>
      <div class="apple"></div>
      <div class="cols"><div><div class="facts">${esc(l.abv)}<br>${esc(l.net)}</div><div class="bottler">${esc(l.bottler)}</div></div>${warningHtml(l.warning)}</div>`,
  }),
});

export function renderLabelDocument(template, label, [width, height]) {
  const d = designs[template];
  if (!d) throw new Error(`Unknown template ${template}`);
  const { css, html } = d(label);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontFaces}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:transparent}
    .label{position:relative;overflow:hidden;width:${width}px;height:${height}px}
    ${css}
  </style></head><body><div class="label" id="label">${html}</div></body></html>`;
}
