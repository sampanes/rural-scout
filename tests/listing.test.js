// Tests for listing.js. Run: node tests/listing.test.js  (exit code 1 on failure)
// All addresses and IDs are made up.
const assert = require("assert");
const L = require("../listing.js");

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

test("Zillow vacant lot with an encoded empty unit and share tracking", () => {
  const p = L.parseListing("https://www.zillow.com/homedetails/000-QUIET-HAWK-Trl-%23--Anytown-CO-80000/123_zpid/?utm_campaign=share&utm_source=txt");
  assert.strictEqual(p.url, "https://www.zillow.com/homedetails/000-QUIET-HAWK-Trl-%23--Anytown-CO-80000/123_zpid/");
  assert.strictEqual(p.vacant, true);
  assert.strictEqual(p.streetNumber, null);
  assert.deepStrictEqual([p.street, p.city, p.state, p.zip, p.listingId], ["QUIET HAWK Trl", "Anytown", "CO", "80000", "123"]);
  assert.strictEqual(p.query, "QUIET HAWK Trl, Anytown, CO 80000");
});

test("Zillow unit value and four zeros", () => {
  const p = L.parseListing("https://www.zillow.com/homedetails/0000-Quiet-Hawk-Rd-%2312B-Anytown-CO-80000/9_zpid/");
  assert.strictEqual(p.vacant, true);
  assert.strictEqual(p.unit, "12B");
  assert.strictEqual(p.street, "Quiet Hawk Rd");
});

test("Zillow house with an apartment and a city containing a suffix word", () => {
  const p = L.parseListing("https://www.zillow.com/homedetails/42-Elm-St-APT-3-Port-St-Lucie-FL-34952/77_zpid/");
  assert.deepStrictEqual([p.vacant, p.streetNumber, p.street, p.unit, p.city], [false, "42", "Elm St", "3", "Port St Lucie"]);
});

test("street that starts with a suffix word", () => {
  const p = L.parseListing("https://www.zillow.com/homedetails/5-St-Andrews-Dr-Anytown-CO-80000/1_zpid/");
  assert.deepStrictEqual([p.street, p.city], ["St Andrews Dr", "Anytown"]);
});

test("Redfin and Realtor.com links", () => {
  const r = L.parseListing("https://www.redfin.com/CO/Anytown/0-Quiet-Hawk-Trl-80000/home/555?share=1");
  assert.deepStrictEqual([r.source, r.street, r.city, r.state, r.zip, r.listingId, r.vacant],
    ["redfin", "Quiet Hawk Trl", "Anytown", "CO", "80000", "555", true]);
  const t = L.parseListing("https://www.realtor.com/realestateandhomes-detail/7-Quiet-Hawk-Trl_Any-Town_CO_80000_M1-2");
  assert.deepStrictEqual([t.streetNumber, t.street, t.city, t.state, t.zip], ["7", "Quiet Hawk Trl", "Any Town", "CO", "80000"]);
});

test("typed addresses", () => {
  const p = L.parseListing("000 Quiet Hawk Trl #-, Anytown, CO 80000");
  assert.deepStrictEqual([p.street, p.city, p.state, p.zip, p.vacant], ["Quiet Hawk Trl", "Anytown", "CO", "80000", true]);
  const q = L.parseListing("12 Quiet Hawk Trl Anytown CO");
  assert.deepStrictEqual([q.streetNumber, q.street, q.city, q.state], ["12", "Quiet Hawk Trl", "Anytown", "CO"]);
});

test("geocoder queries fall back from the full line to no ZIP, the city, and the ZIP", () => {
  const qs = L.geocodeQueries(L.parseListing("https://www.zillow.com/homedetails/000-Quiet-Hawk-Trl-%23--Anytown-CO-80000/1_zpid/"));
  assert.deepStrictEqual(qs, [
    { q: "Quiet Hawk Trl, Anytown, CO 80000", precision: "street" },
    { q: "Quiet Hawk Trl, Anytown, CO", precision: "street" },
    { q: "Anytown, CO", precision: "city" },
    { q: "80000 CO", precision: "zip" },
  ]);
  assert.strictEqual(L.geocodeQueries(L.parseListing("12 Quiet Hawk Trl, Anytown, CO 80000"))[0].precision, "address");
});

test("scout command for compound-designer", () => {
  const url = "https://www.zillow.com/homedetails/000-Quiet-Hawk-Trl-%23--Anytown-CO-80000/1_zpid/?utm_source=txt";
  assert.strictEqual(L.scoutCommand(url),
    'python templates\\scout_parcel.py listing "https://www.zillow.com/homedetails/000-Quiet-Hawk-Trl-%23--Anytown-CO-80000/1_zpid/" --acres <listing acres>');
  assert.ok(L.scoutCommand(url, 3).endsWith(" --acres 3"));
  assert.ok(!L.scoutCommand("12 Quiet Hawk Trl, Anytown, CO").includes("--acres"));
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log("[OK] " + name);
  } catch (e) {
    failed++;
    console.log("[X] " + name + "\n    " + e.message.split("\n").join("\n    "));
  }
}
console.log(failed ? "[X] " + failed + " of " + cases.length + " failed" : "[OK] all " + cases.length + " passed");
process.exit(failed ? 1 : 0);
