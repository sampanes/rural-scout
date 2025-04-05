#!/bin/bash

echo "🧼 Reverting any Google API key back to __API_KEY__..."

# Match any Google-style API key and replace it with __API_KEY__
find . -type f \( -name '*.js' -o -name '*.html' \) -exec sed -i '' 's/A[[:alnum:]_-]\{35,\}/__API_KEY__/g' {} +

echo "✅ Reverted dev key. Safe to commit."
