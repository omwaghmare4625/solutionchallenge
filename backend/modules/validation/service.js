const db = require('../../shared/db');
const storage = require('../../shared/storage');
const events = require('../../shared/events');

const sendError = (res, status, message, code) => {
  return res.status(status).json({
    error: message,
    code,
  });
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const mapReportForResponse = (report) => {
  const refs = Array.isArray(report.photo_refs) ? report.photo_refs : [];
  const photoUrls = refs.map((ref) => storage.getUrl(ref));

  const { photo_refs: _photoRefs, ...rest } = report;

  return {
    ...rest,
    photo_urls: photoUrls,
  };
};

async function getReports(req, res) {
  try {
    const status = (req.query?.status || 'pending_review').trim();
    const page = parsePositiveInt(req.query?.page, 1);
    const limit = Math.min(parsePositiveInt(req.query?.limit, 20), 100);
    const offset = (page - 1) * limit;

    const reportsQuery = `
      SELECT * FROM reports
      WHERE status = $1
      ORDER BY submitted_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = 'SELECT COUNT(*) FROM reports WHERE status = $1';

    const [reportsResult, countResult] = await Promise.all([
      db.query(reportsQuery, [status, limit, offset]),
      db.query(countQuery, [status]),
    ]);

    const reports = (reportsResult.rows || []).map(mapReportForResponse);
    const total = Number.parseInt(countResult?.rows?.[0]?.count || '0', 10);

    return res.status(200).json({
      reports,
      total,
      page,
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch reports', 'SERVER_ERROR');
  }
}

async function approve(req, res) {
  try {
    const { id } = req.params || {};

    if (!id || !String(id).trim()) {
      return sendError(res, 422, 'Report id is required', 'INVALID_INPUT');
    }

    const existingQuery = `
      SELECT id, report_id, status
      FROM reports
      WHERE id::text = $1 OR report_id::text = $1
      LIMIT 1
    `;

    const existingResult = await db.query(existingQuery, [id]);
    const existingReport = existingResult?.rows?.[0];

    if (!existingReport || existingReport.status !== 'pending_review') {
      return sendError(res, 409, 'Report already processed or not found', 'REPORT_ALREADY_PROCESSED');
    }

    const updateQuery = `
      UPDATE reports
      SET status = 'auto_approved'
      WHERE id = $1
      RETURNING id, report_id
    `;

    const updateResult = await db.query(updateQuery, [existingReport.id]);
    const updated = updateResult?.rows?.[0];
    const responseReportId = updated?.report_id || updated?.id;

    events.emit('report.approved', {
      report_id: responseReportId,
      emitted_at: new Date().toISOString(),
    });

    return res.status(200).json({
      report_id: responseReportId,
      new_status: 'auto_approved',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to approve report', 'SERVER_ERROR');
  }
}

async function reject(req, res) {
  try {
    const { id } = req.params || {};
    const reason = req.body?.reason;

    if (!id || !String(id).trim()) {
      return sendError(res, 422, 'Report id is required', 'INVALID_INPUT');
    }

    if (!reason || !String(reason).trim()) {
      return sendError(res, 422, 'Rejection reason is required', 'INVALID_INPUT');
    }

    const existingQuery = `
      SELECT id, report_id, status
      FROM reports
      WHERE id::text = $1 OR report_id::text = $1
      LIMIT 1
    `;

    const existingResult = await db.query(existingQuery, [id]);
    const existingReport = existingResult?.rows?.[0];

    if (!existingReport || existingReport.status !== 'pending_review') {
      return sendError(res, 409, 'Report already processed or not found', 'REPORT_ALREADY_PROCESSED');
    }

    const updateQuery = `
      UPDATE reports
      SET status = 'rejected'
      WHERE id = $1
      RETURNING id, report_id
    `;

    const updateResult = await db.query(updateQuery, [existingReport.id]);
    const updated = updateResult?.rows?.[0];
    const responseReportId = updated?.report_id || updated?.id;

    return res.status(200).json({
      report_id: responseReportId,
      new_status: 'rejected',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to reject report', 'SERVER_ERROR');
  }
}

module.exports = {
  getReports,
  approve,
  reject,
};
