FROM node:15.4.0-alpine

# Create app directory
WORKDIR /opt/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD [ "node", "index.js" ]
