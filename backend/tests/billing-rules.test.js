import test from "node:test";
import assert from "node:assert/strict";
import { isFlutterwaveTransactionValid, nextBillingDate } from "../src/services/billing-rules.js";
import { licenseCoversTerritory } from "../src/services/license-rules.js";

test("accepts a successful payment with matching reference, currency and amount", () => {
  const transaction = {
    status: "successful",
    tx_ref: "FILMORA-123",
    currency: "USD",
    amount: 6.99
  };
  const payment = {
    reference: "FILMORA-123",
    currency: "USD",
    amount: { toString: () => "6.99" }
  };
  assert.equal(isFlutterwaveTransactionValid(transaction, payment), true);
});

test("rejects an underpaid or mismatched payment", () => {
  const payment = {
    reference: "FILMORA-123",
    currency: "USD",
    amount: { toString: () => "6.99" }
  };
  assert.equal(isFlutterwaveTransactionValid({
    status: "successful", tx_ref: "FILMORA-123", currency: "USD", amount: 1
  }, payment), false);
  assert.equal(isFlutterwaveTransactionValid({
    status: "successful", tx_ref: "OTHER", currency: "USD", amount: 7
  }, payment), false);
});

test("extends a subscription from its current future expiry date", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const currentEnd = new Date("2026-11-20T00:00:00Z");
  const next = nextBillingDate(currentEnd, 1, now);
  assert.equal(next.toISOString(), "2026-12-20T00:00:00.000Z");
});

test("a worldwide license covers a viewer in any country", () => {
  const licenses = [{
    territory: "WORLDWIDE",
    status: "VERIFIED",
    permittedDistribution: true,
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validUntil: null
  }];
  assert.equal(licenseCoversTerritory(licenses, "RW", new Date("2026-11-10T00:00:00Z")), true);
});

test("a country-specific license does not cover another country", () => {
  const licenses = [{
    territory: "RW",
    status: "VERIFIED",
    permittedDistribution: true,
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validUntil: null
  }];
  assert.equal(licenseCoversTerritory(licenses, "KE", new Date("2026-11-10T00:00:00Z")), false);
});


test("clamps month-end billing dates instead of skipping a month", () => {
  const now = new Date("2026-01-31T12:00:00Z");
  const next = nextBillingDate(null, 1, now);
  assert.equal(next.toISOString(), "2026-02-28T12:00:00.000Z");
});
