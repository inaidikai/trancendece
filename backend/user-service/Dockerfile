FROM node:20

WORKDIR /app/backend/user-service
COPY backend/user-service/package.json ./
RUN npm install
COPY backend/user-service ./

EXPOSE 8001
CMD ["npm", "start"]
