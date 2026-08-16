FROM node:24-alpine

LABEL maintainer="Noam (\"Amtrak\") Gal"

WORKDIR /service

# Node 24 strips the types natively, so there is no build step and no dist/ to
# run — index.ts is the entrypoint. `--inspect` has to precede the script:
# after it, node passes the flag through to the app as an argument.
ENTRYPOINT ["node", "--inspect=0.0.0.0:9229", "index.ts"]
