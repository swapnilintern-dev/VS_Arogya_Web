import { useEffect, useState } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Spinner from '../components/feedback/Spinner';
import { fetchVendorDocument } from '../services/vendorService';

const isPdfName = (doc) => /\.pdf$/i.test(doc?.fileName || '') || /\.pdf(\?|$)/i.test(doc?.url || '');

/**
 * "View" button + in-page preview for a vendor's KYC document. The file is
 * pulled through the admin-only server route (not Cloudinary directly), so it
 * opens even when Cloudinary blocks public PDF links.
 */
export default function DocumentViewer({ vendorId, field, label, doc }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: false, error: null, url: null, type: '' });

  useEffect(() => {
    if (!open) return undefined;
    let objectUrl = null;
    let cancelled = false;
    setState({ loading: true, error: null, url: null, type: '' });
    fetchVendorDocument(vendorId, field)
      .then((blob) => {
        if (cancelled) return;
        // Trust the filename over a generic server type so PDFs always render.
        const type = isPdfName(doc) ? 'application/pdf' : blob.type;
        const typed = blob.type === type ? blob : new Blob([blob], { type });
        objectUrl = URL.createObjectURL(typed);
        setState({ loading: false, error: null, url: objectUrl, type });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err.message, url: null, type: '' });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, vendorId, field, doc]);

  const { loading, error, url, type } = state;
  const download = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.fileName || `${label}${type === 'application/pdf' ? '.pdf' : ''}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <Button size="sm" variant="secondary" icon="eye" onClick={() => setOpen(true)}>View</Button>
      {open && (
        <Modal
          size="xl"
          title={label}
          sub={doc?.fileName}
          onClose={() => setOpen(false)}
          footer={(
            <>
              {url && <Button icon="download" onClick={download}>Download</Button>}
              {url && <Button icon="external" href={url}>Open in new tab</Button>}
              <Button variant="primary" onClick={() => setOpen(false)}>Close</Button>
            </>
          )}
        >
          {loading && <div style={{ display: 'grid', placeItems: 'center', height: '40vh' }}><Spinner /></div>}
          {error && <p style={{ color: 'var(--danger, #b42318)' }}>Could not load this document: {error}</p>}
          {url && (type === 'application/pdf' ? (
            <iframe title={label} src={url} style={{ width: '100%', height: '70vh', border: 0 }} />
          ) : (
            <img
              src={url}
              alt={label}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto', objectFit: 'contain' }}
            />
          ))}
        </Modal>
      )}
    </>
  );
}
