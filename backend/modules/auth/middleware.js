const authService = require('./service');

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function extractBearerToken(headerValue) {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function buildRequireAuth(deps = {}) {
  const verifyAccessToken = deps.verifyAccessToken || authService.verifyAccessToken;
  const findUserByAuthUserId = deps.findUserByAuthUserId || authService.findUserByAuthUserId;

  return function requireAuth(roles = []) {
    return async function authMiddleware(req, _res, next) {
      try {
        const token = extractBearerToken(req.headers.authorization);
        if (!token) {
          throw createHttpError(401, 'missing_token', 'Authentication token is required');
        }

        const decoded = await verifyAccessToken(token);
        const user = await findUserByAuthUserId(decoded.uid || decoded.id);
        if (!user) {
          throw createHttpError(401, 'user_not_found', 'No application profile exists for this user');
        }

        if (roles.length > 0 && !roles.includes(user.role)) {
          throw createHttpError(403, 'forbidden', 'You do not have access to this resource');
        }

        req.user = {
          ...user,
          role: decoded.role || decoded.user_metadata?.role || user.role,
          ngo_id: decoded.ngo_id || decoded.user_metadata?.ngo_id || user.ngo_id
        };

        next();
      } catch (error) {
        next(error);
      }
    };
  };
}

module.exports = {
  buildRequireAuth,
  requireAuth: buildRequireAuth()
};
