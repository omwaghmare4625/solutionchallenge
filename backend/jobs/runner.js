const cron = require('node-cron');
const { recalculateScores } = require('../modules/scoring/job');
const { runDeduplication } = require('../modules/deduplication/job');

async function runRecalculateScoresSafely() {
  try {
    await recalculateScores();
  } catch (error) {
    // Intentionally avoid throwing so scheduler remains active.
    console.error('[jobs/runner] recalculateScores failed', error);
  }
}

async function runDeduplicationSafely() {
  try {
    await runDeduplication();
  } catch (error) {
    // Intentionally avoid throwing so scheduler remains active.
    console.error('[jobs/runner] runDeduplication failed', error);
  }
}

function startJobRunner() {
  cron.schedule('*/15 * * * *', runRecalculateScoresSafely);
  cron.schedule('*/15 * * * *', runDeduplicationSafely);
}

startJobRunner();

module.exports = {
  startJobRunner,
};
