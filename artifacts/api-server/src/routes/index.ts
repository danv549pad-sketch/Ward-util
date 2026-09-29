import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wardspaceRouter from "./wardspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wardspaceRouter);

export default router;
