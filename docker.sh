#!/bin/bash

docker build -t bibelquiz/backend:latest . 

docker stop bibelquiz-backend || :

docker rm bibelquiz-backend || :

docker run \
--env DATABASE_DATABASE=bibelquiz \
--env DATABASE_HOST=database \
--env DATABASE_USER=bibelquiz \
--env DATABASE_PASSWORD=bibelquiz \
--env LOG_LOGLEVEL=DEBUG \
--name bibelquiz-backend \
--restart unless-stopped \
--link bibelquiz-database:database \
-p 3000:3000 \
-d bibelquiz/backend:latest
