FROM node:16-buster-slim

COPY . /app

WORKDIR /app

RUN npm i

ENTRYPOINT [ "npm", "start" ]
