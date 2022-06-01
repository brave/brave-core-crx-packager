FROM node:16

# node-gyp needs python and rust
RUN apt-get update -y && apt-get install -y python
RUN curl --tlsv1.3 https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
