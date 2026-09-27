import type { SampleCase } from '../samples';

interface Props {
  cases: SampleCase[];
  value: string;
  onPick: (c: SampleCase) => void;
  id?: string;
}

const GROUPS: { label: string; test: (c: SampleCase) => boolean }[] = [
  { label: 'Correct labels', test: (c) => c.expected.overall === 'pass' && !/photo|angle|glare|blurry|sideways|small/.test(c.id) },
  { label: 'Labels with a problem', test: (c) => c.expected.overall !== 'pass' },
  { label: 'Hard-to-read photos', test: (c) => c.expected.overall === 'pass' && /photo|angle|glare|blurry|sideways|small/.test(c.id) },
];

export function ExamplePicker({ cases, value, onPick, id = 'example-picker' }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>Try a built-in example</label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const c = cases.find((x) => x.id === e.target.value);
          if (c) onPick(c);
        }}
        className="select"
      >
        <option value="">Choose an example…</option>
        {GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {cases.filter(g.test).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
