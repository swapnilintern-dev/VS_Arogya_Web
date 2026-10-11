import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import FileField from '../../components/forms/FileField';
import DataTable from '../../components/tables/DataTable';
import { useToast } from '../../context/ToastContext';
import { bulkUploadProducts } from '../../services/productService';
import {
  COLUMNS, REQUIRED_COLUMNS, previewWorkbook, downloadTemplate, downloadFailedRows,
} from '../../utils/bulkImport';
import { currency, number } from '../../utils/format';
import { formatDate } from '../../utils/dates';

/**
 * Bulk medicine upload — POST /bulk-upload.
 *
 * The SERVER parses the spreadsheet; this page uploads the file in one request
 * and renders what came back. The preview in between is a courtesy: it reads
 * the sheet with the same rules the controller uses, so a row flagged here is
 * one the server would have rejected — far better found before 300 rows are
 * sent than after.
 */
export default function MarketingBulkUpload() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const pick = async (f) => {
    setFile(f);
    setSheet(null);
    setResult(null);
    setParseError(null);
    if (!f) return;
    setParsing(true);
    try {
      setSheet(await previewWorkbook(f));
    } catch (err) {
      setParseError(err.message || 'Could not read this file.');
    } finally {
      setParsing(false);
    }
  };

  const counts = useMemo(() => {
    const rows = sheet?.rows || [];
    return {
      total: rows.length,
      ok: rows.filter((r) => !r.errors.length).length,
      invalid: rows.filter((r) => r.errors.length).length,
      warned: rows.filter((r) => !r.errors.length && r.warnings.length).length,
      units: rows.reduce((s, r) => s + (r.stock || 0), 0),
    };
  }, [sheet]);

  const headerProblem = !!(sheet && (sheet.missing.length || sheet.misspelled.length));
  const canUpload = !!sheet && !headerProblem && counts.ok > 0 && !uploading;

  const upload = async () => {
    setUploading(true);
    try {
      const res = await bulkUploadProducts(file);
      setResult(res);
      if (res.uploaded > 0 && res.failed === 0) toast.success(`${number(res.uploaded)} medicines added.`);
      else if (res.uploaded > 0) toast.info(`${number(res.uploaded)} added, ${number(res.failed)} rejected.`);
      else toast.error('No medicines were added — see the reasons below.');
    } catch (err) {
      // A 400 from the controller still carries the per-row reasons.
      const body = err.body;
      if (body?.failedProducts) {
        setResult({
          totalRows: body.totalRows ?? 0,
          uploaded: body.uploaded ?? 0,
          failed: body.failed ?? body.failedProducts.length,
          failedProducts: body.failedProducts,
          message: body.message || '',
        });
      }
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  // --- Preview table ---------------------------------------------------------
  const previewColumns = [
    { key: 'excelRow', header: 'Row', width: 60, render: (r) => <span className="mono subtle">{r.excelRow}</span> },
    {
      key: 'title',
      header: 'Medicine',
      render: (r) => (
        <span style={{ display: 'block', minWidth: 0 }}>
          <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{r.title || <span className="subtle">—</span>}</span>
          <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{r.category || '—'}</span>
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (r) => (
        <span className="num">
          {Number.isFinite(r.price) ? currency(r.price) : <span className="subtle">—</span>}
          {(r.doctorPercent > 0 || r.wholesalePercent > 0) && (
            <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
              {r.doctorPercent > 0 && `Dr ${r.doctorPercent}%`}
              {r.doctorPercent > 0 && r.wholesalePercent > 0 && ' · '}
              {r.wholesalePercent > 0 && `WS ${r.wholesalePercent}%`}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'batchNo',
      header: 'Batch',
      render: (r) => (
        <span>
          <span className="mono" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{r.batchNo || '—'}</span>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            {r.expiry ? formatDate(r.expiry) : 'No expiry'} · {number(r.stock)} units
          </span>
        </span>
      ),
    },
    { key: 'images', header: 'Images', align: 'right', render: (r) => <span className="num">{r.images}</span> },
    {
      key: 'status',
      header: 'Check',
      render: (r) => (
        <span style={{ display: 'block', minWidth: 0 }}>
          {r.errors.length
            ? <Badge tone="danger" dot>Will be rejected</Badge>
            : <Badge tone="success" dot>Ready</Badge>}
          {r.errors.length > 0 && (
            <ul className="stack gap-1" style={{ marginTop: 6, paddingLeft: 16, fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>
              {r.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          {r.warnings.length > 0 && (
            <span className="subtle" style={{ display: 'block', marginTop: 4, fontSize: 'var(--fs-xs)' }}>{r.warnings.join(' · ')}</span>
          )}
        </span>
      ),
    },
  ];

  const resultColumns = [
    { key: 'row', header: 'Row', width: 60, render: (r) => <span className="mono subtle">{r.row ?? '—'}</span> },
    { key: 'title', header: 'Medicine', render: (r) => r.title || <span className="subtle">—</span> },
    { key: 'batchNo', header: 'Batch', render: (r) => <span className="mono">{r.batchNo || '—'}</span> },
    { key: 'reason', header: 'Why it was rejected', render: (r) => <span style={{ color: 'var(--danger)' }}>{r.reason}</span> },
  ];

  return (
    <>
      <PageHeader
        back="/marketing/products"
        crumbs={[{ label: 'Medicines', to: '/marketing/products' }, { label: 'Bulk upload' }]}
        title="Bulk upload medicines"
        sub="Add many medicines at once from an Excel or CSV sheet. One row is one medicine."
        actions={<Button icon="download" onClick={downloadTemplate}>Download template</Button>}
      />

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <Card>
            <CardHead
              title="1 · Choose the sheet"
              sub="Fill the template and pick it here. The first sheet in the workbook is the one that is read."
            />
            <CardBody className="stack gap-4">
              <FileField
                label="Excel / CSV file"
                required
                accept=".xlsx,.xls,.csv"
                subtitle="Drop the filled template here"
                value={file}
                onChange={pick}
                error={parseError}
              />
              {parsing && <Note tone="info">Reading the sheet…</Note>}

              {sheet?.missing.length > 0 && (
                <Note tone="danger">
                  <strong>Required columns missing:</strong> {sheet.missing.join(', ')}. Add them and choose the file again.
                </Note>
              )}
              {sheet?.misspelled.length > 0 && (
                <Note tone="danger">
                  <strong>Column names must match exactly.</strong>{' '}
                  {sheet.misspelled.map((m) => `"${m.found}" should be "${m.expected}"`).join('; ')}.
                </Note>
              )}
              {sheet?.unknown.length > 0 && (
                <Note tone="warning">Ignored columns: {sheet.unknown.join(', ')}.</Note>
              )}
            </CardBody>
          </Card>

          {sheet && !headerProblem && !result && (
            <Card>
              <CardHead
                title="2 · Check the rows"
                sub={`${number(counts.total)} rows read from "${sheet.sheetName}". Rows marked "Will be rejected" are sent too, but the server will refuse them.`}
              />
              <DataTable
                columns={previewColumns}
                rows={sheet.rows}
                rowKey={(r) => r.excelRow}
                empty={{ icon: 'file', title: 'No rows', text: 'The sheet has a header but no medicines.' }}
              />
            </Card>
          )}

          {result && (
            <Card>
              <CardHead
                title="Upload result"
                sub={result.message || 'The server has finished processing the sheet.'}
                actions={result.failedProducts.length > 0 && (
                  <Button size="sm" variant="ghost" icon="download" onClick={() => downloadFailedRows(result.failedProducts)}>
                    Download rejected rows
                  </Button>
                )}
              />
              {result.failedProducts.length > 0 ? (
                <DataTable columns={resultColumns} rows={result.failedProducts} rowKey={(r) => `${r.row ?? ''}-${r.batchNo || r.title || ''}`} />
              ) : (
                <CardBody>
                  <Note tone="success">Every row in the sheet was added to the catalogue.</Note>
                </CardBody>
              )}
            </Card>
          )}
        </div>

        <div className="rail">
          {sheet && !headerProblem && (
            <Card>
              <CardHead title={result ? 'Summary' : '3 · Upload'} />
              <CardBody className="stack gap-4">
                <div className="grid grid--2">
                  {result ? (
                    <>
                      <StatTile label="Added" value={number(result.uploaded)} icon="check" tone="info" />
                      <StatTile label="Rejected" value={number(result.failed)} icon="x" tone={result.failed ? 'danger' : undefined} />
                    </>
                  ) : (
                    <>
                      <StatTile label="Ready" value={number(counts.ok)} icon="check" />
                      <StatTile label="Will be rejected" value={number(counts.invalid)} icon="alert" tone={counts.invalid ? 'danger' : undefined} />
                      <StatTile label="With a warning" value={number(counts.warned)} icon="info" />
                      <StatTile label="Opening units" value={number(counts.units)} icon="box" />
                    </>
                  )}
                </div>

                {!result && (
                  <Button
                    variant="primary" size="lg" block icon="send"
                    loading={uploading}
                    disabled={!canUpload}
                    onClick={upload}
                  >
                    Upload {number(counts.total)} rows
                  </Button>
                )}

                {result && (
                  <div className="stack gap-2">
                    <Button variant="primary" block icon="pill" to="/marketing/products">View medicines</Button>
                    <Button variant="secondary" block icon="refresh" onClick={() => pick(null)}>Upload another sheet</Button>
                  </div>
                )}

                {!result && (
                  <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                    The whole sheet is sent in one request. Valid rows are added even if others are rejected,
                    and you get the reason for every rejection.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHead title="Sheet columns" sub="Header names must match exactly." />
            <CardBody>
              <ul className="stack gap-1" style={{ listStyle: 'none', fontSize: 'var(--fs-sm)' }}>
                {COLUMNS.map((c) => (
                  <li key={c.key} className="between">
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>
                      {c.key}
                      {REQUIRED_COLUMNS.includes(c.key) && <span className="field__req"> *</span>}
                    </span>
                    <span className="subtle truncate" style={{ fontSize: 'var(--fs-xs)', maxWidth: '55%', textAlign: 'right' }}>{c.hint}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Note tone="info">
            <strong>Rate cards.</strong> <span className="mono">DR_DIS_%</span> prices the medicine for a
            hospital or clinic buyer and <span className="mono">Wholseller_%</span> for a wholesale buyer —
            both as a percentage off the selling price. Leave them blank and everyone pays the selling price.
          </Note>

          <Note tone="warning">
            Stock from a sheet is recorded on the medicine itself. Open the medicine&rsquo;s Batches tab
            afterwards to track that lot through FEFO allocation.
          </Note>
        </div>
      </div>
    </>
  );
}
