FROM node:20-alpine

WORKDIR /app

# Install all dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js (TypeScript errors ignored via next.config.js)
RUN npm run build

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start API + Next.js
CMD ["sh", "-c", "node server/index.js & npm start"]
