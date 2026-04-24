// TODO : 보안 참고 : https://expressjs.com/ko/advanced/best-practice-security.html

import './init';

import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import https from 'https';
import { exec } from 'child_process';
import path from 'path';
import { RemoteIpAddressSetter } from '@middlewares';
import fs from 'fs';
import http from 'http';
import axios from 'axios';
import routes from './routes';
import scheduler from './scheduler';

const app = express();

const isSecure = process.env.APP_SECURE === 'true';

if (isSecure) app.set('trust proxy', 1);

app.disable('x-powered-by');

let isDisableKeepAlive = false;

app.use(function (req, res, next) {
  if (isDisableKeepAlive) {
    res.set('Connection', 'close');
  }
  next();
});

process.on('SIGINT', () => {
  ll('process.on', 'SIGINT');
  isDisableKeepAlive = true;

  let serverCount = servers.length;
  for (const server of servers) {
    server.close(() => {
      serverCount -= 1;
      if (serverCount === 0) {
        process.exit(0);
      }
    });
  }
});

app.use(helmet());
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

if (
  process.env.SESSION_DRIVER === 'redis' &&
  process.env.APP_KEY &&
  process.env.PROJECT_NAME &&
  process.env.SESSION_REDIS_HOST &&
  process.env.SESSION_REDIS_PORT
) {
  const redisClient = createClient({
    socket: {
      host: process.env.SESSION_REDIS_HOST,
      port: Number(process.env.SESSION_REDIS_PORT),
    },
    password: process.env.SESSION_REDIS_PASSWORD,
  });
  redisClient.connect().catch(console.error);

  const redisStore = new RedisStore({
    client: redisClient,
    prefix: `${process.env.PROJECT_NAME.toLowerCase().replace(/-/g, '_')}:`,
  });

  app.use(
    session({
      store: redisStore,
      resave: false,
      saveUninitialized: false,
      secret: process.env.APP_KEY,
    })
  );
}

let realRoutes = routes;
app.use('/', RemoteIpAddressSetter, function (req, res, next) {
  realRoutes(req, res, next);
});

function startServer() {
  const handleListen = () => {
    scheduler.$start();

    if (typeof process.send === 'function') {
      process.send('ready');
    }

    ll(`Listening : ${isSecure ? process.env.APP_SECURE_PORT : process.env.APP_PORT}`);

    // 슬랙에 서버 실행 메시지 발송
    if (env.isNotLocal && notEmpty(process.env.SLACK_WEB_HOOK_URL)) {
      exec('git remote -v', (err, stdout, stderr) => {
        if (!err || notEmpty(stderr)) {
          const appName = path.basename(stdout.split('\n')[0].split('\t')[1].split(' ')[0], '.git');
          axios
            .post(
              process.env.SLACK_WEB_HOOK_URL,
              {
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'plain_text',
                      text: `:rocket: ${appName} (${env.env})  서버가 실행되었습니다. :rocket:`,
                    },
                  },
                  {
                    type: 'divider',
                  },
                ],
              },
              {
                timeout: 1000 * 60,
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
              }
            )
            .then(() => {
              //
            });
        }
      });
    }
  };

  const servers = [];

  if (isSecure) {
    servers.push(
      https
        .createServer(
          {
            key: fs.readFileSync(process.env.APP_SECURE_KEY_PATH),
            cert: fs.readFileSync(process.env.APP_SECURE_CERT_PATH),
          },
          app
        )
        .listen(process.env.APP_SECURE_PORT, handleListen)
    );

    servers.push(
      http
        .createServer(function (req, res) {
          res.writeHead(301, {
            Location: `https://${req.headers['host']}${req.url}`,
          });
          res.end();
        })
        .listen(process.env.APP_PORT, () => ll(`Listening : ${process.env.APP_PORT}`))
    );
  } else {
    servers.push(http.createServer(app).listen(process.env.APP_PORT, handleListen));
  }

  if (process.env.APP_KEEP_ALIVE === 'true') {
    for (const server of servers) {
      server.keepAliveTimeout = Number(process.env.APP_KEEP_ALIVE_TIMEOUT_SECONDS) * 1000;
      server.headersTimeout = (Number(process.env.APP_KEEP_ALIVE_TIMEOUT_SECONDS) + 1) * 1000;
    }
  }

  return servers;
}

let servers = startServer();

if (module.hot) {
  module.hot.accept(['./@types', './common', './controllers', './init', './middlewares', './db', './scheduler']);

  module.hot.accept('./routes', () => {
    import('./routes').then((routes) => {
      realRoutes = routes.default;
    });

    for (const server of servers) {
      server.close();
    }
    servers = startServer();
  });
}
