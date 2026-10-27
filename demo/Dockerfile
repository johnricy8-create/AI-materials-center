FROM node:22-alpine AS build

ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
