select cron.schedule(
  'mian-e-ma-daily-download-snapshot',
  '15 0 * * *',
  'select private.capture_github_download_snapshot();'
);
