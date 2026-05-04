import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import itemsRouter from "./items";
import pipelineRouter from "./pipeline";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import exportsRouter from "./exports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(itemsRouter);
router.use(pipelineRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(exportsRouter);

export default router;
