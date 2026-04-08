FROM node:20-alpine

WORKDIR /app

# Cache bust: 2026-04-08-v7
ARG CACHEBUST=2026-04-08-v7

# Install all dependencies (including devDeps needed for Next.js build)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Pin Express to internal port — Next.js gets the Railway PORT
ENV API_PORT=3001

# Build Next.js — TypeScript errors won't block (set in next.config.js)
RUN npm run build

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start API server and Next.js together
CMD ["sh", "-c", "node server/index.js & npm start"]
