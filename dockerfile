FROM node:21

COPY package.json .
COPY tsconfig.json .
COPY src /src

RUN npm install -g ts-node

RUN yarn install --production --frozen-lockfile

COPY .env.dockerfile .env

RUN cd /src

CMD ["yarn", "start"]