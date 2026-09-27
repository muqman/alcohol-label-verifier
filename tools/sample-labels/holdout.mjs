// Held-out evaluation labels: designs and wording the matching thresholds were
// NOT tuned on. Used only to measure how well the checks generalise:
//
//   npm run samples -- --holdout      (renders to test-data/holdout/)
//   npm run eval -- --holdout
import { WARNING_BODY, WARNING_HEADER } from './specs.mjs';

const warning = { header: WARNING_HEADER, body: WARNING_BODY, headerBold: true };
const ALL = (keys) => Object.fromEntries(keys.map((k) => [k, 'match']));
const BASE = ['brandName', 'classType', 'alcoholContent', 'netContents', 'bottler', 'warning'];

const RIDGELINE = {
  template: 'whiskey-dark',
  size: [900, 1250],
  label: {
    brand: ['RIDGELINE', 'Distilling Company'],
    classType: 'Straight Rye Whiskey',
    abv: '50% ALC/VOL (100 PROOF)',
    net: '750 ML',
    bottler: 'Distilled and bottled by Ridgeline Distilling Company, Lexington, KY',
    warning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'Ridgeline Distilling Company',
    classType: 'Straight Rye Whiskey',
    alcoholContent: '50%',
    netContents: '750 mL',
    bottler: 'Ridgeline Distilling Company, Lexington, Kentucky',
    countryOfOrigin: '',
  },
};

const WILLOW = {
  template: 'wine-vertical',
  size: [900, 1150],
  label: {
    brand: ['Willow Creek'],
    classType: 'Pinot Noir',
    abv: '13.9% ALC. BY VOL.',
    net: '750 ML',
    bottler: 'Produced and bottled by Willow Creek Cellars, Dundee, OR',
    warning,
  },
  application: {
    beverageType: 'wine',
    brandName: 'Willow Creek',
    classType: 'Pinot Noir',
    alcoholContent: '13.9%',
    netContents: '750 mL',
    bottler: 'Willow Creek Cellars, Dundee, Oregon',
    countryOfOrigin: '',
  },
};

const ORCHARD = {
  template: 'cider-can',
  size: [900, 1200],
  label: {
    brand: ['ORCHARD ROW'],
    classType: 'Hard Cider',
    abv: '8.5% ALC/VOL',
    net: '355 mL (12 FL OZ)',
    bottler: 'Fermented and canned by Orchard Row Cider Works, Hood River, Oregon',
    warning,
  },
  application: {
    beverageType: 'wine',
    brandName: 'Orchard Row',
    classType: 'Hard Cider',
    alcoholContent: '8.5%',
    netContents: '355 mL',
    bottler: 'Orchard Row Cider Works, Hood River, Oregon',
    countryOfOrigin: '',
  },
};

const HARBOR = {
  template: 'beer',
  size: [1000, 1100],
  label: {
    brand: ['HARBOR LIGHT'],
    classType: 'Pilsner',
    abv: '4.8% ALC/VOL',
    net: '16 FL OZ',
    bottler: 'Brewed and canned by Harbor Light Brewing, Portland, ME',
    warning,
  },
  application: {
    beverageType: 'beer',
    brandName: 'Harbor Light',
    classType: 'Pilsner',
    alcoholContent: '4.8%',
    netContents: '1 Pint',
    bottler: 'Harbor Light Brewing, Portland, Maine',
    countryOfOrigin: '',
  },
};

const LOCH = {
  template: 'scotch',
  size: [900, 1200],
  label: {
    brand: ['LOCH VARRA'],
    classType: 'Blended Scotch Whisky',
    abv: '40% Alc./Vol.',
    net: '1 L',
    country: 'Product of Scotland',
    bottler: 'Imported by Caledonia Imports LLC, Chicago, IL',
    warning,
  },
  application: {
    beverageType: 'spirits',
    brandName: 'Loch Varra',
    classType: 'Blended Scotch Whisky',
    alcoholContent: '40% Alc./Vol.',
    netContents: '1 Liter',
    bottler: 'Caledonia Imports LLC, Chicago, Illinois',
    countryOfOrigin: 'Scotland',
  },
};

