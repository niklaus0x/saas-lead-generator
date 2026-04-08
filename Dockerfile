FROM node:20-alpine

WORKDIR /app

# Cache bust: 2026-04-08-v8-FORCE
ARG CACHEBUST=2026-04-08-v8-FORCE
RUN echo "Cache bust: $CACHEBUST"

# Install all dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV API_PORT=3001

# Build Next.js
RUN npm run build

# Expose ports
EXPOSE 3000 3001

# Start both servers — Express on API_PORT=3001, Next.js on PORT (Railway)
CMD ["sh", "-c", "node server/index.js & npm start"]
