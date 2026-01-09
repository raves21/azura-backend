FROM node:23

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma

RUN npm install

COPY . .

ARG NODE_ENV=production

RUN if [ "$NODE_ENV" = "production" ]; then npm run build; fi

EXPOSE 8000