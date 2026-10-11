import Icon from '../components/feedback/Icon';
import cn from '../utils/cn';

const ICON_BY_CATEGORY = {
  'Lifesaving Injections': 'thermometer',
  Vaccines: 'shield',
  Medicine: 'pill',
};

/**
 * A product image with a category-appropriate fallback. Backend products carry
 * `image[{url, publicId}]` where the FIRST entry is the primary/thumbnail —
 * the same convention every role in the app follows.
 */
export default function ProductThumb({ product, size = 'md' }) {
  const url = product?.image?.[0]?.url;
  return (
    <span className={cn('thumb', size === 'lg' && 'thumb--lg')}>
      {url
        ? <img src={url} alt="" loading="lazy" />
        : <Icon name={ICON_BY_CATEGORY[product?.category] || 'pill'} size={size === 'lg' ? 22 : 16} />}
    </span>
  );
}
