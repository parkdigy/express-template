/* eslint-disable */
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { EsbuildPlugin } = require('esbuild-loader');
const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');
const TsConfigJson = require('./tsconfig.json');
/* eslint-enable */

const isProduction = process.env.NODE_ENV === 'production';

const alias = {};
if (TsConfigJson.compilerOptions.paths) {
  const paths = TsConfigJson.compilerOptions.paths;
  Object.keys(paths).forEach((key) => {
    alias[key] = path.resolve(__dirname, paths[key][0]);
  });
}

module.exports = {
  mode: isProduction ? 'production' : 'development',
  target: 'node',
  stats: isProduction ? 'normal' : 'errors-warnings',
  resolve: {
    extensions: ['.js', '.ts'],
    alias,
  },
  entry: {
    main: './src/app.ts',
  },
  output: {
    path: path.join(__dirname, isProduction ? 'dist' : '@dev'),
    filename: 'app.js',
  },
  externals: {
    express: 'commonjs express',
    knex: 'commonjs knex',
    mysql: 'commonjs mysql',
    mssql: 'commonjs mssql',
    // redis 에서 참조하는 모듈로 빌드 시 warning 발생하여 externals 처리
    '@opentelemetry/api': 'commonjs @opentelemetry/api',
    // redis 에서 참조하는 모듈로 빌드 시 warning 발생하여 externals 처리
    '@node-rs/xxhash': 'commonjs @node-rs/xxhash',
  },
  experiments: {
    topLevelAwait: true,
  },
  optimization: {
    minimize: isProduction,
    minimizer: [
      new EsbuildPlugin({
        target: 'es2015',
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.(ts)$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        loader: 'esbuild-loader',
        options: {
          target: 'es2015',
        },
      },
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    new ESLintPlugin({
      extensions: ['js', 'jsx', 'ts', 'tsx'],
      failOnError: isProduction,
      exclude: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, 'dist')],
    }),
  ].filter(Boolean),
};
