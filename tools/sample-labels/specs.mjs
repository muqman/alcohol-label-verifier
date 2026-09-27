// Test-label definitions: what is printed on each label, what the (simulated)
// application says, how the "photo" is degraded, and the result we expect.
//
// These drive three things:
//   1. the sample images shipped with the app ("Try a sample" + sample batch),
//   2. the OCR engine benchmark,
//   3. the end-to-end accuracy test (tests/e2e).

export const WARNING_HEADER = 'GOVERNMENT WARNING:';
export const WARNING_BODY =
  '(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. ' +
  '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const standardWarning = { header: WARNING_HEADER, body: WARNING_BODY, headerBold: true };

// ---------------------------------------------------------------------------
// Base label content, one per design. Individual cases override pieces.
// ---------------------------------------------------------------------------
const OLD_TOM = {
  template: 'bourbon',
  label: {
    brand: ['OLD TOM', 'DISTILLERY'],
    classType: 'Kentucky Straight Bourbon Whiskey',
    abv: '45% Alc./Vol. (90 Proof)',
    net: '750 mL',
    bottler: 'Distilled and Bottled by Old Tom Distillery, Bardstown, Kentucky',
    warning: standardWarning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'OLD TOM DISTILLERY',
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '45% Alc./Vol. (90 Proof)',
    netContents: '750 mL',
    bottler: 'Old Tom Distillery, Bardstown, Kentucky',
    countryOfOrigin: '',
  },
};

const STONES_THROW = {
  template: 'gin',
  label: {
    brand: ["STONE'S THROW"],
    classType: 'London Dry Gin',
    abv: '47% ALC/VOL',
    net: '750 ML',
    bottler: "Bottled by Stone's Throw Spirits Co., Portland, Oregon",
    warning: standardWarning,
  },
  application: {
    beverageType: 'spirits',
    brandName: "Stone's Throw",
    classType: 'London Dry Gin',
    alcoholContent: '47%',
    netContents: '750 mL',
    bottler: "Stone's Throw Spirits Co., Portland, Oregon",
    countryOfOrigin: '',
  },
};

const HOPPY_TRAILS = {
  template: 'beer',
  label: {
    brand: ['HOPPY TRAILS'],
    classType: 'India Pale Ale',
    abv: '6.8% ALC/VOL',
    net: '12 FL OZ',
    bottler: 'Brewed and canned by Hoppy Trails Brewing Co., Bend, OR',
    warning: standardWarning,
  },
  application: {
    beverageType: 'beer',
    brandName: 'Hoppy Trails',
    classType: 'India Pale Ale',
    alcoholContent: '6.8% ABV',
    netContents: '12 fl oz',
    bottler: 'Hoppy Trails Brewing Co., Bend, Oregon',
    countryOfOrigin: '',
  },
};

const AGAVE_AZUL = {
  template: 'tequila',
  label: {
    brand: ['AGAVE AZUL'],
    classType: 'Tequila Blanco',
    abv: '40% Alc./Vol. (80 Proof)',
    net: '750 mL',
    country: 'Product of Mexico',
    bottler: 'Imported by Azul Imports LLC, San Antonio, TX',
    warning: standardWarning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'Agave Azul',
    classType: 'Tequila Blanco',
    alcoholContent: '40%',
    netContents: '750 mL',
    bottler: 'Azul Imports LLC, San Antonio, Texas',
    countryOfOrigin: 'Mexico',
  },
};

const NORTH_STAR = {
  template: 'vodka',
  label: {
    brand: ['NORTH STAR'],
    classType: 'Vodka',
    abv: '40% alc./vol. (80 proof)',
    net: '1 L',
    bottler: 'Bottled by North Star Spirits, Minneapolis, Minnesota',
    warning: standardWarning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'North Star',
    classType: 'Vodka',
    alcoholContent: '40% Alc./Vol.',
    netContents: '1 Liter',
    bottler: 'North Star Spirits, Minneapolis, Minnesota',
    countryOfOrigin: '',
  },
};

