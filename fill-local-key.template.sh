#!/bin/bash
# Copy this to fill-local-key.sh and add your own dev key locally

DEV_KEY="YOUR_DEV_KEY_HERE"

find . -type f \( -name '*.js' -o -name '*.html' \) -exec sed -i '' "s/__API_KEY__/$DEV_KEY/g" {} +
