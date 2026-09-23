FROM node:20-bookworm-slim

# git: whatsapp-web.js is installed from GitHub
# chromium + fonts: used by whatsapp-web.js (puppeteer)
# netcat: wait for the database before running migrations
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      git ca-certificates dumb-init netcat-openbsd \
      chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV CHROME_BIN=/usr/bin/chromium

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD for i in $(seq 1 30); do \
      nc -z "${DB_HOST}" "${DB_PORT:-3306}" && break; \
      echo "waiting for database ${DB_HOST}:${DB_PORT:-3306}..."; sleep 2; \
    done \
  && npx sequelize db:migrate \
  && node dist/server.js
