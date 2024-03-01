FROM node:20@sha256:f3299f16246c71ab8b304d6745bb4059fa9283e8d025972e28436a9f9b36ed24

# node-gyp needs python and rust
RUN apt-get update -y && apt-get install -y python3
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN curl --tlsv1.3 https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
