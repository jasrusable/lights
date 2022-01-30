FROM node:16-buster-slim

WORKDIR /app

COPY ./package.json /app
COPY ./package-lock.json /app
RUN npm i

COPY . /app

ENTRYPOINT [ "npm", "start" ]
