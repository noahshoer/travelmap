#!/usr/bin/with-contenv bashio
# Reads the app's configured options and starts the TravelMap server.
# Ref: https://developers.home-assistant.io/docs/apps/tutorial

export TRAVELMAP_ME
export TRAVELMAP_PARTNER
TRAVELMAP_ME="$(bashio::config 'me_name')"
TRAVELMAP_PARTNER="$(bashio::config 'partner_name')"

bashio::log.info "Starting TravelMap (me=${TRAVELMAP_ME}, partner=${TRAVELMAP_PARTNER})..."

exec /usr/bin/travelmap
