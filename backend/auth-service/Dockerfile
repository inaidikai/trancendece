FROM node:20

WORKDIR /app/backend/auth-service
COPY backend/auth-service/package.json ./
RUN npm install
COPY backend/auth-service ./
COPY backend/shared ../shared

EXPOSE 8000
CMD ["npm", "start"]
