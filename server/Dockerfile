FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE 55555

CMD ["node", "app"]