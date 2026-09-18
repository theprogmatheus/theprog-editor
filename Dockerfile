# Estágio 1: Build da aplicação React + Vite
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Estágio 2: Servidor Nginx Alpine com suporte nativo a Cross-Origin Isolation
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copia os arquivos compilados para o subcaminho /theprog-editor
COPY --from=builder /app/dist /usr/share/nginx/html/theprog-editor
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
