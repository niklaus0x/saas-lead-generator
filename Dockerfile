FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV API_PORT=3001

# Build Next.js
RUN npm run build

EXPOSE 3000 3001

CMD ["sh", "-c", "node server/index.js & npm start"]
