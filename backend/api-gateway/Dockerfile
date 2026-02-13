FROM node:20

WORKDIR /app/backend/api-gateway
# Only copy package.json so installs follow package.json (avoid stale package-lock)
COPY backend/api-gateway/package.json ./
RUN npm install
COPY backend/api-gateway ./
COPY backend/shared ../shared

EXPOSE 8080
CMD ["npm", "start"]
