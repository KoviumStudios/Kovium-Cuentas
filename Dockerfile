FROM node:24-alpine AS tested
WORKDIR /app
COPY *.cjs *.js *.pem *.json ./
COPY test-client/ ./test-client/
RUN node --test --test-concurrency=1 --test-reporter=tap test-*.cjs; status=$?; if [ -f /tmp/kovium-scale193.json ]; then cat /tmp/kovium-scale193.json; fi; exit "$status"

FROM node:24-alpine

ENV NODE_ENV=production PORT=8787 BIND_HOST=0.0.0.0 \
    PACK_ROOT=/data/packs PROJECTS_FILE=/data/projects.json \
    SESSION_FILE=/data/sessions.json SERVER_KEYS_FILE=/data/server-keys.json

WORKDIR /app
RUN apk add --no-cache su-exec && mkdir -p /data/packs && chown node:node /data /data/packs
COPY --from=tested --chown=node:node /app/server.cjs /app/catalog-channel.cjs /app/desktop-update.cjs /app/admin-access.cjs /app/kovium-accounts.cjs /app/account-skin.cjs /app/public-info.cjs /app/runner-leaderboard.cjs /app/runner-store.cjs /app/runner-continuous-service.cjs /app/runner-admin.cjs /app/runner-model.js /app/runner-continuous.js /app/runner-star.js /app/catalog-public-key.pem /app/launcher-design.js /app/docker-start.cjs /app/projects.example.json ./
COPY docker-entrypoint.sh /usr/local/bin/kovium-entrypoint
RUN chmod 0555 /usr/local/bin/kovium-entrypoint
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(async r=>{const j=await r.json();process.exit(r.ok&&j.ok===true?0:1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/kovium-entrypoint"]
CMD ["node", "docker-start.cjs"]
