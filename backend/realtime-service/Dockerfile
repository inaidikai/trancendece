FROM node:20

WORKDIR /app/backend/realtime-service
COPY backend/realtime-service/package.json ./
RUN npm install
COPY backend/realtime-service ./
COPY backend/shared ../shared

EXPOSE 8003
CMD ["npm", "start"]
