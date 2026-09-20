#!/usr/bin/env bash
set -e

echo "=== Building RADIX Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Installing RADIX Backend Dependencies ==="
cd backend
python -m pip install --upgrade pip
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
cd ..

echo "=== Build Complete ==="
