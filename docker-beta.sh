#!/bin/bash

docker build -t bibelquiz/backend:beta . 

docker stop bibelquiz-beta-backend || :

docker rm bibelquiz-beta-backend || :

docker run \
--env DATABASE_DATABASE=${BQ_BETA_DATABASE_DATABASE} \
--env DATABASE_HOST=${BQ_BETA_DATABASE_HOST} \
--env DATABASE_USER=${BQ_BETA_DATABASE_USER} \
--env DATABASE_PASSWORD=${BQ_BETA_DATABASE_PASSWORD} \
--env LOG_LOGLEVEL=${BQ_LOGLEVEL} \
--name bibelquiz-beta-backend \
--restart unless-stopped \
--network="host" \
--log-driver=loki \
--log-opt loki-url="http://localhost:3100/loki/api/v1/push" \
-p ${BQ_BETA_BACKEND_PORT}:6001 \
-d bibelquiz/backend:beta
