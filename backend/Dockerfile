FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Alpine no trae la base de datos de zonas horarias. Sin tzdata la
# variable TZ no resuelve y el proceso se queda en UTC, que es
# justo lo que rompía el corte de tardanza.
RUN apk add --no-cache tzdata
ENV TZ=America/Lima

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
