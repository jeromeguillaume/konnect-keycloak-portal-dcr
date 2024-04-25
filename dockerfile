# docker build . -t jeromeguillaume/konnect-keycloak-portal-dcr:1.0
FROM node:21

COPY package.json .
COPY tsconfig.json .
COPY src /src

RUN yarn install --frozen-lockfile

COPY .env.dockerfile .env

RUN cd /src

CMD ["yarn", "start"]