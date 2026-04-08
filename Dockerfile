FROM node:20-alpine

WORKDIR /app

# Install dependencies (all deps needed for Next.js build)
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start API server + Next.js
CMD ["sh", "-c", "node server/index.js & npm start"]
