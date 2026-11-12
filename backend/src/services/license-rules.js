export function licenseCoversTerritory(licenses, countryCode, now = new Date()) {
  return licenses.some((license) => {
    const validNow =
      license.status === "VERIFIED" &&
      license.permittedDistribution === true &&
      new Date(license.validFrom) <= now &&
      (!license.validUntil || new Date(license.validUntil) >= now);

    if (!validNow) return false;
    if (String(license.territory).toUpperCase() === "WORLDWIDE") return true;
    if (!countryCode) return false;
    return String(license.territory).toUpperCase() === String(countryCode).toUpperCase();
  });
}
