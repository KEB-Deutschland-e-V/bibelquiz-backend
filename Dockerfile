FROM node:alpine

# Create app directory
WORKDIR /opt/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD [ "node", "index.js" ]
