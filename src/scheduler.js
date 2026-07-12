import cron from 'node-cron';
import open from 'open';
import { getDefaultPeriod } from './period.js';
import { generatePreview } from './generator.js';
import { loadPreview, savePreview } from './preview-store.js';
import { submitToZentao } from './zentao.js';

export function startScheduler({ config, baseUrl, onStatus = console.log }) {
  if (!config.schedule?.enabled) return [];
  const timezone = config.schedule.timezone || 'Asia/Shanghai';
  const jobs = [];

  jobs.push(cron.schedule(
    config.schedule.previewCron,
    async () => {
      try {
        const period = getDefaultPeriod(new Date(), timezone);
        const preview = await generatePreview(config, { period });
        await savePreview(preview);
        await open(baseUrl);
        onStatus('Scheduled preview generated.');
      } catch (error) {
        onStatus(`Scheduled preview failed: ${error.message}`);
      }
    },
    { timezone }
  ));

  jobs.push(cron.schedule(
    config.schedule.autoSubmitCron,
    async () => {
      try {
        const preview = await loadPreview();
        if (!preview) throw new Error('No preview exists for scheduled submit.');
        await submitToZentao(config, preview);
        onStatus('Scheduled submit completed.');
      } catch (error) {
        onStatus(`Scheduled submit failed: ${error.message}`);
      }
    },
    { timezone }
  ));

  return jobs;
}
