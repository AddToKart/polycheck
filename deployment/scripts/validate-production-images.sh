#!/usr/bin/env sh
set -eu

fail() {
  printf 'validate-production-images: %s\n' "$*" >&2
  exit 1
}

env_file="${1:-}"
read_setting() {
  setting_name="$1"
  current_value="$2"
  if [ -n "$current_value" ] || [ -z "$env_file" ]; then
    printf '%s' "$current_value"
    return
  fi
  [ -r "$env_file" ] || fail "cannot read environment file: $env_file"
  awk -v key="$setting_name" '
    index($0, key "=") == 1 { sub(/^[^=]*=/, ""); sub(/\r$/, ""); value=$0 }
    END { printf "%s", value }
  ' "$env_file"
}

validate_image() {
  variable_name="$1"
  image_ref="$2"
  [ -n "$image_ref" ] || fail "$variable_name is required"
  case "$image_ref" in
    *[[:space:]]*) fail "$variable_name contains whitespace" ;;
    *:latest|*:local|*/*:local|polycheck-*) fail "$variable_name uses a mutable/local reference: $image_ref" ;;
  esac

  # Only registry digests are truly immutable. Tags — including sha-<commit>
  # tags — are retargetable by anyone with registry write access, so they are
  # rejected for production.
  if printf '%s\n' "$image_ref" | grep -Eq '^.+@sha256:[a-f0-9]{64}$'; then
    return 0
  fi
  fail "$variable_name must be a registry digest reference ending in @sha256:<64 lowercase hex>"
}

validate_image BACKEND_IMAGE "$(read_setting BACKEND_IMAGE "${BACKEND_IMAGE:-}")"
validate_image FRONTEND_IMAGE "$(read_setting FRONTEND_IMAGE "${FRONTEND_IMAGE:-}")"
printf 'Production application image references are immutable.\n'
