const db = require('../../shared/db');
const events = require('../../shared/events');

const DEFAULT_DEDUP_RADIUS_METERS = 200;

const getRadiusMeters = () => {
  const raw = Number(process.env.DEDUP_RADIUS_METERS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DEDUP_RADIUS_METERS;
};

const getReportIdFromPayload = (payload = {}) => payload.report_id || payload.id || null;

async function processReport(report_id) {
  if (!report_id) {
    return null;
  }

  if (typeof db.getPool !== 'function') {
    throw new Error('shared db pool is not available');
  }

  const pool = db.getPool();
  const client = await pool.connect();

  let outcome = null;

  try {
    await client.query('BEGIN');

    const reportResult = await client.query(
      `
        SELECT id, location, category_key, cluster_id
        FROM reports
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [report_id]
    );

    const report = reportResult?.rows?.[0];

    if (!report || !report.location || !report.category_key) {
      await client.query('ROLLBACK');
      return null;
    }

    if (report.cluster_id) {
      await client.query('COMMIT');
      return {
        cluster_id: report.cluster_id,
        report_id,
        action: 'skipped_already_clustered',
      };
    }

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [report.category_key]);

    const radiusMeters = getRadiusMeters();

    const clusterSearchResult = await client.query(
      `
        SELECT id, centroid, corroborating_report_count
        FROM need_clusters
        WHERE category_key = $1
          AND status = 'open'
          AND ST_DWithin(
            centroid::geography,
            (SELECT location::geography FROM reports WHERE id = $2),
            $3
          )
        ORDER BY ST_Distance(
          centroid::geography,
          (SELECT location::geography FROM reports WHERE id = $2)
        )
        LIMIT 1
        FOR UPDATE
      `,
      [report.category_key, report_id, radiusMeters]
    );

    const existingCluster = clusterSearchResult?.rows?.[0];

    if (existingCluster) {
      const updatedClusterResult = await client.query(
        `
          UPDATE need_clusters
          SET
            corroborating_report_count = corroborating_report_count + 1,
            centroid = ST_Centroid(
              ST_Collect(
                centroid,
                (SELECT location FROM reports WHERE id = $2)
              )
            )
          WHERE id = $1
          RETURNING id, corroborating_report_count
        `,
        [existingCluster.id, report_id]
      );

      const updatedCluster = updatedClusterResult?.rows?.[0];

      await client.query('UPDATE reports SET cluster_id = $1 WHERE id = $2', [updatedCluster.id, report_id]);

      outcome = {
        cluster_id: updatedCluster.id,
        report_id,
        action: 'cluster.updated',
        corroborating_report_count: Number(updatedCluster.corroborating_report_count || 1),
      };
    } else {
      const createClusterResult = await client.query(
        `
          INSERT INTO need_clusters (centroid, category_key)
          VALUES ((SELECT location FROM reports WHERE id = $1), $2)
          RETURNING id, corroborating_report_count
        `,
        [report_id, report.category_key]
      );

      const newCluster = createClusterResult?.rows?.[0];

      await client.query('UPDATE reports SET cluster_id = $1 WHERE id = $2', [newCluster.id, report_id]);

      outcome = {
        cluster_id: newCluster.id,
        report_id,
        action: 'cluster.created',
        corroborating_report_count: Number(newCluster.corroborating_report_count || 1),
      };
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (!outcome) {
    return null;
  }

  const payload = {
    cluster_id: outcome.cluster_id,
    report_id: outcome.report_id,
    emitted_at: new Date().toISOString(),
  };

  if (outcome.action === 'cluster.created') {
    events.emit('cluster.created', payload);
  }

  if (outcome.action === 'cluster.updated') {
    events.emit('cluster.updated', payload);
  }

  if ((outcome.corroborating_report_count || 0) >= 3) {
    events.emit('cluster.merge_candidate', {
      cluster_id: outcome.cluster_id,
      emitted_at: new Date().toISOString(),
    });
  }

  return outcome;
}

async function onReportApproved(payload = {}) {
  const report_id = getReportIdFromPayload(payload);
  if (!report_id) {
    return;
  }

  await processReport(report_id);
}

let listenersRegistered = false;

function registerDeduplicationEventListeners() {
  if (listenersRegistered) {
    return;
  }

  events.on('report.auto_approved', onReportApproved);
  events.on('report.approved', onReportApproved);

  listenersRegistered = true;
}

registerDeduplicationEventListeners();

module.exports = {
  processReport,
  registerDeduplicationEventListeners,
};
