import type { ApplicationData, BeverageType } from '../domain/types';

interface Props {
  value: ApplicationData;
  onChange: (next: ApplicationData) => void;
  idPrefix?: string;
}

const TYPES: { value: BeverageType; label: string }[] = [
  { value: 'spirits', label: 'Distilled spirits' },
  { value: 'wine', label: 'Wine' },
  { value: 'beer', label: 'Beer / malt beverage' },
];

const EXAMPLES: Record<BeverageType, Partial<Record<keyof ApplicationData, string>>> = {
  spirits: { brandName: 'OLD TOM DISTILLERY', classType: 'Kentucky Straight Bourbon Whiskey', alcoholContent: '45% Alc./Vol. (90 Proof)', netContents: '750 mL' },
  wine: { brandName: 'Chateau Belle Rive', classType: 'Cabernet Sauvignon', alcoholContent: '13.5%', netContents: '750 mL' },
  beer: { brandName: 'Hoppy Trails', classType: 'India Pale Ale', alcoholContent: '6.8% (optional for most beer)', netContents: '12 fl oz' },
};

export function ApplicationForm({ value, onChange, idPrefix = 'app' }: Props) {
  const set = (k: keyof ApplicationData) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const ex = EXAMPLES[value.beverageType];
  const text = (k: keyof ApplicationData, label: string, hint: string, wide = false) => (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={`${idPrefix}-${k}`}>{label}</label>
      <input id={`${idPrefix}-${k}`} type="text" value={value[k]} onChange={set(k)} placeholder={ex[k] ? `e.g. ${ex[k]}` : undefined} autoComplete="off" spellCheck={false} aria-describedby={`${idPrefix}-${k}-hint`} />
      <span className="hint" id={`${idPrefix}-${k}-hint`}>{hint}</span>
    </div>
  );
  return (
    <div className="form-grid">
      <fieldset className="field wide">
        <legend>Type of product</legend>
        <div className="choice-row" role="radiogroup">
          {TYPES.map((t) => (
            <label key={t.value} className="choice">
              <input type="radio" name={`${idPrefix}-type`} value={t.value} checked={value.beverageType === t.value} onChange={() => onChange({ ...value, beverageType: t.value })} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      {text('brandName', 'Brand name', 'As written in the application.', true)}
      {text('classType', 'Class / type', 'For example “Vodka”, “Cabernet Sauvignon”, “India Pale Ale”.', true)}
      {text('alcoholContent', 'Alcohol content', value.beverageType === 'spirits' ? 'Percent alcohol by volume; proof is optional.' : 'Leave blank if the label does not need to show it.')}
      {text('netContents', 'Net contents', value.beverageType === 'beer' ? 'For example “12 fl oz” or “1 pint”.' : 'For example “750 mL” or “1 L”.')}
      {text('bottler', 'Bottler / producer name and address', 'Name, then city and state, separated by commas. For example “Old Tom Distillery, Bardstown, Kentucky”.', true)}
      {text('countryOfOrigin', 'Country of origin (imports only)', 'Leave blank for U.S. products.', true)}
    </div>
  );
}
