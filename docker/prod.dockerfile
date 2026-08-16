FROM node:24-alpine

LABEL maintainer="Noam (\"Amtrak\") Gal"

# install service dependencies
ADD ./package*.json /service/
RUN cd /service; npm install

# add service code
ADD . /service

WORKDIR /service

# Node 24 strips the types natively, so the image runs the .ts sources
# directly. types/ is compile-time only and never read at runtime.
ENTRYPOINT ["node", "index.ts"]
