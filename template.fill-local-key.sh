#!/bin/bash
# Copy this to fill-local-key.sh and add your own dev key locally

DEV_KEY="YOUR_DEV_KEY_HERE"

echo "🔧 Injecting local dev API key..."

DEV_SCRIPT_URL="https://maps.googleapis.com/maps/api/js?key=$DEV_KEY&libraries=places,core"
DEV_SCRIPT_URL_ESCAPED=$(echo "$DEV_SCRIPT_URL" | sed 's/&/\\\&/g')

find . -type f \( -name "*.js" -o -name "*.html" \) \
  -exec sed -i "s|%%MAPS_SCRIPT_URL%%|$DEV_SCRIPT_URL_ESCAPED|g" {} +

echo "✅ Local dev key inserted."