import { business } from '../data/site';
import { Arrow } from './Layout';

const mapEmbedUrl =
  'https://www.google.com/maps?q=The%20Kut%20Shoppe%2C%20518%20Main%20Street%2C%20Stroudsburg%2C%20PA%2018360&output=embed';

const directionsUrl =
  'https://www.google.com/maps/search/?api=1&query=The%20Kut%20Shoppe%2C%20518%20Main%20Street%2C%20Stroudsburg%2C%20PA%2018360';

export function LocationMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'location-map location-map-compact' : 'location-map'}>
      <div className="location-map-frame">
        <iframe
          title="Google map showing The Kut Shoppe at 518 Main Street in Stroudsburg"
          src={mapEmbedUrl}
          width="800"
          height="600"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <div className="location-map-details">
        <div>
          <span>Find the shop</span>
          <strong>518 Main Street</strong>
          <p>Downtown Stroudsburg · steps from the Sherman Theater</p>
        </div>
        <div className="location-map-actions">
          <a href={business.phoneHref}>{business.phone}</a>
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            Open directions <Arrow />
          </a>
        </div>
      </div>
    </div>
  );
}
