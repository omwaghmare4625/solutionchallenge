const db = require('../../shared/db');
const { processReport } = require('./service');

async function runDeduplication() {
  const reportsResult = await db.query(
    `
      SELECT id
      FROM reports
      WHERE status = 'auto_approved'
        AND cluster_id IS NULL
      ORDER BY submitted_at ASC
    `
  );

  const reports = reportsResult?.rows || [];

  for (const report of reports) {
    await processReport(report.id);
  }

  return reports.length;
}

module.exports = {
  runDeduplication,
};
