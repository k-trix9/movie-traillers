# FILMORA monetization and admin operating model

## Core revenue model

FILMORA is a subscription video-on-demand service. The primary revenue source is paid monthly membership. A customer pays for a defined period and receives playback access while the subscription is active and the movie is licensed in the customer's territory.

The example starter plans are:
- Basic — 1 active screen.
- Standard — up to 2 active screens.
- Family — up to 4 active screens.

The seeded USD amounts are placeholders, not market research or final prices. The database supports separate `PlanPrice` records for different currencies and billing intervals.

## Additional revenue opportunities

These are future business options, not features already implemented in this starter:

1. **Annual membership:** Offer a discount for paying for 12 months upfront.
2. **Gift memberships:** Allow one customer to purchase a prepaid period for another person.
3. **Family upgrades:** Increase permitted concurrent screens.
4. **Business or ISP bundles:** Sell prepaid access codes or bundled memberships through partners.
5. **Content licensing/distribution:** License titles or curated collections to other platforms where contracts allow.
6. **Optional ad-supported tier:** Only if you deliberately introduce a lower-priced or free tier. Do not mix advertising into the paid experience without clearly disclosing it.

## Revenue and cost measurements

Track each currency separately. Do not add RWF, USD and EUR values together without a documented exchange-rate conversion.

Useful metrics:
- Paying active subscribers.
- Monthly recurring revenue equivalent (MRR).
- Average revenue per paying user (ARPPU).
- New subscribers and cancellations.
- Renewal and failed-payment rates.
- Refunds and chargebacks.
- Viewing minutes per subscriber.
- Streaming delivery and storage cost per hour watched.
- Content licensing cost per title or territory.
- Gross contribution after payment, streaming, hosting and content costs.

A useful operating calculation is:

`Contribution = collected subscription revenue - payment fees - refunds - streaming costs - hosting costs - content licence costs - support and operating costs`

Revenue is not profit. Taxes, chargebacks, content rights and marketing costs must also be included.

## Admin dashboard modules to build out

The current code includes a small dashboard overview, movie workflow, payment list and subscription list APIs. A full commercial admin console should include:

- **Overview:** subscribers, revenue by currency, churn, failed payments, top titles and streaming costs.
- **Catalog:** titles, metadata, genres, posters, captions and publication status.
- **Rights management:** rights holder, licence reference, territories, validity dates and proof review.
- **Video operations:** upload progress, encoding state, playback availability and storage/delivery cost alerts.
- **Customers:** account status, subscription status, support history and account actions.
- **Plans and pricing:** plan features, currency-specific prices, discounts and plan availability.
- **Payments:** checkout attempts, verified transactions, refunds, chargebacks and reconciliation.
- **Analytics:** watch time, completion rate, retention, popular titles and device activity.
- **Security:** administrator roles, MFA, session revocation and audit records.
