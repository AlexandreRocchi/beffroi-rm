# syntax=docker/dockerfile:1
# Image de base paramétrable : pointez NODE_IMAGE vers votre registre interne ou un miroir
# (ex. --build-arg NODE_IMAGE=registre.interne/node:22-bookworm-slim).
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY .npmrc package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
COPY . .
RUN npm run build

# Exécution : le serveur est compilé en un seul fichier, aucune dépendance npm n'est installée.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
COPY LICENSE ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/dist/server.js"]
