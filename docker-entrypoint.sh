#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  for directory in /data /data/packs; do
    if [ -L "$directory" ]; then
      echo "El volumen no puede ser un enlace simbólico: $directory" >&2
      exit 1
    fi
    if [ -e "$directory" ] && [ ! -d "$directory" ]; then
      echo "El volumen debe ser un directorio: $directory" >&2
      exit 1
    fi
    mkdir -p "$directory"
    chown node:node "$directory"
    chmod 0700 "$directory"
  done
  exec su-exec node:node "$@"
fi

exec "$@"
