FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pytest && rm -rf /var/lib/apt/lists/*
RUN useradd --uid 65532 --no-create-home --shell /usr/sbin/nologin runner
USER 65532:65532
WORKDIR /workspace
CMD ["node", "--test"]
