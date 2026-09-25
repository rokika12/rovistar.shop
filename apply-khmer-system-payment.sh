#!/usr/bin/env bash
# Apply the KHMER SYSTEM payment gateway patch and push it as a feature branch.
set -euo pipefail

REPO_DIR="${1:-.}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PATCH_FILE="${SCRIPT_DIR}/khmer-system-payment.patch"
BRANCH="feat/khmer-system-payment"

if ! git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: '$REPO_DIR' is not a Git repository."
  exit 1
fi

if [[ ! -f "$PATCH_FILE" ]]; then
  echo "Error: khmer-system-payment.patch must be in the same folder as this script."
  exit 1
fi

if [[ -n "$(git -C "$REPO_DIR" status --porcelain)" ]]; then
  echo "Error: the repository has uncommitted changes. Commit or stash them first."
  exit 1
fi

if [[ -z "$(git -C "$REPO_DIR" config user.name)" || -z "$(git -C "$REPO_DIR" config user.email)" ]]; then
  echo "Error: configure your Git name and email before running this script."
  echo "Example: git -C '$REPO_DIR' config user.name 'Your Name'"
  echo "         git -C '$REPO_DIR' config user.email 'you@example.com'"
  exit 1
fi

git -C "$REPO_DIR" fetch origin main
git -C "$REPO_DIR" switch main
git -C "$REPO_DIR" pull --ff-only origin main

if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git -C "$REPO_DIR" switch "$BRANCH"
else
  git -C "$REPO_DIR" switch -c "$BRANCH"
fi

git -C "$REPO_DIR" apply --check "$PATCH_FILE"
git -C "$REPO_DIR" apply "$PATCH_FILE"
git -C "$REPO_DIR" add README.md Backend_API Frontend_Dashboard_User/src/pages/PaymentSettings.js Frontend_User/src/pages/Checkout.js
git -C "$REPO_DIR" commit -m "Add Khmer System KHQR gateway"
git -C "$REPO_DIR" push -u origin "$BRANCH"

echo "Done: https://github.com/rokika12/rovistar.shop/compare/main...$BRANCH?expand=1"
