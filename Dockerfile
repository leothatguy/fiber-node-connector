FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src

USER node

ENTRYPOINT ["node", "src/index.js"]
