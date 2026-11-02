# build context is the repo root (see docker-compose.yml)
FROM node:20-alpine AS build
WORKDIR /build
COPY frontend/ ./
RUN npm install && npm run build

FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html
