#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <image>" >&2
  exit 2
fi

image=$1
container="bookmarker-api-image-smoke-${GITHUB_RUN_ID:-local}-$$"

trap 'docker rm --force "$container" || true' EXIT

docker run --detach \
  --name "$container" \
  --publish 127.0.0.1::8080 \
  --env APP_ORIGIN=https://app.example.invalid \
  --env CF_ACCESS_ISSUER=https://access.example.invalid \
  --env CF_ACCESS_AUD=smoke-audience \
  "$image"

if ! docker exec "$container" test ! -e /app/api/src; then
  echo 'The production API image contains source files or stopped during startup.' >&2
  docker logs "$container" >&2
  exit 1
fi
port=$(docker port "$container" 8080/tcp | sed -n '1s/.*://p')
if [[ -z "$port" ]]; then
  echo 'Docker did not publish the API port.' >&2
  docker logs "$container" >&2
  exit 1
fi

url="http://127.0.0.1:${port}/health"
last_status=000
last_body=''
for ((attempt = 0; attempt < 30; attempt += 1)); do
  response=$(curl --silent --write-out $'\n%{http_code}' --max-time 2 "$url" || true)
  status=${response##*$'\n'}
  body=${response%$'\n'*}
  if [[ "$status" == "$response" ]]; then
    status=000
    body=$response
  fi
  last_status=$status
  last_body=${body:0:256}

  if [[ "$status" == 200 ]]; then
    if [[ "$body" == '{"status":"ok"}' ]]; then
      exit 0
    fi

    echo "The API returned HTTP 200 with an unexpected /health body: ${last_body}." >&2
    docker logs "$container" >&2
    exit 1
  fi

  if [[ $(docker inspect --format '{{.State.Running}}' "$container" || true) != true ]]; then
    echo 'The API container stopped before becoming healthy.' >&2
    docker logs "$container" >&2
    exit 1
  fi

  sleep 1
done

echo "The API did not return HTTP 200 from ${url} (last status: ${last_status}; body: ${last_body})." >&2
docker logs "$container" >&2
exit 1
