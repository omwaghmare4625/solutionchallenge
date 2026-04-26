const db = require('../../shared/db');
const { calculateScore } = require('./service');

async function recalculateScores() {
  const openClustersResult = await db.query(
    `
      SELECT id, category_key, corroborating_report_count
      FROM need_clusters
      WHERE status = 'open'
    `
  );

  const clusters = openClustersResult?.rows || [];

  for (const cluster of clusters) {
    const score = await calculateScore(cluster);

    if (score === null) {
      continue;
    }

    await db.query('UPDATE need_clusters SET composite_score = $1 WHERE id = $2', [score, cluster.id]);
  }

  return clusters.length;
}

module.exports = {
  recalculateScores,
};
