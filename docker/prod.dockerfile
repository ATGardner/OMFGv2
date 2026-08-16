FROM node:24-alpine

LABEL maintainer="Noam (\"Amtrak\") Gal"

ENV NODE_ENV=production

# Install service dependencies. `npm ci --omit=dev` rather than `npm install`:
# it installs the lockfile exactly, which is what makes CI's layer cache
# meaningful, and it leaves out the ~275 dev packages — eslint, prettier, the
# TypeScript compilers — that the image has no use for. Nothing left has an
# install script, so this builds under arm64 emulation without a toolchain.
ADD ./package*.json /service/
RUN cd /service; npm ci --omit=dev

# add service code
ADD . /service

WORKDIR /service

# The API. Documented here because the image serves it by default.
EXPOSE 3000

# Node 24 strips the types natively, so the image runs the .ts sources
# directly. types/ is compile-time only and never read at runtime.
ENTRYPOINT ["node", "index.ts"]
