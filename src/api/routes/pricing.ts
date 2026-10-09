import { Router } from 'express';
import { getPricingRules, getSurchargeServices, estimateBookingPrice } from '../../lib/pricingService';

const router = Router();

router.post('/estimate', async (req, res, next) => {
  try {
    const result = await estimateBookingPrice(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/rules', async (req, res, next) => {
  try {
    const rules = await getPricingRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    const services = await getSurchargeServices();
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

export default router;
