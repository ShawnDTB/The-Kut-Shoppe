const googleReviewsUrl = 'https://www.google.com/maps/search/?api=1&query=The+Kut+Shoppe+518+Main+Street+Stroudsburg+PA';

const reviewExcerpts = [
  {
    name: 'Christopher McCabe',
    text: 'Great community focused shop.',
  },
  {
    name: 'Isaiah Marseille',
    text: 'Always a pleasant experience when I get a haircut.',
  },
  {
    name: 'Carl David Walters, Jr.',
    text: 'Clean & precise',
  },
  {
    name: 'Team-Goya-Gang arango',
    text: 'Not only great cuts but great people.',
  },
  {
    name: 'Damon Weldon',
    text: 'Great barbershop feel, reliable, flexible and always on point.',
  },
  {
    name: 'Brendon Thomas',
    text: 'Great barber shop, friendly atmosphere and very organized.',
  },
] as const;

export function ReviewsPageV4() {
  return (
    <section className="section route-page route-reviews-page route-pattern-reviews v4-reviews-page">
      <div className="container route-wide">
        <header className="route-page-intro v4-reviews-intro">
          <p className="eyebrow">Client reviews</p>
          <h1>The work speaks. Clients confirm it.</h1>
          <p className="lede">Exact excerpts from public Google reviews for The Kut Shoppe.</p>
        </header>

        <div className="reviews-showcase v4-reviews-showcase">
          <section className="reviews-rating-band v4-reviews-rating-band">
            <div><span className="reviews-stars" aria-label="4.9 out of 5 stars">★★★★★</span><strong>4.9</strong><small>59 Google reviews</small></div>
            <p>Every testimonial below preserves the customer’s original wording. Open Google to read the complete reviews and the latest feedback.</p>
            <a className="button" href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Read all Google reviews <span aria-hidden="true">↗</span></a>
          </section>

          <div className="reviews-testimonial-grid v4-review-grid">
            {reviewExcerpts.map((review) => (
              <article key={review.name}>
                <p className="eyebrow">Google review excerpt</p>
                <blockquote>“{review.text}”</blockquote>
                <strong>{review.name}</strong>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
