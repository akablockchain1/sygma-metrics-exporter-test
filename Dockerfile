FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

FROM node:20 AS production

WORKDIR /app

COPY --from=builder /app /app

RUN npm ci --only=production

EXPOSE 3000

CMD ["node", "exporter.js"]
