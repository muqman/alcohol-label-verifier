import { useEffect, useMemo, useRef, useState } from 'react';
import { fileKey, parseManifest, resultsToCsv, TEMPLATE_CSV, type BatchOutcome, type Manifest } from '../batch/manifest';
import type { LabelCheck } from '../core/checkLabel';
import { EMPTY_APPLICATION, FIELD_LABELS, type ApplicationData, type Verdict } from '../domain/types';
import { ImageError } from '../ocr/browser/decode';
import type { OcrService, ServiceState } from '../ocr/browser/service';
import { loadSampleCases, sampleFile, sampleManifestFile } from '../samples';
import { IconArrowLeft, IconArrowRight, IconDownload, IconFile, IconInfo, IconSpinner, IconUpload } from './icons';
import type { ViewerImage } from './LabelViewer';
import { ResultsView } from './Results';
import { StatusIcon, VERDICT_TEXT } from './status';

interface Props {
  service: OcrService;
  engines: ServiceState;
}

interface Job {
  id: string;
  app: ApplicationData;
  names: string[];
  files: File[];
  missing: string[];
}

interface Done extends BatchOutcome {
  check?: LabelCheck;
  sizes?: { width: number; height: number }[];
}

type Filter = 'all' | Verdict | 'error';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
const isCsv = (f: File) => /\.csv$/i.test(f.name) || f.type === 'text/csv';

