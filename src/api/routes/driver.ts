import { Router } from 'express';
import {
  getVehicleTypes,
  getDriverProfile,
  submitDriverKyc,
  getDriverKycStatus,
  setDriverOnlineStatus,
} from '../../lib/driverService';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware';

const router = Router();

router.get('/vehicle-types', async (req, res, next) => {
  try {
    const types = await getVehicleTypes();
    res.json({ success: true, data: types });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRoles(['DRIVER', 'ADMIN']));

router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const profile = await getDriverProfile(req.user!.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

router.get('/kyc/status', async (req: AuthRequest, res, next) => {
  try {
    const status = await getDriverKycStatus(req.user!.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

router.post('/kyc/submit', async (req: AuthRequest, res, next) => {
  try {
    const updatedProfile = await submitDriverKyc(req.user!.userId, req.body);
    res.json({
      success: true,
      message: 'Nộp hồ sơ KYC thành công. Vui lòng chờ quản trị viên xét duyệt.',
      data: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/status', async (req: AuthRequest, res, next) => {
  try {
    const result = await setDriverOnlineStatus(req.user!.userId, Boolean(req.body.isOnline));
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
