import { error } from '../utils/reponse.js';

export const verifyAdmin = (req, res, next) => {
  // if (!req.user || req.user.role !== 'admin') {
  //   return error(res, 'Access denied. Admin privileges required.', 403);
  // }
  next();
};
