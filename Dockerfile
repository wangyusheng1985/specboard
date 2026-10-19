FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p /data /sessions /workspaces && chown -R node:node /data /sessions /workspaces
USER node
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data SESSION_DIR=/sessions WORKSPACE_ROOT=/workspaces
EXPOSE 3000
CMD ["npm", "start"]