const GLEN_ARDRA = {
  template: 'scotch',
  label: {
    brand: ['GLEN ARDRA'],
    classType: 'Single Malt Scotch Whisky',
    abv: '43% Alc./Vol.',
    net: '750 mL',
    country: 'Product of Scotland',
    bottler: 'Imported by Highland Imports Inc., Boston, MA',
    warning: standardWarning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'Glen Ardra',
    classType: 'Single Malt Scotch Whisky',
    alcoholContent: '43%',
    netContents: '750 mL',
    bottler: 'Highland Imports Inc., Boston, Massachusetts',
    countryOfOrigin: 'Scotland',
  },
};

const ISLAND_BREEZE = {
  template: 'rum',
  label: {
    brand: ['Island Breeze'],
    classType: 'Spiced Rum',
    abv: '35% Alc./Vol. (70 Proof)',
    net: '750 mL',
    bottler: 'Bottled by Island Breeze Rum Co., Key West, Florida',
    warning: standardWarning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'Island Breeze',
    classType: 'Spiced Rum',
    alcoholContent: '35%',
    netContents: '750 mL',
    bottler: 'Island Breeze Rum Co., Key West, Florida',
    countryOfOrigin: '',
  },
};

const BELLE_RIVE_FRONT = {
  template: 'wine',
  label: {
    brand: ['Château Belle Rive'],
    classType: 'Cabernet Sauvignon',
    abv: 'Alc. 13.5% by Vol.',
    net: '750 ml',
    country: 'Product of France',
    warning: null,
  },
};

const BELLE_RIVE_BACK = {
  template: 'wine-back',
  label: {
    bottler: 'Imported by Belle Rive Imports, New York, NY',
    extra: ['Contains Sulfites'],
    warning: standardWarning,
  },
};

const BELLE_RIVE_APP = {
  beverageType: 'wine',
  brandName: 'Chateau Belle Rive',
  classType: 'Cabernet Sauvignon',
  alcoholContent: '13.5%',
  netContents: '750 mL',
  bottler: 'Belle Rive Imports, New York, New York',
  countryOfOrigin: 'France',
};

// Helpers ------------------------------------------------------------------
const merge = (base, over = {}) => ({
  ...base,
  ...over,
  label: { ...base.label, ...(over.label || {}) },
  application: { ...base.application, ...(over.application || {}) },
});

const ALL_MATCH = (fields) => Object.fromEntries(fields.map((f) => [f, 'match']));
const SPIRITS_FIELDS = ['brandName', 'classType', 'alcoholContent', 'netContents', 'bottler', 'warning'];
const IMPORT_FIELDS = [...SPIRITS_FIELDS, 'countryOfOrigin'];

