import { StatusChip } from './status';

export function About() {
  return (
    <div className="panel">
      <div className="prose">
        <h2>What this tool checks</h2>
        <p>
          It compares a label image with the application: brand name, class/type, alcohol content, net contents, bottler or importer name and address,
          country of origin for imports, and the government health warning statement (27 CFR 16.21). The warning must be word-for-word, and
          “GOVERNMENT WARNING:” must be in capital letters and bold (27 CFR 16.22).
        </p>
        <h2>What the results mean</h2>
        <div className="status-key">
          <div><StatusChip status="match" /> The label agrees with the application. Differences in capital letters or punctuation (STONE’S THROW vs Stone’s Throw) still count as a match, and are pointed out.</div>
          <div><StatusChip status="review" /> Something is slightly different or hard to read. The tool shows what it read so you can decide quickly.</div>
          <div><StatusChip status="mismatch" /> The label clearly says something different, for example 40% instead of 45%.</div>
          <div><StatusChip status="missing" /> Required text was not found on the label.</div>
          <div><StatusChip status="skipped" /> Nothing to compare (for example, no country of origin for a U.S. product).</div>
        </div>
        <p>The tool never approves a label it could not read. When it is unsure, it asks you to look.</p>
        <h2>How it works</h2>
        <ul>
          <li>Text is read in your browser by two open-source OCR engines. Tesseract reads clean label artwork in about a second. If anything is not a clear match, PaddleOCR, a neural network that copes with photos, curved bottles, glare and decorative lettering, takes a second look.</li>
          <li>The application values are then searched for on the label, allowing for spacing, capitalisation and common OCR mix-ups such as 0/O. Numbers are compared as numbers: 750 mL equals 0.75 L, and 12 fl oz equals 355 mL.</li>
          <li>Bold type is judged by measuring stroke thickness, because OCR engines do not report font weight.</li>
          <li>Label images never leave this computer. Nothing is uploaded or stored, and the app makes no calls to outside services, so it also works on networks that block cloud AI services.</li>
        </ul>
        <h2>Limits of this prototype</h2>
        <ul>
          <li>It does not measure physical type size (1–3 mm minimum for the warning) because a photo has no scale.</li>
          <li>It does not check every labeling rule, for example age statements, sulfite or color-additive disclosures, or standards of fill.</li>
          <li>Very stylised script, text on a strongly curved surface, or heavy glare may be marked “Please check” rather than decided automatically.</li>
        </ul>
      </div>
    </div>
  );
}
