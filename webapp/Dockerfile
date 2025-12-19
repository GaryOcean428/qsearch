# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./

# Install dependencies
RUN yarn install --immutable

# Build stage
FROM base AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the app
RUN yarn build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install serve globally
RUN npm install -g serve

# Copy built assets
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start serve
CMD ["serve", "dist", "-l", "3000"]
