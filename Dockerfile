FROM node:21

# node-gyp needs python and rust
RUN apt-get update -y && apt-get install -y python3
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN curl --tlsv1.3 https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