const merge = (base, over = {}) => ({
  ...base,
  ...over,
  label: { ...base.label, ...(over.label || {}) },
  application: { ...base.application, ...(over.application || {}) },
});

export const HOLDOUT = [
  { id: 'h-ridgeline-rye', title: 'Rye — dark label, warning all in capitals', ...merge(RIDGELINE), expected: { overall: 'pass', fields: ALL(BASE) }, accept: ['review'] },
  {
    id: 'h-ridgeline-wrong-class',
    title: 'Rye — class/type differs',
    ...merge(RIDGELINE, { label: { classType: 'Straight Bourbon Whiskey' } }),
    expected: { overall: 'fail', fields: { classType: 'mismatch' } },
    accept: ['review'],
  },
  {
    id: 'h-ridgeline-proof',
    title: 'Rye — proof does not equal 2 x ABV',
    ...merge(RIDGELINE, { label: { abv: '50% ALC/VOL (90 PROOF)' } }),
    expected: { overall: 'review', fields: { alcoholContent: 'review' } },
    accept: ['fail'],
  },
  {
    id: 'h-ridgeline-photo',
    title: 'Rye — bottle photo with glare',
    ...merge(RIDGELINE),
    photo: { curve: 0.75, rotate: 2, glare: { x: 0.25, y: 0.3, rx: 0.07, ry: 0.45, a: 0.5 }, bottle: '#3b2412', scene: 'wood', jpeg: 80 },
    expected: { overall: 'pass', fields: {} },
    accept: ['review'],
  },
  { id: 'h-willow-pinot', title: 'Pinot noir — warning printed sideways', ...merge(WILLOW), expected: { overall: 'pass', fields: ALL(BASE) }, accept: ['review'] },
  {
    id: 'h-willow-not-bold',
    title: 'Pinot noir — sideways warning, heading not bold',
    ...merge(WILLOW, { label: { warning: { ...warning, headerBold: false } } }),
    expected: { overall: 'review', fields: {} },
    accept: ['fail'],
  },
  { id: 'h-orchard-cider', title: 'Cider — two-column layout', ...merge(ORCHARD), expected: { overall: 'pass', fields: ALL(BASE) }, accept: ['review'] },
  {
    id: 'h-orchard-short-warning',
    title: 'Cider — warning cut short',
    ...merge(ORCHARD, {
      label: {
        warning: {
          ...warning,
          body: '(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery.',
        },
      },
    }),
    expected: { overall: 'fail', fields: {} },
    accept: ['review'],
  },
  { id: 'h-harbor-pilsner', title: 'Pilsner — 16 FL OZ vs "1 Pint"', ...merge(HARBOR), expected: { overall: 'pass', fields: ALL(BASE) } },
  {
    id: 'h-harbor-angle',
    title: 'Pilsner — angled photo, no ABV in application',
    ...merge(HARBOR, { application: { alcoholContent: '' } }),
    photo: { rotateY: -22, rotateX: -6, rotate: -3, brightness: 0.8, scene: 'dark', noise: 8, jpeg: 78 },
    expected: { overall: 'pass', fields: { alcoholContent: 'skipped' } },
    accept: ['review'],
  },
  { id: 'h-loch-varra', title: 'Scotch import — liters, country of origin', ...merge(LOCH), expected: { overall: 'pass', fields: ALL([...BASE, 'countryOfOrigin']) } },
  {
    id: 'h-loch-varra-wrong-country',
    title: 'Scotch import — application says Ireland',
    ...merge(LOCH, { application: { countryOfOrigin: 'Ireland' } }),
    expected: { overall: 'fail', fields: { countryOfOrigin: 'missing' } },
  },
];
