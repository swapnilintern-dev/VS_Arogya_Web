import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Icon from '../../components/feedback/Icon';

/**
 * Static company content, mirroring the app's About Us screen — including the
 * cold-chain storage guidance, which is genuinely operational information for a
 * pharmacy rather than marketing copy.
 */
const STRENGTHS = [
  ['shield', 'Licensed wholesale supply', 'Every product is sourced through licensed channels with full batch traceability from warehouse to counter.'],
  ['thermometer', 'Validated cold chain', 'Vaccines and biologicals move in temperature-controlled transport and are handed over within specification.'],
  ['layers', 'Batch-level accountability', 'Order lines carry the batch number and expiry that was actually dispatched, printed on your tax invoice.'],
  ['truck', 'Network delivery', 'A delivery network and area agents across serviced pincodes, with live order tracking.'],
];

const STORAGE = [
  ['Vaccines & biologicals', '2°C to 8°C', 'Never freeze. Discard if the cold chain is broken.'],
  ['Insulin (unopened)', '2°C to 8°C', 'In-use pens may be kept below 25°C for the labelled period.'],
  ['Most tablets & capsules', 'Below 25°C', 'Dry place, away from direct sunlight.'],
  ['Reconstituted antibiotics', '2°C to 8°C', 'Use within the period stated on the pack after reconstitution.'],
];

export default function VendorAbout() {
  return (
    <>
      <PageHeader title="About VS Arogya" sub="Who we are and how we supply your counter." />

      <section
        className="hero section"
        style={{ padding: 'var(--sp-10) var(--sp-8)' }}
      >
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '62ch' }}>
          <p className="hero__eyebrow">B2B pharmaceutical distribution</p>
          <h2 style={{ fontSize: 'var(--fs-2xl)', marginTop: 8, lineHeight: 1.2 }}>
            Medicines, vaccines and lifesaving injections — delivered with the batch record intact.
          </h2>
          <p style={{ color: 'rgba(255,255,255,.78)', marginTop: 12, fontSize: 'var(--fs-md)' }}>
            VS Arogya supplies pharmacies, clinics and hospitals across the region. Every order is
            allocated first-expiry-first-out, invoiced with GST, and traceable to the exact lot that left
            our warehouse.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2 className="section__title">Why pharmacies order from us</h2></div>
        <div className="grid grid--2">
          {STRENGTHS.map(([icon, title, text]) => (
            <Card key={title}>
              <CardBody className="row gap-4">
                <span className="stat__icon" style={{ width: 40, height: 40 }}><Icon name={icon} size={18} /></span>
                <div>
                  <p style={{ fontWeight: 700 }}>{title}</p>
                  <p className="subtle" style={{ fontSize: 'var(--fs-sm)', marginTop: 3, lineHeight: 1.6 }}>{text}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <Card>
          <CardHead
            title="Recommended storage temperatures"
            sub="Keep these in view at the counter — a broken cold chain cannot be recovered."
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Product group</th><th>Store at</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {STORAGE.map(([group, temp, note]) => (
                  <tr key={group}>
                    <td style={{ fontWeight: 600 }}>{group}</td>
                    <td><span className="badge badge--info">{temp}</span></td>
                    <td className="muted">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="section">
        <Card>
          <CardHead title="Product range" />
          <CardBody className="grid grid--3">
            {[
              ['pill', 'Medicine', 'Tablets, capsules, syrups, topicals and consumables for everyday dispensing.'],
              ['shield', 'Vaccines', 'Routine and travel vaccines, moved and handed over under validated cold chain.'],
              ['thermometer', 'Lifesaving injections', 'Emergency and critical-care injectables, stocked for rapid dispatch.'],
            ].map(([icon, title, text]) => (
              <div key={title} className="stack gap-2">
                <span className="stat__icon" style={{ width: 38, height: 38 }}><Icon name={icon} size={17} /></span>
                <p style={{ fontWeight: 700 }}>{title}</p>
                <p className="subtle" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>
    </>
  );
}
