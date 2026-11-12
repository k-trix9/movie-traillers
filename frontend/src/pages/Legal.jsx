import { useEffect } from "react";

function usePageTitle(title) {
  useEffect(() => { document.title = title; }, [title]);
}

export function Terms() {
  usePageTitle("Terms of use — FILMORA");
  return (
    <main className="watch-page legal">
      <p className="eyebrow">LEGAL</p>
      <h1 className="page-title">Terms of use</h1>
      <p className="notice">
        <strong>Draft template.</strong> Have a qualified lawyer review and complete this page for your business and
        country before you accept real customers.
      </p>
      <h2>1. The service</h2>
      <p>FILMORA is a monthly subscription service for streaming films. A paid, active membership is required to watch. Titles are available only where FILMORA holds the necessary streaming rights, so the catalogue can differ by country and can change over time.</p>
      <h2>2. Membership and payment</h2>
      <p>Each payment buys one month of access to the chosen plan. Memberships do not renew automatically; renew from your account page when you want to continue. Prices are shown before checkout. Payments are handled by our payment provider and we do not store your card details.</p>
      <h2>3. Screens</h2>
      <p>Each plan allows a limited number of screens to stream at the same time. Playback may stop on an additional screen once the limit is reached.</p>
      <h2>4. Acceptable use</h2>
      <p>You may not share your login in a way that exceeds your plan, copy, record, download or redistribute content, or try to bypass access, region or security controls.</p>
      <h2>5. Refunds and cancellation</h2>
      <p>You can cancel at any time from your account page and keep access until the end of the paid month. <em>[Add your refund policy here.]</em></p>
      <h2>6. Contact</h2>
      <p><em>[Add your business name, address and support email here.]</em></p>
    </main>
  );
}

export function Privacy() {
  usePageTitle("Privacy — FILMORA");
  return (
    <main className="watch-page legal">
      <p className="eyebrow">LEGAL</p>
      <h1 className="page-title">Privacy notice</h1>
      <p className="notice">
        <strong>Draft template.</strong> Have a qualified lawyer review and complete this page (including Rwanda's
        data-protection law and any other country you serve) before launch.
      </p>
      <h2>What we collect</h2>
      <p>Your name, email address and a securely hashed password; your membership and payment records (reference, plan, amount and status — never your card number); what you save to your list and where you stopped watching; and technical session data needed to keep you signed in and to enforce your plan's screen limit.</p>
      <h2>Why we use it</h2>
      <p>To run your account, take and verify payments, let you stream titles you are entitled to, resume where you left off, protect the service and meet legal obligations.</p>
      <h2>Who we share it with</h2>
      <p>Our payment provider (Flutterwave) processes payments. Our video provider (Cloudflare Stream) delivers video. We do not sell your personal data.</p>
      <h2>Cookies</h2>
      <p>We use a single essential cookie to keep you signed in. We do not use advertising cookies.</p>
      <h2>Your rights and contact</h2>
      <p><em>[Add how people can request access, correction or deletion of their data, and your contact email.]</em></p>
    </main>
  );
}
