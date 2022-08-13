FROM node:18-alpine

LABEL maintainer="Noam (\"Amtrak\") Gal"

# install service dependencies
ADD ./package*.json /service/
RUN cd /service; npm install

# add service code
ADD . /service

WORKDIR /service

ENTRYPOINT ["node", "index.js"]
