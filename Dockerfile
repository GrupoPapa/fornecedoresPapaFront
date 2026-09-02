# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .
# em producao o front chama /api no mesmo host; o nginx encaminha para o backend
ENV VITE_API_URL=""
RUN npm run build

# ---------- runtime ----------
FROM nginx:1.27-alpine
ENV TZ=America/Sao_Paulo

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