// ---------------------------------------------------------------------------
// Cases. `expected.overall` is what a careful human reviewer would conclude;
// `expected.fields` lists the fields whose status the test asserts.
// `accept` (optional) lists other overall outcomes that are acceptable for
// degraded photos (e.g. "review" when glare genuinely hides text).
// ---------------------------------------------------------------------------
export const CASES = [
  // --- Clean, correct labels ----------------------------------------------
  {
    id: 'old-tom-bourbon',
    title: 'Bourbon — everything correct',
    note: 'The example from the brief. Every field should match.',
    ...merge(OLD_TOM),
    size: [900, 1200],
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    featured: true,
  },
  {
    id: 'stones-throw-gin',
    title: "Gin — brand in different capitalization",
    note: "Label says STONE'S THROW, application says Stone's Throw (Dave's example). Should be treated as a match, with a note.",
    ...merge(STONES_THROW),
    size: [900, 1200],
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    featured: true,
  },
  {
    id: 'hoppy-trails-ipa',
    title: 'Beer — U.S. units (12 FL OZ)',
    note: 'Malt beverage; net contents in fluid ounces; state abbreviation (OR) vs full name (Oregon).',
    ...merge(HOPPY_TRAILS),
    size: [1000, 1100],
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
  },
  {
    id: 'agave-azul-tequila',
    title: 'Imported tequila — country of origin',
    note: 'Imported spirit; country of origin must appear.',
    ...merge(AGAVE_AZUL),
    size: [900, 1200],
    expected: { overall: 'pass', fields: ALL_MATCH(IMPORT_FIELDS) },
  },
  {
    id: 'belle-rive-wine',
    title: 'Imported wine — front + back label',
    note: 'Two images for one application: brand/class/ABV on the front, warning and importer on the back. Brand uses a script font.',
    template: 'wine',
    images: [
      { suffix: 'front', ...BELLE_RIVE_FRONT, size: [900, 1150] },
      { suffix: 'back', ...BELLE_RIVE_BACK, size: [800, 1000] },
    ],
    application: BELLE_RIVE_APP,
    expected: { overall: 'pass', fields: ALL_MATCH(IMPORT_FIELDS) },
    accept: ['review'],
  },
  {
    id: 'north-star-vodka',
    title: 'Vodka — thin display font, liters',
    note: '"1 L" on the label vs "1 Liter" in the application.',
    ...merge(NORTH_STAR),
    size: [900, 1200],
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    accept: ['review'],
  },

  // --- Deliberate errors ----------------------------------------------------
  {
    id: 'old-tom-wrong-abv',
    title: 'Bourbon — wrong alcohol content',
    note: 'Label says 40% (80 Proof); application says 45%.',
    ...merge(OLD_TOM, { label: { abv: '40% Alc./Vol. (80 Proof)' } }),
    size: [900, 1200],
    expected: { overall: 'fail', fields: { alcoholContent: 'mismatch', brandName: 'match', warning: 'match' } },
    featured: true,
  },
  {
    id: 'stones-throw-titlecase-warning',
    title: 'Gin — "Government Warning" not in capitals',
    note: "Jenny's example: the header is written in title case instead of ALL CAPS.",
    ...merge(STONES_THROW, { label: { warning: { ...standardWarning, header: 'Government Warning:' } } }),
    size: [900, 1200],
    expected: { overall: 'fail', fields: { warning: 'mismatch', brandName: 'match' } },
    featured: true,
  },
  {
    id: 'hoppy-trails-altered-warning',
    title: 'Beer — warning wording changed',
    note: 'The warning says "may impair" instead of "impairs" and drops "(1) According to the Surgeon General,".',
    ...merge(HOPPY_TRAILS, {
      label: {
        warning: {
          ...standardWarning,
          body:
            'Women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. ' +
            '(2) Consumption of alcoholic beverages may impair your ability to drive a car or operate machinery, and may cause health problems.',
        },
      },
    }),
    size: [1000, 1100],
    expected: { overall: 'fail', fields: { warning: 'mismatch' } },
  },
  {
    id: 'north-star-warning-not-bold',
    title: 'Vodka — warning header not bold',
    note: 'GOVERNMENT WARNING: is in capitals but set in regular weight, like the rest of the statement.',
    ...merge(NORTH_STAR, { label: { warning: { ...standardWarning, headerBold: false } } }),
    size: [900, 1200],
    expected: { overall: 'review', fields: { warning: 'review' } },
    accept: ['fail'],
  },
  {
    id: 'island-breeze-no-warning',
    title: 'Rum — government warning missing',
    note: 'No health warning statement anywhere on the label.',
    ...merge(ISLAND_BREEZE, { label: { warning: null } }),
    size: [900, 1200],
    expected: { overall: 'fail', fields: { warning: 'missing', brandName: 'match' } },
    featured: true,
  },
  {
    id: 'glen-ardra-wrong-net',
    title: 'Scotch — wrong net contents',
    note: 'Label says 700 mL; application says 750 mL.',
    ...merge(GLEN_ARDRA, { label: { net: '700 mL' } }),
    size: [900, 1200],
    expected: { overall: 'fail', fields: { netContents: 'mismatch', countryOfOrigin: 'match' } },
  },
  {
    id: 'agave-azul-no-country',
    title: 'Imported tequila — country of origin missing',
    note: 'Application says imported from Mexico, but the label has no country of origin statement.',
    ...merge(AGAVE_AZUL, { label: { country: null } }),
    size: [900, 1200],
    expected: { overall: 'fail', fields: { countryOfOrigin: 'missing', brandName: 'match' } },
  },
  {
    id: 'old-tom-brand-mismatch',
    title: 'Bourbon — different brand name',
    note: 'Label says OLD TOM DISTILLING CO.; application says OLD TOM DISTILLERY.',
    ...merge(OLD_TOM, { label: { brand: ['OLD TOM', 'DISTILLING CO.'] } }),
    size: [900, 1200],
    expected: { overall: 'fail', fields: { brandName: 'mismatch' } },
    accept: ['review'],
  },

  // --- Imperfect photos of correct labels ---------------------------------
  {
    id: 'old-tom-bottle-photo',
    title: 'Bourbon — photo of a curved bottle',
    note: 'Label wrapped around a bottle: curvature, edge shading, slight tilt, a glare streak.',
    ...merge(OLD_TOM),
    size: [900, 1200],
    photo: { curve: 0.85, rotate: -3, glare: { x: 0.8, y: 0.35, rx: 0.06, ry: 0.5, a: 0.55 }, bottle: '#5a2d0c', scene: 'wood', blur: 0.4, jpeg: 80 },
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    accept: ['review'],
    featured: true,
  },
  {
    id: 'hoppy-trails-angle',
    title: 'Beer — shot at an angle, dim light',
    note: 'Perspective tilt of about 25°, underexposed.',
    ...merge(HOPPY_TRAILS),
    size: [1000, 1100],
    photo: { rotateY: 25, rotateX: 8, rotate: 4, brightness: 0.7, contrast: 0.9, scene: 'dark', noise: 10, jpeg: 78 },
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    accept: ['review'],
  },
  {
    id: 'stones-throw-glare',
    title: 'Gin — heavy glare on the glass',
    note: 'A bright reflection partly washes out the label.',
    ...merge(STONES_THROW),
    size: [900, 1200],
    photo: { curve: 0.6, glare: { x: 0.3, y: 0.42, rx: 0.16, ry: 0.22, a: 0.85 }, bottle: '#1d3b2a', scene: 'light', jpeg: 80 },
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    accept: ['review'],
  },
  {
    id: 'glen-ardra-blurry',
    title: 'Scotch — slightly blurry, noisy photo',
    note: 'Out-of-focus phone photo with sensor noise.',
    ...merge(GLEN_ARDRA),
    size: [900, 1200],
    photo: { blur: 1.3, noise: 14, brightness: 0.85, rotate: 2, scene: 'wood', jpeg: 70 },
    expected: { overall: 'pass', fields: ALL_MATCH(IMPORT_FIELDS) },
    accept: ['review'],
  },
  {
    id: 'agave-azul-sideways',
    title: 'Tequila — photo taken sideways',
    note: 'Image is rotated 90°, as when a phone photo loses its orientation flag.',
    ...merge(AGAVE_AZUL),
    size: [900, 1200],
    photo: { rotate90: true, scene: 'light', jpeg: 85 },
    expected: { overall: 'pass', fields: ALL_MATCH(IMPORT_FIELDS) },
    accept: ['review'],
  },
  {
    id: 'island-breeze-small',
    title: 'Rum — small, low-resolution image',
    note: 'Only 520 px wide with heavy JPEG compression; the warning text is tiny.',
    ...merge(ISLAND_BREEZE),
    size: [900, 1200],
    photo: { scale: 0.58, jpeg: 55 },
    expected: { overall: 'pass', fields: ALL_MATCH(SPIRITS_FIELDS) },
    accept: ['review'],
  },
];
