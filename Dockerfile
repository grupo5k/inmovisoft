FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (capa cacheada)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el resto del sitio
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
