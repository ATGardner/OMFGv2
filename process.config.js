module.exports = {
  apps: [
    {
      name: 'OMFGv2',
      script: 'index.js',
      trace: true,
      node_args: '--inspect=0.0.0.0:9229',
      ignore_watch: 'public',
      watch_options: {
        usePolling: true,
      },
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      wait_ready: true,
      max_restarts: 3,
    },
  ],
};
