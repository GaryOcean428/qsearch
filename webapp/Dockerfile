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

# Accept build arguments for Vite environment variables
ARG VITE_QSEARCH_API_BASE

# Set as environment variable for the build
ENV VITE_QSEARCH_API_BASE=$VITE_QSEARCH_API_BASE

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the app (now with the environment variable available)
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
