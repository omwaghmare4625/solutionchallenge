const db = require('../../shared/db');
const events = require('../../shared/events');

const LOG_10001 = Math.log(10001);
const ACTIVE_TASK_STATUSES = ['dispatched', 'claimed', 'in_progress'];

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampMin = (value, min) => (value < min ? min : value);

const getHoursBetween = (olderDate, newerDate = new Date()) => {
  if (!olderDate) {
    return 0;
  }

  const from = olderDate instanceof Date ? olderDate : new Date(olderDate);
  if (Number.isNaN(from.getTime())) {
    return 0;
  }

  const hours = (newerDate.getTime() - from.getTime()) / (1000 * 60 * 60);
  return hours > 0 ? hours : 0;
};

const buildRawScore = ({ severity, populationAffected, hoursElapsed, timeSensitivityHours }) => {
  const safeSeverity = clampMin(toFiniteNumber(severity, 0), 0);
  const safePopulation = clampMin(toFiniteNumber(populationAffected, 0), 0);
  const safeTimeSensitivityHours = clampMin(toFiniteNumber(timeSensitivityHours, 48), 1);

  return (
    0.4 * (safeSeverity / 5) +
    0.35 * (Math.log(safePopulation + 1) / LOG_10001) +
    0.25 * (1 - hoursElapsed / safeTimeSensitivityHours)
  );
};

async function getClusterInputs(clusterId, cluster = null) {
  const clusterResult = await db.query(
    `
      SELECT id, category_key, corroborating_report_count, status
      FROM need_clusters
      WHERE id = $1
      LIMIT 1
    `,
    [clusterId]
  );

  const persistedCluster = clusterResult?.rows?.[0];
  if (!persistedCluster) {
    return null;
  }

  const reportsAggregateResult = await db.query(
    `
      SELECT
        COALESCE(MAX(r.severity), 0) AS severity,
        COALESCE(SUM(r.population_affected), 0) AS population_affected,
        COALESCE(MAX(r.submitted_at), NOW()) AS submitted_at,
        COALESCE(NULLIF(MIN(r.time_sensitivity_hours), 0), 48) AS time_sensitivity_hours,
        COALESCE(MAX(r.category_key), $2) AS category_key
      FROM reports r
      WHERE r.cluster_id = $1
        AND r.status <> 'rejected'
    `,
    [clusterId, persistedCluster.category_key || cluster?.category_key || null]
  );

  const reportInputs = reportsAggregateResult?.rows?.[0] || {};

  return {
    id: persistedCluster.id,
    category_key: reportInputs.category_key || persistedCluster.category_key || cluster?.category_key || 'unknown',
    corroborating_report_count: toFiniteNumber(
      persistedCluster.corroborating_report_count ?? cluster?.corroborating_report_count,
      1
    ),
    severity: toFiniteNumber(reportInputs.severity, cluster?.severity ?? 0),
    population_affected: toFiniteNumber(reportInputs.population_affected, cluster?.population_affected ?? 0),
    submitted_at: reportInputs.submitted_at || cluster?.submitted_at || new Date().toISOString(),
    time_sensitivity_hours: toFiniteNumber(
      reportInputs.time_sensitivity_hours,
      cluster?.time_sensitivity_hours ?? 48
    ),
  };
}

