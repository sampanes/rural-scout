// Listing links and typed addresses -> clean address parts and geocoder queries.
// Pure functions (no DOM, no Google Maps), loaded before script.js in the page and by node in tests.
// The rules mirror compound-designer's templates/scout_geo.py so both tools read listings the same way:
// - tracking parameters and fragments are dropped from links
// - unit markers (#, %23, "#-", APT 3, LOT 7) are removed
// - a street number that is missing or all zeros (0, 000, 0000) means vacant land with no assigned
//   address: the number is dropped instead of sent to the geocoder
// - the ZIP is a hint, not a key: listing sites disagree on it, so queries without it are tried next
(function (root) {
  const SUFFIXES = new Set(["AVE", "AVENUE", "BLVD", "BOULEVARD", "CIR", "CIRCLE", "CT", "COURT", "CV", "COVE",
    "DR", "DRIVE", "HWY", "HIGHWAY", "LN", "LANE", "LOOP", "PASS", "PATH", "PKWY", "PARKWAY", "PL", "PLACE", "PT",
    "POINT", "RD", "ROAD", "RUN", "SQ", "ST", "STREET", "TER", "TERRACE", "TRL", "TRAIL", "WAY", "XING", "ROW"]);
  const DIRECTIONALS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "NORTH", "SOUTH", "EAST", "WEST"]);
  const UNIT_WORDS = new Set(["APT", "UNIT", "LOT", "SPC", "SPACE", "STE", "SUITE", "BLDG", "TRLR"]);
  const STATES = new Set(("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV " +
    "NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR").split(" "));

  function cleanListingUrl(url) {
    const u = new URL(url.trim());
    return u.origin + u.pathname;
  }

  function splitTokens(tokens) {
    const out = { streetNumber: null, street: "", city: "", state: "", zip: "", unit: "" };
    const toks = tokens.filter(t => t);
    if (toks.length && /^\d{5}(-\d{4})?$/.test(toks[toks.length - 1])) out.zip = toks.pop().slice(0, 5);
    if (toks.length && STATES.has(toks[toks.length - 1].toUpperCase())) out.state = toks.pop().toUpperCase();
    const clean = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.startsWith("#")) {
        out.unit = t.slice(1).replace(/^-+|-+$/g, "");
      } else if (UNIT_WORDS.has(t.toUpperCase()) && i + 1 < toks.length) {
        out.unit = toks[++i];
      } else {
        clean.push(t);
      }
    }
    if (clean.length && /^\d+[A-Za-z]?(-\d+)?$/.test(clean[0])) out.streetNumber = clean.shift();
    // the first suffix after at least one name word ends the street ("St Andrews Dr", "Port St Lucie")
    let last = clean.findIndex((t, k) => k >= 1 && SUFFIXES.has(t.toUpperCase().replace(/\.$/, "")));
    if (last >= 0 && last + 1 < clean.length && DIRECTIONALS.has(clean[last + 1].toUpperCase())) last += 1;
    if (last < 0) {
      out.street = clean.join(" ");
    } else {
      out.street = clean.slice(0, last + 1).join(" ");
      out.city = clean.slice(last + 1).join(" ");
    }
    return out;
  }

  function parseListing(text) {
    text = (text || "").trim();
    let out;
    if (/^https?:\/\//i.test(text)) {
      const url = cleanListingUrl(text);
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(s => s).map(s => decodeURIComponent(s));
      const host = u.hostname.toLowerCase();
      const k = parts.indexOf("homedetails");
      if (host.includes("zillow.") && k >= 0) {
        const slug = (parts[k + 1] || "").replace(/#[^-]*/g, m => "-" + m + "-");
        out = splitTokens(slug.split(/-+/));
        const id = parts.find(s => s.endsWith("_zpid"));
        out.source = "zillow";
        out.listingId = id ? id.slice(0, -5) : "";
      } else if (host.includes("redfin.") && parts.length >= 3) {
        out = splitTokens(parts[2].split(/-+/));
        out.state = out.state || parts[0].toUpperCase();
        out.city = out.city || parts[1].replace(/-/g, " ");
        out.source = "redfin";
        out.listingId = parts.length > 4 && parts[3] === "home" ? parts[4] : "";
      } else if (host.includes("realtor.") && parts.includes("realestateandhomes-detail")) {
        const seg = parts[parts.indexOf("realestateandhomes-detail") + 1].split("_");
        out = splitTokens(seg[0].split(/-+/));
        if (seg.length >= 4) {
          out.city = seg[1].replace(/-/g, " ");
          out.state = seg[2].toUpperCase();
          out.zip = seg[3].slice(0, 5);
        }
        out.source = "realtor";
        out.listingId = seg.length > 4 ? seg[4] : "";
      } else {
        out = splitTokens((parts[parts.length - 1] || "").split(/-+/));
        out.source = host;
        out.listingId = "";
      }
      out.url = url;
    } else {
      const bits = text.split(",").map(b => b.trim());
      out = splitTokens(bits.join(" ").split(/\s+/));
      if (bits.length >= 3) { // commas pin the city
        const first = splitTokens(bits[0].split(/\s+/));
        out.city = bits[1];
        out.street = first.street;
        out.streetNumber = first.streetNumber;
        out.unit = out.unit || first.unit;
      }
      out.source = "text";
      out.listingId = "";
      out.url = "";
    }
    out.vacant = out.streetNumber === null || /^0+$/.test(out.streetNumber);
    if (out.vacant) out.streetNumber = null;
    out.query = joinQuery(out, true);
    return out;
  }

  function joinQuery(p, withZip) {
    const line1 = [p.streetNumber || "", p.street].filter(x => x).join(" ");
    const tail = [p.state, withZip ? p.zip : ""].filter(x => x).join(" ");
    return [line1, p.city, tail].filter(x => x).join(", ");
  }

  // Geocoder queries to try in order, each with how precise a hit would be.
  function geocodeQueries(p) {
    const out = [];
    const add = (q, precision) => { if (q && !out.some(o => o.q === q)) out.push({ q, precision }); };
    const level = p.vacant ? "street" : "address";
    add(joinQuery(p, true), level);
    add(joinQuery(p, false), level);
    if (p.city) add([p.city, p.state].filter(x => x).join(", "), "city");
    if (p.zip) add([p.zip, p.state].filter(x => x).join(" "), "zip");
    return out;
  }

  // The compound-designer command that finds the exact parcel (vacant lots need the listing acreage).
  function scoutCommand(text, acres) {
    const p = parseListing(text);
    const arg = p.url || text.trim();
    return 'python templates\\scout_parcel.py listing "' + arg + '"' + (acres ? " --acres " + acres : (p.vacant ? " --acres <listing acres>" : ""));
  }

  const api = { cleanListingUrl, parseListing, geocodeQueries, scoutCommand };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Listing = api;
})(typeof window !== "undefined" ? window : this);
