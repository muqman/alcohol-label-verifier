import { useEffect, useState } from 'react';
import type { FieldKey, FieldResult } from '../domain/types';
import { IconZoom } from './icons';

export interface ViewerImage {
  name: string;
  url: string;
  /** Size of the pixels the OCR boxes refer to. */
  width: number;
  height: number;
}

interface Props {
  images: ViewerImage[];
  fields: FieldResult[];
  active: FieldKey | null;
}

function Overlay({ image, index, fields, active }: { image: ViewerImage; index: number; fields: FieldResult[]; active: FieldKey | null }) {
  return (
    <svg className="overlay" viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="none" aria-hidden="true">
      {fields.flatMap((f) =>
        f.evidence
          .filter((e) => e.imageIndex === index)
          .map((e, i) => {
            const pad = Math.max(3, image.width * 0.004);
            const state = active ? (active === f.key ? ' hot' : ' dim') : '';
            return (
              <rect
                key={`${f.key}-${i}`}
                className={`box ${f.status}${state}`}
                x={e.box.x - pad}
                y={e.box.y - pad}
                width={e.box.w + 2 * pad}
                height={e.box.h + 2 * pad}
                rx={pad}
              />
            );
          }),
      )}
    </svg>
  );
}

export function LabelViewer({ images, fields, active }: Props) {
  const [shown, setShown] = useState(0);
  const [zoom, setZoom] = useState(false);

  // Jump to the image holding the field the agent is looking at.
  useEffect(() => {
    if (!active) return;
    const idx = fields.find((x) => x.key === active)?.evidence[0]?.imageIndex;
    if (idx !== undefined) setShown(idx);
  }, [active, fields]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const image = images[Math.min(shown, images.length - 1)];
  if (!image) return null;
  return (
    <div className="viewer">
      {images.length > 1 && (
        <div className="viewer-tabs" role="group" aria-label="Label images">
          {images.map((img, i) => (
            <button key={img.url} type="button" aria-pressed={i === shown} onClick={() => setShown(i)}>
              Image {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="canvas-wrap">
        <img src={image.url} alt={`Label image ${shown + 1}: ${image.name}`} />
        <Overlay image={image} index={shown} fields={fields} active={active} />
      </div>
      <div className="viewer-foot">
        <p className="small muted">Boxes show where each item was found. Point at a result to highlight it.</p>
        <button type="button" className="btn" onClick={() => setZoom(true)}>
          <IconZoom /> Enlarge
        </button>
      </div>
      {zoom && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Enlarged label image">
          <div className="modal-bar">
            <strong>{image.name}</strong>
            <button type="button" className="btn primary" onClick={() => setZoom(false)} autoFocus>
              Close
            </button>
          </div>
          <div className="modal-body" onClick={(e) => e.target === e.currentTarget && setZoom(false)}>
            <div className="canvas-wrap">
              <img src={image.url} alt={`Enlarged label image: ${image.name}`} />
              <Overlay image={image} index={shown} fields={fields} active={active} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