async function getCategoryMaxRawScore(categoryKey) {
  if (!categoryKey) {
    return null;
  }

  const result = await db.query(
    `
      WITH cluster_report_inputs AS (
        SELECT
          nc.id,
          COALESCE(MAX(r.category_key), nc.category_key) AS category_key,
          COALESCE(MAX(r.severity), 0) AS severity,
          COALESCE(SUM(r.population_affected), 0) AS population_affected,
          COALESCE(MAX(r.submitted_at), NOW()) AS submitted_at,
          COALESCE(NULLIF(MIN(r.time_sensitivity_hours), 0), 48) AS time_sensitivity_hours
        FROM need_clusters nc
        LEFT JOIN reports r
          ON r.cluster_id = nc.id
          AND r.status <> 'rejected'
        WHERE nc.category_key = $1
        GROUP BY nc.id
      )
      SELECT MAX(
        (0.4 * (severity / 5.0))
        + (0.35 * (LN(population_affected + 1) / LN(10001)))
        + (0.25 * (
            1 - (
              EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 3600.0
            ) / GREATEST(time_sensitivity_hours::float, 1)
          ))
      ) AS max_raw
      FROM cluster_report_inputs
      WHERE submitted_at >= NOW() - INTERVAL '30 days'
    `,
    [categoryKey]
  );

  const maxRaw = toFiniteNumber(result?.rows?.[0]?.max_raw, null);
  return Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : null;
}

async function hasActiveTasks(clusterId) {
  const result = await db.query(
    `
      SELECT 1
      FROM tasks
      WHERE cluster_id = $1
        AND status = ANY($2::text[])
      LIMIT 1
    `,
    [clusterId, ACTIVE_TASK_STATUSES]
  );

  return (result?.rowCount || 0) > 0;
}

async function calculateScore(cluster) {
  const clusterId = cluster?.id;
  if (!clusterId) {
    return null;
  }

  const inputs = await getClusterInputs(clusterId, cluster);
  if (!inputs) {
    return null;
  }

  const safeTimeSensitivityHours = clampMin(toFiniteNumber(inputs.time_sensitivity_hours, 48), 1);
  const hoursElapsed = getHoursBetween(inputs.submitted_at);

  const sRaw = buildRawScore({
    severity: inputs.severity,
    populationAffected: inputs.population_affected,
    hoursElapsed,
    timeSensitivityHours: safeTimeSensitivityHours,
  });

  const categoryMaxRaw = await getCategoryMaxRawScore(inputs.category_key);
  const sNormalized = categoryMaxRaw ? sRaw / categoryMaxRaw : sRaw;

  const decay = Math.max(0, 1 - hoursElapsed / (safeTimeSensitivityHours * 2));
  const confidenceBonus = Math.min(
    0.3,
    (clampMin(toFiniteNumber(inputs.corroborating_report_count, 1), 1) - 1) * 0.1
  );

  let sFinal = sNormalized * decay + confidenceBonus;

  if (await hasActiveTasks(clusterId)) {
    sFinal *= 0.5;
  }

  if (!Number.isFinite(sFinal)) {
    return 0;
  }

  return sFinal;
}

async function recalculateClusterScore(clusterId) {
  if (!clusterId) {
    return null;
  }

  const score = await calculateScore({ id: clusterId });
  if (score === null) {
    return null;
  }

  await db.query('UPDATE need_clusters SET composite_score = $1 WHERE id = $2', [score, clusterId]);
  return score;
}

async function onReportApproved(payload = {}) {
  const reportId = payload.report_id || payload.id;
  if (!reportId) {
    return;
  }

  const reportResult = await db.query(
    `
      SELECT cluster_id
      FROM reports
      WHERE id = $1
      LIMIT 1
    `,
    [reportId]
  );

  const clusterId = reportResult?.rows?.[0]?.cluster_id;
  if (!clusterId) {
    return;
  }

  await recalculateClusterScore(clusterId);
}

async function onClusterChanged(payload = {}) {
  const clusterId = payload.cluster_id || payload.id;
  if (!clusterId) {
    return;
  }

  await recalculateClusterScore(clusterId);
}

let listenersRegistered = false;

function registerScoringEventListeners() {
  if (listenersRegistered) {
    return;
  }

  events.on('report.approved', onReportApproved);
  events.on('report.auto_approved', onReportApproved);
  events.on('cluster.created', onClusterChanged);
  events.on('cluster.updated', onClusterChanged);
  listenersRegistered = true;
}

registerScoringEventListeners();

module.exports = {
  calculateScore,
  recalculateClusterScore,
  registerScoringEventListeners,
};
