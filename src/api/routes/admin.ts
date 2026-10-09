import { Router } from 'express';
import {
  getPendingKycDrivers,
  getDriverKycDetail,
  approveDriverKyc,
  rejectDriverKyc,
  getAllDrivers,
  setDriverActiveStatus,
  getAllUsers,
} from '../../lib/adminService';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware';
import pricingRouter from './pricing_admin';
import b2bRouter from './b2b';

const router = Router();

router.use(requireAuth, requireRoles(['ADMIN']));

router.get('/users', async (req, res, next) => {
  try {
    const allUsers = await getAllUsers();
    res.json({ success: true, data: allUsers });
  } catch (err) {
    next(err);
  }
});

router.get('/drivers/kyc-pending', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const result = await getPendingKycDrivers(page, limit);
    res.json({
      success: true,
      data: result.drivers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/drivers/:id/kyc', async (req, res, next) => {
  try {
    if (req.body.action === 'approve') {
      const result = await approveDriverKyc(req.params.id);
      res.json({ success: true, data: result });
    } else if (req.body.action === 'reject') {
      const result = await rejectDriverKyc(req.params.id, req.body.reason);
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action (must be approve or reject)' });
    }
  } catch (err) {
    next(err);
  }
});

router.patch('/drivers/:id/status', async (req, res, next) => {
  try {
    const result = await setDriverActiveStatus(req.params.id, Boolean(req.body.isActive));
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/drivers/:id', async (req, res, next) => {
  try {
    const detail = await getDriverKycDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

router.get('/drivers', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const kycStatus = req.query.kycStatus as string || undefined;
    const isOnlineParam = req.query.isOnline;
    const isOnline = isOnlineParam !== undefined ? isOnlineParam === 'true' : undefined;
    const search = req.query.search as string || undefined;
    
    const result = await getAllDrivers({ page, limit, kycStatus, isOnline, search });
    res.json({
      success: true,
      data: result.drivers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.use('/pricing', pricingRouter);
router.use('/b2b', b2bRouter);

export default router;
