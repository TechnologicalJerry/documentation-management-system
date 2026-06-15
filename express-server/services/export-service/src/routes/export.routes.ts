import { Router } from 'express';
import { authenticate } from '@devdocs/shared-middleware';
import { ExportController } from '../controllers/export.controller';

const controller = new ExportController();
export const exportRouter = Router();

exportRouter.use(authenticate);
exportRouter.post('/', controller.requestExport);
exportRouter.get('/', controller.listExportJobs);
exportRouter.get('/:id', controller.getExportJob);
exportRouter.get('/:id/download', controller.downloadExport);
exportRouter.delete('/:id', controller.deleteExportJob);
