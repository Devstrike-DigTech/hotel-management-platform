# syntax=docker/dockerfile:1
#
# Platform console: production image (Next.js standalone output, non-root).
#
#   docker build -t hotel-platform \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
#   docker run -p 3002:3002 hotel-platform
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they are build arguments (defaults suit a local stack); server-only values
# are read at run time from the container environment.
#
# Building behind a TLS-inspecting proxy: pass its CA certificate as a build
# secret, e.g. `--secret id=extra_ca,src=/path/to/ca.pem` (optional).

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_HOME=/usr/local/share/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- deps: install from the lockfile (pnpm version from package.json) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=extra_ca,required=false \
  if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
  corepack enable && pnpm install --frozen-lockfile

# ---- build ----------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_NAME=HotelOS
ARG NEXT_PUBLIC_APP_DOMAIN=hotelos.ng
ARG NEXT_PUBLIC_SUPPORT_EMAIL=support@hotelos.ng
# development | staging | production (chip in the top bar).
ARG NEXT_PUBLIC_CONSOLE_ENV=production
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_CONSOLE_ENV=$NEXT_PUBLIC_CONSOLE_ENV
COPY . .
# next/font downloads the Google fonts at build time.
# Turbopack fetches them natively, so an extra CA also goes into SSL_CERT_FILE.
RUN --mount=type=secret,id=extra_ca,required=false --mount=type=tmpfs,target=/run/ca \
  if [ -s /run/secrets/extra_ca ]; then \
    cat /etc/ssl/certs/ca-certificates.crt /run/secrets/extra_ca > /run/ca/bundle.pem; \
    export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca SSL_CERT_FILE=/run/ca/bundle.pem; \
  fi; \
  pnpm build && mkdir -p public

# ---- runtime: only the standalone server, static assets and public/ -------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# The API gateway's CSRF check compares the browser's Origin with the request
# origin Next derives. The generated server.js binds HOSTNAME (default 0.0.0.0)
# and Next then reports http://0.0.0.0:<port>, which never matches. Without a
# hostname Next reports http://localhost:<PORT>, like `next start`; so bind all
# interfaces with no hostname (BIND_HOSTNAME overrides), and publish the same
# port the container listens on (PORT). The build fails if the line changes.
RUN sed -i "s/process.env.HOSTNAME || '0.0.0.0'/process.env.BIND_HOSTNAME || undefined/" server.js \
  && grep -q "process.env.BIND_HOSTNAME || undefined" server.js
USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/icon.svg',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
