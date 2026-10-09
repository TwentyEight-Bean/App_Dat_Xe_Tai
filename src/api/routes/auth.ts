import { Router } from 'express';
import { requestOtp, verifyOtp } from '../../lib/otpService';
import { requireAuth, type AuthRequest } from '../middleware';

const router = Router();

router.post('/request-otp', async (req, res, next) => {
  try {
    const result = await requestOtp(req.body.phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const result = await verifyOtp(req.body.phone, req.body.otp);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
