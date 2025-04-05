#!/bin/bash
echo "🧼 Reverting injected dev API key back to placeholder..."

# Replace the full Google Maps script URL with the placeholder
find . -type f \( -name "*.js" -o -name "*.html" \) \
  -exec sed -i "s|https://maps.googleapis.com/maps/api/js?key=[^&\"']\+&libraries=places,core|%%MAPS_SCRIPT_URL%%|g" {} +

echo "✅ Dev key reverted. Safe to commit."
