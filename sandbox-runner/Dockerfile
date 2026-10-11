FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends docker.io ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.js /app/server.js
EXPOSE 8080
USER root
CMD ["node", "/app/server.js"]
