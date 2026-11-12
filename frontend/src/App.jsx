import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Movie from "./pages/Movie.jsx";
import Account from "./pages/Account.jsx";
import PaymentResult from "./pages/PaymentResult.jsx";
import { Privacy, Terms } from "./pages/Legal.jsx";

// The admin area (with the TUS upload library) is only downloaded when it is opened.
const Admin = lazy(() => import("./pages/Admin.jsx"));

function NotFound() {
  return (
    <main className="watch-page">
      <p className="eyebrow">404</p>
      <h1 className="page-title">Page not found</h1>
      <p className="movie-description">The page you are looking for does not exist.</p>
      <div className="watch-controls">
        <Link className="button button-primary" to="/">Back to FILMORA</Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Suspense fallback={<p className="muted" style={{ padding: 40 }}>Loading…</p>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="movie/:slug" element={<Movie />} />
          <Route path="account" element={<Account />} />
          <Route path="payment-result" element={<PaymentResult />} />
          <Route path="admin" element={<Admin />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
