const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Forbidden. You do not have the required access role permissions.' 
      });
    }
    next();
  };
};

const requireSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Authentication required.' });
  }

  const resourceId = req.params.id;
  const isOwner = req.user.id === resourceId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ 
      status: 'error', 
      message: 'Forbidden. You can only view or manage your own profile, unless you are an administrator.' 
    });
  }
  next();
};

const requireOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Authentication required.' });
  }

  // Administrators and librarians always pass ownership rules
  const hasStaffPrivilege = ['admin', 'librarian'].includes(req.user.role);
  if (hasStaffPrivilege) {
    return next();
  }

  // If not staff, they must be the owner of the resource.
  // We attach a helper on req, or check req.params.id in common endpoints (like details/update user)
  const resourceId = req.params.id || req.params.userId || req.body.patron_id || req.body.user_id;
  if (resourceId && req.user.id === resourceId) {
    return next();
  }

  return res.status(403).json({ 
    status: 'error', 
    message: 'Forbidden. You are not authorized to access this resource.' 
  });
};

module.exports = {
  requireRole,
  requireSelfOrAdmin,
  requireOwnership
};
