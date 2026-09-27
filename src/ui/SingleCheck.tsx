import { useCallback, useEffect, useRef, useState } from 'react';
import { needsSecondLook, recheck, type LabelCheck, type Stage } from '../core/checkLabel';
import { EMPTY_APPLICATION, type ApplicationData } from '../domain/types';
import { ImageError, type LabelImage } from '../ocr/browser/decode';
import type { OcrService, ServiceState } from '../ocr/browser/service';
import { loadSampleCases, sampleFile, type SampleCase } from '../samples';
import { ApplicationForm } from './ApplicationForm';
import { ExamplePicker } from './ExamplePicker';
import { IconArrowLeft, IconCheck, IconInfo, IconSpinner } from './icons';
import { ImagePicker, pick, type PickedImage } from './ImagePicker';
import type { ViewerImage } from './LabelViewer';
import { ResultsView } from './Results';

interface Props {
  service: OcrService;
  engines: ServiceState;
}

type Phase = 'edit' | 'checking' | 'done';

const hasAnyField = (a: ApplicationData) => [a.brandName, a.classType, a.alcoholContent, a.netContents, a.bottler, a.countryOfOrigin].some((v) => v.trim());

export function SingleCheck({ service, engines }: Props) {
  const [app, setApp] = useState<ApplicationData>(EMPTY_APPLICATION);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [cases, setCases] = useState<SampleCase[]>([]);
  const [exampleId, setExampleId] = useState('');
  const [phase, setPhase] = useState<Phase>('edit');
  const [stage, setStage] = useState<Stage>('reading');
  const [elapsed, setElapsed] = useState(0);
  const [check, setCheck] = useState<LabelCheck | null>(null);
  const [viewer, setViewer] = useState<ViewerImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<{ key: string; decoded: LabelImage[]; check: LabelCheck } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  const loadExample = useCallback(async (c: SampleCase) => {
    setError(null);
    setExampleId(c.id);
    setApp(c.application);
    try {
      const files = await Promise.all(c.images.map(sampleFile));
      setImages((old) => {
        old.forEach((i) => URL.revokeObjectURL(i.url));
        return files.map(pick);
      });
      setPhase('edit');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Open with a realistic example so the first screen shows what the tool does.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadSampleCases()
      .then((list) => {
        setCases(list);
        const first = list.find((c) => c.id === 'old-tom-bourbon') ?? list[0];
        if (first) void loadExample(first);
      })
      .catch(() => undefined);
  }, [loadExample]);

  // Paste a screenshot straight into the form.
  useEffect(() => {
    if (phase !== 'edit') return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        addFiles(files.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `pasted-${Date.now()}-${i}.png`, { type: f.type })));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  useEffect(() => {
    if (phase !== 'checking') return;
    const t0 = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, [phase]);

  function addFiles(files: File[]) {
    setError(null);
    setExampleId('');
    setImages((old) => [...old, ...files.map(pick)]);
  }

  function removeImage(id: string) {
    setImages((old) => {
      const gone = old.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return old.filter((i) => i.id !== id);
    });
  }

  function startOver() {
    images.forEach((i) => URL.revokeObjectURL(i.url));
    setImages([]);
    setApp(EMPTY_APPLICATION);
    setExampleId('');
    setCheck(null);
    setError(null);
    cache.current = null;
    setPhase('edit');
    window.scrollTo({ top: 0 });
  }

  async function run() {
    if (!images.length) {
      setError('Add at least one picture of the label first.');
      return;
    }
    setError(null);
    setStage('reading');
    setElapsed(0);
    setPhase('checking');
    try {
      const key = images.map((i) => i.id).join('|');
      let decoded: LabelImage[];
      let result: LabelCheck;
      const prev = cache.current;
      if (prev && prev.key === key) {
        // Same images: only the comparison needs to run again (instant).
        decoded = prev.decoded;
        const t0 = performance.now();
        const again = recheck(app, prev.check.readings);
        result =
          needsSecondLook(again) && !prev.check.secondLook
            ? await service.check(app, decoded, setStage)
            : { ...prev.check, result: again, ms: performance.now() - t0 };
      } else {
        decoded = [];
        for (const img of images) decoded.push(await service.decode(img.file));
        result = await service.check(app, decoded, setStage);
      }
      cache.current = { key, decoded, check: result };
      setViewer(images.map((img, i) => ({ name: img.file.name, url: img.url, width: decoded[i].pixels.width, height: decoded[i].pixels.height })));
      setCheck(result);
      setPhase('done');
      requestAnimationFrame(() => heading.current?.focus());
    } catch (e) {
      setPhase('edit');
      setError(e instanceof ImageError ? e.message : `Something went wrong while reading the label: ${(e as Error).message}`);
    }
  }

  if (phase === 'done' && check) {
    return (
      <ResultsView
        check={check}
        app={app}
        images={viewer}
        headingRef={heading}
        actions={
          <div className="row">
            <button type="button" className="btn" onClick={() => setPhase('edit')}>
              <IconArrowLeft /> Change details
            </button>
            <button type="button" className="btn primary" onClick={startOver}>
              Check another label
            </button>
          </div>
        }
      />
    );
  }

  const checking = phase === 'checking';
  return (
    <div>
      {exampleId && (
        <div className="notice" style={{ marginBottom: 20 }}>
          <IconInfo />
          <div className="example-note">
            <span className="pill">Example</span>
            <span>This form is filled in with a built-in example. Press <strong>Check label</strong> to see a result, or replace the details and image with your own.</span>
          </div>
        </div>
      )}
      <div className="check-layout">
        <section className="panel" aria-labelledby="details-heading">
          <div className="panel-head">
            <span className="step" aria-hidden="true">1</span>
            <h2 id="details-heading">Application details</h2>
            <span className="muted small">What the label is supposed to say</span>
          </div>
          <ApplicationForm value={app} onChange={setApp} />
        </section>
        <section className="panel" aria-labelledby="images-heading">
          <div className="panel-head">
            <span className="step" aria-hidden="true">2</span>
            <h2 id="images-heading">Label image</h2>
            <span className="muted small">Front and back if needed</span>
          </div>
          <ImagePicker images={images} onAdd={addFiles} onRemove={removeImage} onReject={setError} />
        </section>
      </div>

      <div className="actions" aria-live="polite">
        {checking ? (
          <div className="progress-card" style={{ flex: 1 }}>
            <ul className="progress-steps">
              <li className={stage === 'reading' ? 'active' : 'done'}>
                {stage === 'reading' ? <IconSpinner /> : <IconCheck />}
                Reading the text on the label
              </li>
              <li className={stage === 'second-look' ? 'active' : ''}>
                {stage === 'second-look' ? <IconSpinner /> : <span style={{ width: 22 }} />}
                {stage === 'second-look' ? 'Taking a closer look (photo, small print or unusual lettering)' : 'Comparing with the application'}
              </li>
            </ul>
            <span className="small muted stat-line">{elapsed.toFixed(1)} seconds</span>
          </div>
        ) : (
          <>
            {cases.length > 0 && <ExamplePicker cases={cases} value={exampleId} onPick={loadExample} />}
            <span className="spacer" />
            {!hasAnyField(app) && images.length > 0 && <span className="small muted">No details entered: only the government warning will be checked.</span>}
            <button type="button" className="btn primary big" onClick={run} disabled={engines.fast === 'error'}>
              {engines.fast === 'loading' ? <IconSpinner /> : <IconCheck />}
              Check label
            </button>
          </>
        )}
      </div>
      {engines.fast === 'loading' && !checking && (
        <p className="small muted" style={{ marginTop: 10 }}>Loading the text reader (first visit only). You can press Check label now; it will start as soon as it is ready.</p>
      )}
      {error && (
        <div className="notice error" role="alert" style={{ marginTop: 16 }}>
          <IconInfo />
          <span>{error}</span>
        </div>
      )}
      {engines.error && (
        <div className="notice warn" role="status" style={{ marginTop: 16 }}>
          <IconInfo />
          <span>{engines.error}</span>
        </div>
      )}
    </div>
  );
}
