FROM node:20

WORKDIR /app/backend/diary-service
COPY backend/diary-service/package.json ./
RUN npm install
COPY backend/diary-service ./
COPY backend/shared ../shared

EXPOSE 8002
CMD ["npm", "start"]
