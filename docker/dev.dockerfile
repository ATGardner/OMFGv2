FROM node:18-alpine

LABEL maintainer="Noam (\"Amtrak\") Gal"

WORKDIR /service

ENTRYPOINT ["node", "index.js", "--inspect=0.0.0.0:9229"]
