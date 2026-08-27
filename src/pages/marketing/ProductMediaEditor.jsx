import { useRef, useState } from 'react';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Note from '../../components/common/Note';
import Icon from '../../components/feedback/Icon';
import EmptyState from '../../components/feedback/EmptyState';

/**
 * Product media — a port of lib/marketing/product_media_editor.dart.
 *
 * Multiple images (the FIRST is the primary/thumbnail everywhere, which is why
 * reordering matters) plus ONE optional promotional video. The backend stores
 * images as `image[{url, publicId}]` and the video as `video{url, publicId}`;
 * publicId is kept so a replaced asset can be deleted rather than orphaned.
 */
const MAX_IMAGES = 6;

export default function ProductMediaEditor({ product, media, onChange, disabled }) {
  const imageInput = useRef(null);
  const videoInput = useRef(null);
  const [previews, setPreviews] = useState([]);

  const existing = media.keepImages || [];
  const total = existing.length + media.images.length;

  const addImages = (files) => {
    const room = MAX_IMAGES - total;
    const accepted = Array.from(files).slice(0, Math.max(0, room));
    setPreviews((p) => [...p, ...accepted.map((f) => URL.createObjectURL(f))]);
    onChange({ ...media, images: [...media.images, ...accepted] });
  };

  const removeExisting = (i) => {
    onChange({ ...media, keepImages: existing.filter((_, j) => j !== i) });
  };

  const removeNew = (i) => {
    setPreviews((p) => p.filter((_, j) => j !== i));
    onChange({ ...media, images: media.images.filter((_, j) => j !== i) });
  };

  const move = (i, dir) => {
    const next = [...existing];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...media, keepImages: next });
  };

  if (disabled) {
    return (
      <Note tone="info">
        Save the medicine first — media uploads attach to an existing product.
      </Note>
    );
  }

  return (
    <div className="split">
      <div className="stack gap-4">
        <Card>
          <CardHead
            title="Product images"
            sub={`${total} of ${MAX_IMAGES} used · the first image is the thumbnail shown everywhere`}
            actions={(
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                disabled={total >= MAX_IMAGES}
                onClick={() => imageInput.current?.click()}
              >
                Add images
              </Button>
            )}
          />
          <CardBody>
            {total === 0 ? (
              <EmptyState
                icon="image"
                title="No images yet"
                text="Vendors browse by picture first. Add at least one clear shot of the pack."
                action={<Button variant="primary" icon="plus" onClick={() => imageInput.current?.click()}>Choose images</Button>}
              />
            ) : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {existing.map((img, i) => (
                  <figure key={img.publicId || i} className="card card--flat" style={{ overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '1', background: 'var(--brand-050)', display: 'grid', placeItems: 'center' }}>
                      {img.url
                        ? <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name="image" size={26} />}
                    </div>
                    <figcaption className="row gap-1" style={{ padding: 6 }}>
                      {i === 0 ? <Badge tone="success">Primary</Badge> : <span className="subtle" style={{ fontSize: 10.5 }}>#{i + 1}</span>}
                      <span className="grow" />
                      <Button size="sm" variant="ghost" icon="arrowLeft" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" />
                      <Button size="sm" variant="ghost" icon="arrowRight" onClick={() => move(i, 1)} disabled={i === existing.length - 1} aria-label="Move later" />
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => removeExisting(i)} aria-label="Remove image" />
                    </figcaption>
                  </figure>
                ))}
                {media.images.map((file, i) => (
                  <figure key={`new-${i}`} className="card card--flat" style={{ overflow: 'hidden', borderColor: 'var(--brand-500)' }}>
                    <div style={{ aspectRatio: '1', background: 'var(--brand-050)' }}>
                      <img src={previews[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <figcaption className="row gap-1" style={{ padding: 6 }}>
                      <Badge tone="info">New</Badge>
                      <span className="grow" />
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => removeNew(i)} aria-label="Remove image" />
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { addImages(e.target.files); e.target.value = ''; }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Promotional video"
            sub="One optional video shown on the product page"
            actions={(
              <Button size="sm" variant="secondary" icon="play" onClick={() => videoInput.current?.click()}>
                {product?.video?.url || media.video ? 'Replace video' : 'Add video'}
              </Button>
            )}
          />
          <CardBody>
            {media.video ? (
              <div className="row gap-3">
                <span className="thumb thumb--lg"><Icon name="play" size={20} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 600 }}>{media.video.name}</p>
                  <p className="field__hint">{(media.video.size / 1048576).toFixed(1)} MB · uploads on save</p>
                </div>
                <Button variant="ghost" icon="trash" onClick={() => onChange({ ...media, video: null })} aria-label="Remove video" />
              </div>
            ) : product?.video?.url ? (
              <div className="row gap-3">
                <span className="thumb thumb--lg"><Icon name="play" size={20} /></span>
                <div className="grow">
                  <p style={{ fontWeight: 600 }}>Video attached</p>
                  <p className="field__hint">Stored on Cloudinary</p>
                </div>
                <Button variant="danger-soft" icon="trash" onClick={() => onChange({ ...media, removeVideo: true })}>
                  Remove
                </Button>
              </div>
            ) : (
              <EmptyState icon="play" title="No video" text="Optional — a short clip explaining usage or handling." />
            )}
            <input
              ref={videoInput}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => { onChange({ ...media, video: e.target.files?.[0] || null, removeVideo: false }); e.target.value = ''; }}
            />
          </CardBody>
        </Card>
      </div>

      <div className="rail">
        <Note tone="info">
          Images and video upload to Cloudinary when you save the medicine. The <strong>first</strong> image is
          used as the thumbnail in every role — the catalogue, the cart, invoices and the outlet stock list —
          so put the clearest pack shot first.
        </Note>
        <Note tone="warning">
          Removing an image deletes the stored asset on save. Past orders keep their own snapshotted line
          details, so historical invoices are unaffected.
        </Note>
      </div>
    </div>
  );
}
