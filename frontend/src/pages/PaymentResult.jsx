import { Link, useSearchParams } from "react-router-dom";

const RESULTS = {
  success: {
    title: "Your payment was verified.",
    message: "Your monthly membership has been updated. Enjoy movies that are available in your region."
  },
  failed: {
    title: "Payment was not completed.",
    message: "No membership was activated. You can return to the plans page and try again."
  },
  pending: {
    title: "Payment status is being confirmed.",
    message:
      "Your payment may still be processing. Do not pay again immediately. Check your account page shortly or contact support if the status does not update."
  }
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const result = RESULTS[params.get("result")] || RESULTS.pending;

  return (
    <main className="watch-page">
      <p className="eyebrow">PAYMENT UPDATE</p>
      <h1 className="page-title">{result.title}</h1>
      <p className="movie-description">{result.message}</p>
      <div className="watch-controls">
        <Link className="button button-primary" to="/">Start watching</Link>
        <Link className="button button-outline" to="/account">View my membership</Link>
      </div>
    </main>
  );
}
