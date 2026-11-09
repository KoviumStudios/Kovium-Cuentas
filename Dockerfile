FROM node:24-alpine

ENV NODE_ENV=production PORT=8787 BIND_HOST=0.0.0.0 \
    PACK_ROOT=/data/packs PROJECTS_FILE=/data/projects.json \
    SESSION_FILE=/data/sessions.json SERVER_KEYS_FILE=/data/server-keys.json

WORKDIR /app
RUN apk add --no-cache su-exec && mkdir -p /data/packs && chown node:node /data /data/packs
COPY --chown=node:node server.cjs docker-start.cjs projects.example.json ./
COPY docker-entrypoint.sh /usr/local/bin/kovium-entrypoint
RUN chmod 0555 /usr/local/bin/kovium-entrypoint
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(async r=>{const j=await r.json();process.exit(r.ok&&j.ok===true?0:1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/kovium-entrypoint"]
CMD ["node", "docker-start.cjs"]
