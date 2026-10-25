import { Router } from 'express';
import * as termsController from '../controllers/terms.controller.js';

const router = Router();

router.get('/current', termsController.current);

export default router;
