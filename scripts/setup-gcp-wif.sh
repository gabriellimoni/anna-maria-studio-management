#!/usr/bin/env bash
#
# Set up Workload Identity Federation so GitHub Actions can push images to
# Google Artifact Registry without a long-lived service account key.
#
# Idempotent: safe to re-run. Each step checks if the resource exists first.
#
# Usage:
#   Edit the variables below (or export them in your shell), then:
#     ./scripts/setup-gcp-wif.sh
#
# Prereqs:
#   - gcloud CLI installed and authenticated (`gcloud auth login`)
#   - You have Owner / IAM Admin on the target GCP project

set -euo pipefail

# ── Required configuration ────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-anna-studio-management-dev}"
GITHUB_REPO="${GITHUB_REPO:-gabriellimoni/anna-maria-studio-management}"   # owner/repo, e.g. "gabriellimoni/anna-maria-studio-management"

# ── Defaults (override via env if you want) ───────────────────────────────────
POOL_ID="${POOL_ID:-github-pool}"
PROVIDER_ID="${PROVIDER_ID:-github-provider}"
SA_NAME="${SA_NAME:-github-deployer}"
AR_LOCATION="${AR_LOCATION:-us-west1}"
AR_REPO="${AR_REPO:-anna-maria-api}"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [[ -z "$PROJECT_ID" || -z "$GITHUB_REPO" ]]; then
  echo "ERROR: PROJECT_ID and GITHUB_REPO must be set." >&2
  echo "  Example: PROJECT_ID=my-proj GITHUB_REPO=me/my-repo $0" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null; then
  echo "ERROR: gcloud CLI not found in PATH." >&2
  exit 1
fi

echo "==> Using project: $PROJECT_ID"
echo "==> GitHub repo:   $GITHUB_REPO"
echo "==> AR repo:       $AR_REPO ($AR_LOCATION)"
echo

gcloud config set project "$PROJECT_ID" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# ── 1. Enable required APIs ───────────────────────────────────────────────────
echo "==> Enabling required APIs..."
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  artifactregistry.googleapis.com

# ── 2. Artifact Registry Docker repo ──────────────────────────────────────────
echo "==> Ensuring Artifact Registry repo exists..."
if ! gcloud artifacts repositories describe "$AR_REPO" \
       --location="$AR_LOCATION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$AR_LOCATION" \
    --description="Anna Maria API images"
else
  echo "    already exists, skipping."
fi

# ── 3. Service account ────────────────────────────────────────────────────────
echo "==> Ensuring service account exists..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions deployer"
else
  echo "    already exists, skipping."
fi

echo "==> Granting Artifact Registry writer on the repo to the SA..."
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$AR_LOCATION" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --condition=None >/dev/null

# ── 4. Workload Identity Pool ─────────────────────────────────────────────────
echo "==> Ensuring Workload Identity Pool exists..."
if ! gcloud iam workload-identity-pools describe "$POOL_ID" \
       --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --display-name="GitHub Actions pool"
else
  echo "    already exists, skipping."
fi

# ── 5. OIDC provider for GitHub ───────────────────────────────────────────────
echo "==> Ensuring OIDC provider exists..."
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
       --location=global \
       --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
else
  echo "    already exists, skipping. (If you changed GITHUB_REPO, delete and re-create the provider.)"
fi

# ── 6. Allow the GitHub repo to impersonate the SA ────────────────────────────
echo "==> Binding GitHub repo to service account impersonation..."
PRINCIPAL_SET="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$PRINCIPAL_SET" >/dev/null

# ── 7. Print the values to paste into GitHub ──────────────────────────────────
PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

cat <<EOF

=============================================================================
 Done. Paste these into your GitHub repo (Settings → Secrets and variables).
=============================================================================

REPO SECRETS
------------
  GCP_WORKLOAD_IDENTITY_PROVIDER = ${PROVIDER_RESOURCE}
  GCP_SERVICE_ACCOUNT            = ${SA_EMAIL}

REPO VARIABLES
--------------
  GCP_PROJECT_ID  = ${PROJECT_ID}
  GCP_AR_LOCATION = ${AR_LOCATION}
  GCP_AR_REPO     = ${AR_REPO}

Image references will look like:
  ${AR_LOCATION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/api:dev
  ${AR_LOCATION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/api:prod

EOF
