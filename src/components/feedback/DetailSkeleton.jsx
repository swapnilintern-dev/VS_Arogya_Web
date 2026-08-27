import PageHeader from '../common/PageHeader';
import { Card, CardBody } from '../common/Card';
import Skeleton from './Skeleton';

/**
 * The loading state for a DETAIL page.
 *
 * A bare centred spinner throws away everything the user needs while they wait:
 * the back link, the breadcrumb trail and any idea of where they are. That
 * matters here because the backend is on a host with cold starts measured in
 * tens of seconds (see the timeout comment in lib/services/auth_service.dart) —
 * long enough that a contextless screen reads as broken.
 *
 * So the chrome stays put and only the BODY is skeletoned: the user can still
 * navigate away, and the layout does not jump when the data lands.
 */
export default function DetailSkeleton({ back, crumbs, title = 'Loading…', rail = true }) {
  return (
    <>
      <PageHeader
        back={back}
        crumbs={crumbs}
        title={title}
        sub={<Skeleton w={260} h={11} style={{ marginTop: 4 }} />}
      />

      <div className="row gap-2 section">
        <Skeleton w={92} h={21} r="var(--r-pill)" />
        <Skeleton w={132} h={21} r="var(--r-pill)" />
      </div>

      <div className={rail ? 'split' : ''}>
        <div className="stack gap-4">
          <Card>
            <div className="card__head"><Skeleton w={140} h={13} /></div>
            <CardBody className="stack gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="row gap-4" key={i}>
                  <Skeleton w={38} h={38} r="var(--r-sm)" />
                  <div className="grow stack gap-2">
                    <Skeleton w={`${60 - i * 6}%`} h={11} />
                    <Skeleton w={`${38 - i * 4}%`} h={9} />
                  </div>
                  <Skeleton w={72} h={12} />
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <div className="card__head"><Skeleton w={120} h={13} /></div>
            <CardBody className="stack gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} w={`${75 - i * 12}%`} h={11} />)}
            </CardBody>
          </Card>
        </div>

        {rail && (
          <div className="rail">
            <Card>
              <div className="card__head"><Skeleton w={100} h={13} /></div>
              <CardBody className="stack gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="between" key={i}>
                    <Skeleton w={78} h={10} />
                    <Skeleton w={104} h={10} />
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
