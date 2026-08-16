FROM node:24-alpine

LABEL maintainer="Noam (\"Amtrak\") Gal"

ENV NODE_ENV=production

# Pinned rather than auto-allocated: the chart's `podSecurityContext.fsGroup`
# has to name this GID to make the mounted cache volume writable, and it cannot
# do that if the number shifts when the base image adds a system user.
RUN addgroup -S -g 10001 omfg && adduser -S -u 10001 -G omfg omfg
USER omfg:omfg

# `COPY --chown` is what creates /service owned by omfg, so WORKDIR comes after
# it — a directory Docker creates for WORKDIR belongs to root, and the app
# would then be unable to mkdir `cache/` and `output/` inside it at runtime.
#
# Dependencies first: this layer is reused until package-lock.json changes,
# which is what makes the emulated arm64 leg of CI cheap. `npm ci --omit=dev`
# installs the lockfile exactly and leaves out the ~275 dev packages — eslint,
# prettier, the TypeScript compilers — that the image has no use for. Nothing
# left has an install script, so there is no toolchain to emulate.
COPY --chown=omfg:omfg package.json package-lock.json /service/
RUN cd /service; npm ci --omit=dev

# Node 24 strips the types natively, so the image runs the .ts sources
# directly. types/ is compile-time only and never read at runtime, and neither
# is test/ or any of the lint and compiler config.
COPY --chown=omfg:omfg index.ts cli.ts arguments.ts /service/
COPY --chown=omfg:omfg src /service/src/

WORKDIR /service

# The API. Documented here because the image serves it by default.
EXPOSE 3000

CMD ["node", "index.ts"]
