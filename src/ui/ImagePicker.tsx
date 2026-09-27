import { useId, useRef, useState } from 'react';
import { IconPlus, IconUpload } from './icons';

export interface PickedImage {
  id: string;
  file: File;
  url: string;
}

let counter = 0;
export const pick = (file: File): PickedImage => ({ id: `img-${++counter}`, file, url: URL.createObjectURL(file) });

const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);

interface Props {
  images: PickedImage[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onReject?: (message: string) => void;
}

export function ImagePicker({ images, onAdd, onRemove, onReject }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const id = useId();

  const accept = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    const good = files.filter(isImage);
    if (files.length && !good.length) onReject?.('That file is not an image. Please choose a JPEG, PNG or WebP picture of the label.');
    if (good.length) onAdd(good);
  };

  return (
    <div className="stack">
      {images.length > 0 && (
        <ul className={`thumbs${images.length === 1 ? ' single' : ''}`} aria-label="Label images">
          {images.map((img, i) => (
            <li key={img.id} className="thumb">
              <img src={img.url} alt={`Label image ${i + 1}`} />
              <div className="thumb-meta">
                <div>
                  <div className="name">{img.file.name}</div>
                  <div className="small muted">Image {i + 1} of {images.length}</div>
                </div>
                <span className="spacer" />
                <button type="button" className="btn quiet" onClick={() => onRemove(img.id)} aria-label={`Remove ${img.file.name}`}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`dropzone${over ? ' over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files);
        }}
        aria-describedby={`${id}-hint`}
      >
        {images.length ? <IconPlus /> : <IconUpload />}
        <strong>{images.length ? 'Add another image (for example the back label)' : 'Choose a label image'}</strong>
        <span className="small muted" id={`${id}-hint`}>
          Click to browse, drag a file here, or paste a screenshot. JPEG, PNG or WebP.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
