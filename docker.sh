#!/bin/bash

docker build -t bibelquiz/backend:latest . 

docker stop bibelquiz-backend || :

docker rm bibelquiz-backend || :

docker run \
--env DATABASE_DATABASE=${BQ_DATABASE_DATABASE} \
--env DATABASE_HOST=${BQ_DATABASE_HOST} \
--env DATABASE_USER=${BQ_DATABASE_USER} \
--env DATABASE_PASSWORD=${BQ_DATABASE_PASSWORD} \
--env LOG_LOGLEVEL=${BQ_LOGLEVEL} \
--name bibelquiz-backend \
--restart unless-stopped \
--network="host" \
--log-driver=loki \
--log-opt loki-url="http://localhost:3100/loki/api/v1/push" \
-p ${BQ_BACKEND_PORT}:3001 \
-d bibelquiz/backend:latest
