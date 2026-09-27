import { useState } from 'react';
import type { LabelCheck } from '../core/checkLabel';
import type { ApplicationData, FieldKey, FieldResult, WarningDetails } from '../domain/types';
import { FIELD_LABELS } from '../domain/types';
import { WARNING_HEADER } from '../domain/warningText';
import { LabelViewer, type ViewerImage } from './LabelViewer';
import { cfrFor, StatusChip, StatusIcon, VERDICT_TEXT } from './status';

interface Props {
  check: LabelCheck;
  app: ApplicationData;
  images: ViewerImage[];
  /** Extra buttons shown in the verdict banner. */
  actions?: React.ReactNode;
  headingRef?: React.Ref<HTMLHeadingElement>;
}

function verdictDetail(fields: FieldResult[]): string {
  const n = (s: FieldResult['status']) => fields.filter((f) => f.status === s).length;
  const parts = [
    n('mismatch') && `${n('mismatch')} doesn’t match`,
    n('missing') && `${n('missing')} not found`,
    n('review') && `${n('review')} to check`,
  ].filter(Boolean);
  const checked = fields.filter((f) => f.status !== 'skipped').length;
  return parts.length ? parts.join(' · ') : `${checked} of ${checked} items match the application`;
}

export function ResultsView({ check, app, images, actions, headingRef }: Props) {
  const [active, setActive] = useState<FieldKey | null>(null);
  const { result } = check;
  const seconds = (check.ms / 1000).toFixed(1);
  return (
    <section aria-labelledby="verdict-heading">
      <div className={`verdict ${result.verdict}`}>
        <StatusIcon status={result.verdict} className="verdict-icon" />
        <div>
          <h2 id="verdict-heading" ref={headingRef} tabIndex={-1}>
            {VERDICT_TEXT[result.verdict]}
          </h2>
          <p>
            {verdictDetail(result.fields)}
            <span className="muted"> · checked in {seconds} s{check.secondLook ? ' (read twice for accuracy)' : ''}</span>
          </p>
        </div>
        <span className="spacer" />
        {actions}
      </div>
      <div className="results-layout">
        <div className="field-list" onMouseLeave={() => setActive(null)}>
          {result.fields.map((f) => (
            <FieldRow key={f.key} field={f} app={app} active={active === f.key} onActivate={() => setActive(f.key)} />
          ))}
        </div>
        <LabelViewer images={images} fields={result.fields} active={active} />
      </div>
      <details className="raw">
        <summary>Text read from the label</summary>
        {check.readings.map((r, i) => (
          <div key={i}>
            {r.pages.map((p) => (
              <div key={p.engine}>
                <p className="small muted" style={{ marginTop: 10 }}>
                  Image {i + 1} · {p.engine === 'tesseract' ? 'first reading (Tesseract)' : 'second reading (PaddleOCR)'} · {Math.round(p.ms)} ms
                </p>
                <pre>{p.lines.map((l) => l.text).join('\n') || '(no text found)'}</pre>
              </div>
            ))}
          </div>
        ))}
      </details>
    </section>
  );
}

function FieldRow({ field, app, active, onActivate }: { field: FieldResult; app: ApplicationData; active: boolean; onActivate: () => void }) {
  const isWarning = field.key === 'warning';
  return (
    <article
      className={`field-row s-${field.status}${active ? ' active' : ''}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      tabIndex={0}
      aria-label={`${FIELD_LABELS[field.key]}: ${field.status}`}
    >
      <header>
        <h3>{FIELD_LABELS[field.key]}</h3>
        <span className="cfr">{cfrFor(field.key, app.beverageType)}</span>
        <StatusChip status={field.status} />
      </header>
      {!isWarning && field.status !== 'skipped' && (
        <dl className="compare">
          <dt>Application</dt>
          <dd>{field.expected || '—'}</dd>
          <dt>On label</dt>
          <dd>{field.found ?? <span className="muted">not found</span>}</dd>
        </dl>
      )}
      <p className="message">{field.message}</p>
      {isWarning && field.warning && <WarningPanel details={field.warning} status={field.status} />}
    </article>
  );
}

type Tick = 'ok' | 'bad' | 'check';
const tickClass: Record<Tick, string> = { ok: 's-match', bad: 's-mismatch', check: 's-review' };

function Check({ state, children }: { state: Tick; children: React.ReactNode }) {
  return (
    <li className={tickClass[state]}>
      <StatusIcon status={state === 'ok' ? 'match' : state === 'bad' ? 'mismatch' : 'review'} />
      {children}
    </li>
  );
}

function WarningPanel({ details, status }: { details: WarningDetails; status: FieldResult['status'] }) {
  const wordProblems = details.words.filter((w) => w.state === 'changed' || w.state === 'missing').length + details.extraText.length;
  const wordDoubts = details.words.filter((w) => w.state === 'unclear' || w.state === 'unread').length;
  const wording: Tick = wordProblems && details.readQuality === 'good' ? 'bad' : wordProblems || wordDoubts ? 'check' : 'ok';
  const caps: Tick = details.headerAllCaps === true ? 'ok' : details.headerAllCaps === false ? 'bad' : 'check';
  const bold: Tick = details.bold === 'yes' ? 'ok' : 'check';
  const hasMarks = wordProblems + wordDoubts > 0;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <ul className="warning-checks">
        <Check state={status === 'missing' ? 'bad' : 'ok'}>Statement present</Check>
        <Check state={wording}>Exact wording</Check>
        <Check state={caps}>“GOVERNMENT WARNING” in capitals</Check>
        <Check state={bold}>Heading in bold type</Check>
      </ul>
      <p className="statement" aria-label="Required statement, with differences marked">
        <strong>{details.headerText && caps === 'bad' ? <mark className="w-changed" title={`Label: ${details.headerText}`}>{WARNING_HEADER}</mark> : WARNING_HEADER}</strong>{' '}
        {details.words.map((w, i) => (
          <span key={i}>
            {w.insertedBefore && (
              <>
                <ins title="Extra wording on the label">{w.insertedBefore}</ins>{' '}
              </>
            )}
            {w.state === 'ok' ? (
              w.text
            ) : (
              <mark className={`w-${w.state}`} title={w.read ? `Label: ${w.read}` : w.state === 'missing' ? 'Missing on the label' : 'Could not be read'}>
                {w.text}
              </mark>
            )}
            {(w.state === 'changed' || w.state === 'unclear') && w.read && <span className="read-as"> [label: {w.read}]</span>}{' '}
          </span>
        ))}
      </p>
      {hasMarks && (
        <div className="legend">
          <span><i className="swatch" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)' }} /> different or missing on the label</span>
          <span><i className="swatch" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn)' }} /> not read clearly — compare with the image</span>
        </div>
      )}
    </div>
  );
}
