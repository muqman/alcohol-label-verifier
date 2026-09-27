import { useEffect, useState } from 'react';
import { getOcrService, type ServiceState } from './ocr/browser/service';
import { About } from './ui/About';
import { BatchCheck } from './ui/BatchCheck';
import { BrandMark } from './ui/icons';
import { SingleCheck } from './ui/SingleCheck';

type Tab = 'single' | 'batch' | 'about';
const TABS: { id: Tab; label: string }[] = [
  { id: 'single', label: 'Check one label' },
  { id: 'batch', label: 'Check a batch' },
  { id: 'about', label: 'How it works' },
];

const fromHash = (): Tab => {
  const h = window.location.hash.replace('#', '');
  return h === 'batch' || h === 'about' ? h : 'single';
};

export default function App() {
  const service = getOcrService();
  const [engines, setEngines] = useState<ServiceState>(service.state);
  const [tab, setTab] = useState<Tab>(fromHash);

  useEffect(() => service.subscribe(setEngines), [service]);
  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', t === 'single' ? window.location.pathname + window.location.search : `#${t}`);
  };

  const status =
    engines.fast === 'error'
      ? { cls: 'error', text: 'Text reader failed to load' }
      : engines.fast === 'loading'
        ? { cls: '', text: 'Loading text reader…' }
        : { cls: 'ready', text: 'Ready · runs on this computer' };

  return (
    <>
      <header className="site-header">
        <div className="shell">
          <div className="brand">
            <BrandMark className="brand-mark" />
            <div>
              <h1>
                Alcohol Label Checker<span className="tag">Prototype</span>
              </h1>
              <p>Compares label artwork with the application, field by field</p>
            </div>
          </div>
          <div className="engine-status" role="status" aria-live="polite">
            <span className={`engine-dot ${status.cls}`} aria-hidden="true" />
            {status.text}
          </div>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        <div className="shell" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} className="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => choose(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="shell">
        {/* Keep both tools mounted so switching tabs never loses work. */}
        <div role="tabpanel" id="panel-single" aria-labelledby="tab-single" hidden={tab !== 'single'}>
          <SingleCheck service={service} engines={engines} />
        </div>
        <div role="tabpanel" id="panel-batch" aria-labelledby="tab-batch" hidden={tab !== 'batch'}>
          <BatchCheck service={service} engines={engines} />
        </div>
        {tab === 'about' && (
          <div role="tabpanel" id="panel-about" aria-labelledby="tab-about">
            <About />
          </div>
        )}
      </main>
      <footer className="site-footer">
        <div className="shell">
          <span>Prototype for evaluation — not an official government system.</span>
          <span>Label images stay on this computer. Nothing is uploaded or stored.</span>
        </div>
      </footer>
    </>
  );
}
