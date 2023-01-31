FROM node:alpine

# Create app directory
ARG port=3001
WORKDIR /opt/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE $port

CMD [ "node", "index.js" ]
