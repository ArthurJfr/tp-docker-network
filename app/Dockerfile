FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY app.js .

EXPOSE 5000

CMD ["node", "app.js"]
