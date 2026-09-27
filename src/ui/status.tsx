import type { BeverageType, FieldKey, FieldStatus, Verdict } from '../domain/types';
import { IconAlert, IconCheck, IconCross, IconMinus } from './icons';

export const STATUS_WORDS: Record<FieldStatus, string> = {
  match: 'Matches',
  review: 'Please check',
  mismatch: 'Doesn’t match',
  missing: 'Not found',
  skipped: 'Not checked',
};

export function StatusIcon({ status, ...rest }: { status: FieldStatus | Verdict | 'error' } & React.SVGProps<SVGSVGElement>) {
  switch (status) {
    case 'match':
    case 'pass':
      return <IconCheck {...rest} />;
    case 'review':
      return <IconAlert {...rest} />;
    case 'skipped':
      return <IconMinus {...rest} />;
    default:
      return <IconCross {...rest} />;
  }
}

export function StatusChip({ status }: { status: FieldStatus }) {
  return (
    <span className={`chip s-${status}`}>
      <StatusIcon status={status} />
      {STATUS_WORDS[status]}
    </span>
  );
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  pass: 'All checks passed',
  review: 'Needs review',
  fail: 'Problems found',
};

/** Regulation each check is based on, shown as a quiet reference. */
export function cfrFor(key: FieldKey, type: BeverageType): string {
  const t = { spirits: 0, wine: 1, beer: 2 }[type];
  const refs: Record<FieldKey, [string, string, string]> = {
    brandName: ['27 CFR 5.64', '27 CFR 4.33', '27 CFR 7.64'],
    classType: ['27 CFR part 5, subpart I', '27 CFR 4.34', '27 CFR part 7, subpart I'],
    alcoholContent: ['27 CFR 5.65', '27 CFR 4.36', '27 CFR 7.65'],
    netContents: ['27 CFR 5.70', '27 CFR 4.37', '27 CFR 7.70'],
    bottler: ['27 CFR 5.66–5.68', '27 CFR 4.35', '27 CFR 7.66–7.68'],
    countryOfOrigin: ['19 CFR part 134', '19 CFR part 134', '19 CFR part 134'],
    warning: ['27 CFR 16.21–16.22', '27 CFR 16.21–16.22', '27 CFR 16.21–16.22'],
  };
  return refs[key][t];
}
