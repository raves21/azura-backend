FROM node:23

WORKDIR /app

COPY prisma ./prisma

COPY package*.json ./

RUN npm install

COPY . .

ARG NODE_ENV=production

RUN if [ "$NODE_ENV" = "production" ]; then npm run build; fi

EXPOSE 8000