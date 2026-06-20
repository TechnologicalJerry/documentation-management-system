import mongoose, { Schema } from 'mongoose';
import type { ITemplateVersionDocument } from '../types/template.types';

const templateVersionSchema = new Schema<ITemplateVersionDocument>(
  {
    templateId: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    contentHtml: {
      type: String,
      default: '',
    },
    changelog: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const anyRet = ret as any;
        anyRet.id = anyRet._id;
        delete anyRet._id;
        delete anyRet.__v;

        return anyRet;
      },
    },
  },
);

// Compound index for looking up a specific version of a template
templateVersionSchema.index({ templateId: 1, version: 1 }, { unique: true });
templateVersionSchema.index({ templateId: 1, createdAt: -1 });

export const TemplateVersionModel = mongoose.model<ITemplateVersionDocument>(
  'TemplateVersion',
  templateVersionSchema,
);
