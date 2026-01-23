FROM node:20

WORKDIR /app
# Only copy package.json so installs follow package.json (avoid stale package-lock)
COPY package.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
