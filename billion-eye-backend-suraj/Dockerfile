FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install | npm install pm2 -g
#CMD [ "node", "app.js" ]
CMD ["pm2-runtime", "app.js"]
EXPOSE 5000
