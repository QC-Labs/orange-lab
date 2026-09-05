#!/bin/sh
set -e

php /var/www/html/occ app:install user_oidc || true
php /var/www/html/occ app:enable user_oidc || true

NEXTCLOUD_OIDC_ENDSESSION_ENDPOINT=$(php -r '$discovery = json_decode(file_get_contents(getenv("NEXTCLOUD_OIDC_DISCOVERY_URI")), true); echo $discovery["end_session_endpoint"] ?? "";')
[ -n "$NEXTCLOUD_OIDC_ENDSESSION_ENDPOINT" ] || {
    echo "OIDC discovery document has no end_session_endpoint" >&2
    exit 1
}

NEXTCLOUD_OIDC_CLIENT_SECRET="$NEXTCLOUD_OIDC_CLIENT_SECRET" php /var/www/html/occ user_oidc:provider PocketID \
    --clientid="$NEXTCLOUD_OIDC_CLIENT_ID" \
    --clientsecret-env=NEXTCLOUD_OIDC_CLIENT_SECRET \
    --discoveryuri="$NEXTCLOUD_OIDC_DISCOVERY_URI" \
    --endsessionendpointuri="$NEXTCLOUD_OIDC_ENDSESSION_ENDPOINT" \
    --postlogouturi="$OVERWRITECLIURL/apps/user_oidc/backchannel-logout/PocketID" \
    --scope='openid email profile groups' \
    --mapping-uid='preferred_username' \
    --mapping-display-name='name' \
    --mapping-email='email' \
    --mapping-avatar='picture' \
    --unique-uid=1 \
    --send-id-token-hint=0 \
    --group-provisioning=1 \
    --group-whitelist-regex="$NEXTCLOUD_OIDC_GROUP_WHITELIST_REGEX"
