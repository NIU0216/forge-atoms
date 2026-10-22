FROM node:20-bookworm-slim

# Native modules: better-sqlite3, sharp
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Railway injects PORT; default matches local demo
ENV PORT=3847

EXPOSE 3847

# Listen on 0.0.0.0 (server.js already does)
CMD ["npm", "start"]
