FROM keymetrics/pm2:8

LABEL maintainer="harmon.ie Collage"

# install common dependencies
# we unfortunately have to rely on an external process which first prepares only the
# /common/*/package.json files in a tar, because of dockerfile limitations and
# preinstall pm2 modules
ADD services/common/bundled_prereqs.tar /common/
RUN for commondir in `ls /common`; do cd /common/$commondir; npm install; done && \
	pm2 install pm2-logrotate

# add common code
ADD services/common /common

# install service dependencies
ARG service_name
ADD services/${service_name}/package.json /service/
ADD services/${service_name}/package-lock.json /service/
RUN cd /service; npm install

# add service code
ADD services/${service_name} /service

WORKDIR /service

VOLUME ["/data"]

ENTRYPOINT ["pm2-docker", "process.config.js", "--no-auto-exit", "--env", "production"]