export function BatchCheck({ service, engines }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestName, setManifestName] = useState('');
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
  const [results, setResults] = useState<Done[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const stop = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const byName = useMemo(() => new Map(files.map((f) => [fileKey(f.name), f])), [files]);

  const jobs: Job[] = useMemo(() => {
    if (manifest) {
      return manifest.rows.map((r) => {
        const found = r.images.map((n) => byName.get(fileKey(n)));
        return { id: r.id, app: r.app, names: r.images, files: found.filter((f): f is File => !!f), missing: r.images.filter((_, i) => !found[i]) };
      });
    }
    return files.map((f) => ({ id: f.name, app: EMPTY_APPLICATION, names: [f.name], files: [f], missing: [] }));
  }, [manifest, files, byName]);

  const unlisted = useMemo(() => {
    if (!manifest) return [];
    const listed = new Set(manifest.rows.flatMap((r) => r.images.map(fileKey)));
    return files.filter((f) => !listed.has(fileKey(f.name)));
  }, [manifest, files]);

  const runnable = jobs.filter((j) => j.files.length > 0);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  async function addFiles(list: FileList | File[] | null) {
    const all = Array.from(list ?? []);
    const csv = all.find(isCsv);
    if (csv) await useCsv(csv);
    const imgs = all.filter(isImage);
    if (imgs.length) {
      setFiles((old) => {
        const map = new Map(old.map((f) => [fileKey(f.name), f]));
        imgs.forEach((f) => map.set(fileKey(f.name), f));
        return [...map.values()];
      });
    }
    if (!csv && !imgs.length && all.length) setError('Those files are not images or a CSV file.');
  }

  async function useCsv(file: File) {
    const m = parseManifest(await file.text());
    setManifest(m);
    setManifestName(file.name);
    setError(m.rows.length ? null : m.problems[0] ?? 'The CSV file has no rows.');
  }

  async function loadSample() {
    setLoadingSample(true);
    setError(null);
    try {
      const cases = await loadSampleCases();
      const names = cases.flatMap((c) => c.images);
      const [imgs, csv] = await Promise.all([Promise.all(names.map(sampleFile)), sampleManifestFile()]);
      setFiles(imgs);
      await useCsv(csv);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingSample(false);
    }
  }

  async function start() {
    stop.current = false;
    setResults([]);
    setFilter('all');
    setDetail(null);
    setPhase('running');
    setStartedAt(performance.now());
    setNow(performance.now());
    const lanes = await service.scaleForBatch();
    const queue = [...runnable];
    const out: Done[] = [];
    const worker = async () => {
      for (let job = queue.shift(); job && !stop.current; job = queue.shift()) {
        const t0 = performance.now();
        let done: Done;
        try {
          const decoded = [];
          for (const f of job.files) decoded.push(await service.decode(f));
          const check = await service.check(job.app, decoded);
          decoded.forEach((d) => URL.revokeObjectURL(d.url));
          done = {
            id: job.id,
            images: job.names,
            verdict: check.result.verdict,
            fields: check.result.fields,
            check,
            sizes: decoded.map((d) => ({ width: d.pixels.width, height: d.pixels.height })),
            seconds: (performance.now() - t0) / 1000,
            error: job.missing.length ? `Image not found: ${job.missing.join(', ')} (checked the others).` : undefined,
          };
        } catch (e) {
          done = { id: job.id, images: job.names, verdict: 'error', fields: [], error: e instanceof ImageError ? e.message : String((e as Error).message), seconds: (performance.now() - t0) / 1000 };
        }
        out.push(done);
        // Keep the CSV order in the table regardless of which lane finished first.
        const order = new Map(runnable.map((j, i) => [j.id, i]));
        setResults([...out].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      }
    };
    await Promise.all(Array.from({ length: lanes }, worker));
    service.endBatch();
    setPhase('done');
  }

  const counts = useMemo(() => {
    const c = { all: results.length, pass: 0, review: 0, fail: 0, error: 0 };
    results.forEach((r) => c[r.verdict]++);
    return c;
  }, [results]);
  const visible = results.filter((r) => filter === 'all' || r.verdict === filter);

  // ---- Detail view --------------------------------------------------------------------
  if (detail !== null && visible[detail]?.check) {
    return <Detail item={visible[detail]} index={detail} total={visible.length} files={files} onMove={setDetail} onBack={() => setDetail(null)} jobs={jobs} />;
  }

  const doneCount = results.length;
  const total = runnable.length;
  const elapsed = (now - startedAt) / 1000;
  const eta = doneCount ? (elapsed / doneCount) * (total - doneCount) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      {phase === 'setup' && (
        <>
          <div className="notice">
            <IconInfo />
            <span>
              Check many applications at once — for example when an importer submits hundreds of labels. Add the label images and a CSV file with one row per application. Everything is processed on this computer.
            </span>
          </div>
          <div className="batch-setup">
            <section className="panel" aria-labelledby="b-images">
              <div className="panel-head">
                <span className="step" aria-hidden="true">1</span>
                <h2 id="b-images">Label images</h2>
              </div>
              <button type="button" className="dropzone" onClick={() => imageInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}>
                <IconUpload />
                <strong>{files.length ? `${files.length} image${files.length > 1 ? 's' : ''} added — add more` : 'Choose label images'}</strong>
                <span className="small muted">Select many files at once, or drag them (and the CSV) here.</span>
              </button>
              <input ref={imageInput} type="file" accept="image/*,.csv" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
              {files.length > 0 && (
                <div className="row" style={{ marginTop: 12 }}>
                  <span className="muted small" style={{ flex: 1 }}>{files.slice(0, 4).map((f) => f.name).join(', ')}{files.length > 4 ? ` and ${files.length - 4} more` : ''}</span>
                  <button type="button" className="btn quiet" onClick={() => setFiles([])}>Clear</button>
                </div>
              )}
            </section>
            <section className="panel" aria-labelledby="b-csv">
              <div className="panel-head">
                <span className="step" aria-hidden="true">2</span>
                <h2 id="b-csv">Application data (CSV)</h2>
              </div>
              <div className="stack">
                <button type="button" className="dropzone" onClick={() => csvInput.current?.click()}>
                  <IconFile />
                  <strong>{manifest ? `${manifestName}: ${manifest.rows.length} application${manifest.rows.length === 1 ? '' : 's'}` : 'Choose a CSV file'}</strong>
                  <span className="small muted">Columns: application_id, image_files, beverage_type, brand_name, class_type, alcohol_content, net_contents, bottler_name_address, country_of_origin</span>
                </button>
                <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void useCsv(f); e.target.value = ''; }} />
                <div className="row">
                  <button type="button" className="btn quiet" onClick={() => download('label-batch-template.csv', TEMPLATE_CSV)}>
                    <IconDownload /> Download a blank template
                  </button>
                  {manifest && <button type="button" className="btn quiet" onClick={() => { setManifest(null); setManifestName(''); }}>Remove CSV</button>}
                </div>
                {!manifest && files.length > 0 && <p className="small muted">Without a CSV, each image is checked for the government warning only.</p>}
              </div>
            </section>
          </div>

          {(manifest?.problems.length || jobs.some((j) => j.missing.length) || unlisted.length > 0) && (
            <div className="notice warn" role="status">
              <IconInfo />
              <div className="stack" style={{ gap: 4 }}>
                {manifest?.problems.slice(0, 5).map((p) => <span key={p}>{p}</span>)}
                {jobs.filter((j) => j.missing.length).slice(0, 5).map((j) => (
                  <span key={j.id}>{j.id}: image {j.missing.join(', ')} not added{j.files.length ? '' : ' — this application will be skipped'}.</span>
                ))}
                {unlisted.length > 0 && <span>{unlisted.length} image{unlisted.length > 1 ? 's are' : ' is'} not listed in the CSV and will be skipped: {unlisted.slice(0, 3).map((f) => f.name).join(', ')}{unlisted.length > 3 ? '…' : ''}</span>}
              </div>
            </div>
          )}

          <div className="actions">
            <button type="button" className="btn" onClick={loadSample} disabled={loadingSample}>
              {loadingSample ? <IconSpinner /> : <IconUpload />} Load the sample batch (20 applications)
            </button>
            <span className="spacer" />
            <button type="button" className="btn primary big" disabled={!runnable.length || engines.fast === 'error'} onClick={start}>
              Check {runnable.length || ''} application{runnable.length === 1 ? '' : 's'}
            </button>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <IconInfo />
              <span>{error}</span>
            </div>
          )}
        </>
      )}

      {phase !== 'setup' && (
        <section className="panel" aria-live="polite">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.4rem' }}>{phase === 'running' ? `Checking ${doneCount} of ${total}…` : `Checked ${doneCount} application${doneCount === 1 ? '' : 's'}`}</h2>
            <div className="row">
              {phase === 'running' ? (
                <button type="button" className="btn" onClick={() => (stop.current = true)}>Stop</button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setPhase('setup')}>
                    <IconArrowLeft /> New batch
                  </button>
                  <button type="button" className="btn primary" onClick={() => download('label-check-results.csv', resultsToCsv(results))}>
                    <IconDownload /> Download results (CSV)
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="bar" style={{ marginTop: 14 }} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
            <span style={{ width: `${total ? (100 * doneCount) / total : 0}%` }} />
          </div>
          <p className="small muted stat-line" style={{ marginTop: 8 }}>
            {phase === 'running'
              ? `${elapsed.toFixed(0)} s so far${eta !== null ? ` · about ${Math.max(1, Math.round(eta))} s left` : ''}`
              : `Finished in ${((now - startedAt) / 1000).toFixed(0)} s — about ${((now - startedAt) / 1000 / Math.max(1, results.length)).toFixed(1)} s per application, with several checked at once`}
          </p>
        </section>
      )}

      {results.length > 0 && (
        <>
          <div className="summary-chips" role="group" aria-label="Filter results">
            {([
              ['all', 'All'],
              ['fail', VERDICT_TEXT.fail],
              ['review', VERDICT_TEXT.review],
              ['pass', VERDICT_TEXT.pass],
              ...(counts.error ? [['error', 'Could not check']] : []),
            ] as [Filter, string][]).map(([k, label]) => (
              <button key={k} type="button" className="filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {k !== 'all' && <StatusIcon status={k} width={20} height={20} style={{ color: k === 'pass' ? 'var(--ok)' : k === 'review' ? 'var(--warn)' : 'var(--bad)' }} />}
                {label} <span className="count">{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="table-wrap">
            <table className="results">
              <thead>
                <tr>
                  <th scope="col">Result</th>
                  <th scope="col">Application</th>
                  <th scope="col">Brand name</th>
                  <th scope="col">What needs attention</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const job = jobs.find((j) => j.id === r.id);
                  const issues = r.fields.filter((f) => f.status !== 'match' && f.status !== 'skipped');
                  const open = () => r.check && setDetail(i);
                  return (
                    <tr key={r.id} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()} tabIndex={0} aria-label={`Open ${r.id}`}>
                      <td>
                        <span className={`chip s-${r.verdict === 'pass' ? 'match' : r.verdict === 'review' ? 'review' : 'mismatch'}`}>
                          <StatusIcon status={r.verdict} />
                          {r.verdict === 'error' ? 'Could not check' : VERDICT_TEXT[r.verdict]}
                        </span>
                      </td>
                      <td className="num">{r.id}</td>
                      <td>{job?.app.brandName || <span className="muted">—</span>}</td>
                      <td>
                        <div className="issues">
                          {r.error && <span>{r.error}</span>}
                          {issues.slice(0, 3).map((f) => (
                            <span key={f.key}>
                              <b>{FIELD_LABELS[f.key]}:</b> {f.message}
                            </span>
                          ))}
                          {issues.length > 3 && <span>and {issues.length - 3} more…</span>}
                          {!issues.length && !r.error && <span>Nothing — every item matches.</span>}
                        </div>
                      </td>
                      <td className="num">{r.seconds.toFixed(1)} s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Detail({ item, index, total, files, jobs, onMove, onBack }: { item: Done; index: number; total: number; files: File[]; jobs: Job[]; onMove: (i: number) => void; onBack: () => void }) {
  const job = jobs.find((j) => j.id === item.id);
  const [urls, setUrls] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const list = (job?.files ?? []).map((f) => URL.createObjectURL(f));
    setUrls(list);
    heading.current?.focus();
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, [job, files]);
  if (!item.check || !job) return null;
  const images: ViewerImage[] = job.files.map((f, i) => ({ name: f.name, url: urls[i] ?? '', width: item.sizes?.[i]?.width ?? 1, height: item.sizes?.[i]?.height ?? 1 })).filter((v) => v.url);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn" onClick={onBack}>
          <IconArrowLeft /> All results
        </button>
        <strong className="stat-line">
          {item.id} · {index + 1} of {total}
        </strong>
        <div className="row">
          <button type="button" className="btn" disabled={index === 0} onClick={() => onMove(index - 1)}>
            <IconArrowLeft /> Previous
          </button>
          <button type="button" className="btn" disabled={index === total - 1} onClick={() => onMove(index + 1)}>
            Next <IconArrowRight />
          </button>
        </div>
      </div>
      {images.length > 0 && <ResultsView check={item.check} app={job.app} images={images} headingRef={heading} />}
    </div>
  );
}
