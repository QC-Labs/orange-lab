#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<EOF
Usage: $0 --app-name <name> --client-name <name> --launch-url <url> --callback-path <path> [options]

Create or refresh a Pocket ID OIDC client for the application stack in the current directory.
Existing clients are reused and their secrets are not rotated.

Required parameters:
  --app-name <name>          Pulumi endpoint and config name, e.g. open-webui
  --client-name <name>       Pocket ID client display name, e.g. "Open WebUI"
  --launch-url <url>         Public application URL and Pocket ID launch URL
  --callback-path <path>     OIDC callback path, e.g. /oauth/oidc/callback

Optional parameters:
  --dark-icon-url <url>      URL for the dark-theme client icon
  --light-icon-url <url>     URL for the light-theme client icon
  -h, --help                 Show this help

Run this script from the application's Pulumi stack directory.

Required Pulumi config:
  pocket:apiKey       API key for the root stack
Required deployed outputs:
  root security.endpoints.pocket
EOF
}

#
# Parameter parsing
#
app_name=''
client_name=''
launch_url=''
callback_path=''
dark_icon_url=''
light_icon_url=''

while (($# > 0)); do
    case "$1" in
        --app-name|--client-name|--launch-url|--callback-path|--dark-icon-url|--light-icon-url)
            if [[ $# -lt 2 || "$2" == -* ]]; then
                printf 'Missing value for %s\n\n' "$1" >&2
                usage >&2
                exit 2
            fi
            case "$1" in
                --app-name) app_name="$2" ;;
                --client-name) client_name="$2" ;;
                --launch-url) launch_url="$2" ;;
                --callback-path) callback_path="$2" ;;
                --dark-icon-url) dark_icon_url="$2" ;;
                --light-icon-url) light_icon_url="$2" ;;
            esac
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'Unknown parameter: %s\n\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

#
# Validation
#
for parameter in app_name client_name launch_url callback_path; do
    if [[ -z "${!parameter}" ]]; then
        printf 'Missing required parameter: --%s\n\n' "${parameter//_/-}" >&2
        usage >&2
        exit 2
    fi
done

#
# Configuration
#
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "${script_dir}/.." && pwd)
root_stack="$repo_root"

if [[ ! -f "$PWD/Pulumi.yaml" ]]; then
    printf 'Run this script from the application Pulumi stack directory.\n' >&2
    exit 1
fi

stack_output() {
    pulumi --cwd "$1" stack output --json
}

if ! pocket_api_key=$(pulumi --cwd "$root_stack" config get pocket:apiKey 2>/dev/null); then
    printf 'Missing secret config: pocket:apiKey\n' >&2
    printf 'Set it with: pulumi config set pocket:apiKey <api-key> --secret\n' >&2
    exit 1
fi

POCKET_ID_URL=$(stack_output "$root_stack" | jq -er '.security.endpoints.pocket')

POCKET_ID_URL="${POCKET_ID_URL%/}"
launch_url="${launch_url%/}"
callback_url="${launch_url}${callback_path}"

#
# Create client
#
client_list=$(curl --fail-with-body --silent --show-error \
    "${POCKET_ID_URL}/api/oidc/clients?pagination%5Bpage%5D=1&pagination%5Blimit%5D=100" \
    -H "X-API-KEY: ${pocket_api_key}")
client_id=$(jq -er --arg name "${client_name}" \
    '[.data[] | select(.name == $name) | .id][0] // empty' <<<"${client_list}" || true)

if [[ -z "${client_id}" ]]; then
    client_response=$(curl --fail-with-body --silent --show-error \
        -X POST "${POCKET_ID_URL}/api/oidc/clients" \
        -H "X-API-KEY: ${pocket_api_key}" \
        -H 'Content-Type: application/json' \
        --data "$(jq -n \
            --arg name "${client_name}" \
            --arg callback_url "${callback_url}" \
            --arg launch_url "${launch_url}" \
            '{
                name: $name,
                callbackURLs: [$callback_url],
                launchURL: $launch_url,
                isPublic: false,
                pkceEnabled: false,
                skipConsent: true
            }')"
    )

    client_id=$(jq -er '.id' <<<"${client_response}")
    secret_response=$(curl --fail-with-body --silent --show-error \
        -X POST "${POCKET_ID_URL}/api/oidc/clients/${client_id}/secret" \
        -H "X-API-KEY: ${pocket_api_key}" \
        -H 'Content-Type: application/json' \
        --data '{}'
    )
    client_secret=$(jq -er '.secret' <<<"${secret_response}")
else
    client_secret=''
fi

#
# Upload icons
#
tmp_dir=$(mktemp -d)
trap 'rm -rf "${tmp_dir}"' EXIT

upload_icon() {
    local url="$1"
    local filename="$2"
    local light="$3"
    local extension="${url##*/}"
    extension="${extension%%\?*}"
    extension="${extension##*.}"
    local mime_type

    case "${extension,,}" in
        svg) mime_type='image/svg+xml' ;;
        png) mime_type='image/png' ;;
        jpg|jpeg) mime_type='image/jpeg' ;;
        webp) mime_type='image/webp' ;;
        *)
            printf 'Unsupported icon format: %s\n' "${extension}" >&2
            exit 1
            ;;
    esac

    local icon_path="${tmp_dir}/${filename}.${extension}"
    curl --fail --silent --show-error -o "${icon_path}" "${url}"
    curl --fail-with-body --silent --show-error \
        -X POST "${POCKET_ID_URL}/api/oidc/clients/${client_id}/logo?light=${light}" \
        -H "X-API-KEY: ${pocket_api_key}" \
        -F "file=@${icon_path};type=${mime_type}"
}

if [[ -n "${dark_icon_url}" ]]; then
    upload_icon "${dark_icon_url}" dark true
fi
if [[ -n "${light_icon_url}" ]]; then
    upload_icon "${light_icon_url}" light false
fi

#
# Output
#
printf '\nClient refreshed: %s\n' "${client_name}"
printf 'pulumi config set %s:auth pocket\n' "${app_name}"
printf 'pulumi config set %s:auth/clientId %q\n' "${app_name}" "${client_id}"
if [[ -n "${client_secret}" ]]; then
    printf 'pulumi config set %s:auth/clientSecret %q --secret\n' "${app_name}" "${client_secret}"
else
    printf 'Existing client reused; its secret was not rotated.\n'
fi
