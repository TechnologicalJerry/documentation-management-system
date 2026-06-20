import mongoose, { Schema } from 'mongoose';
import type { ITemplateRatingDocument } from '../types/template.types';

const templateRatingSchema = new Schema<ITemplateRatingDocument>(
  {
    templateId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (v: number) => Number.isInteger(v),
        message: 'Rating must be an integer between 1 and 5',
      },
    },
    review: {
      type: String,
      trim: true,
      maxlength: 2000,
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

// A user can only rate a template once
templateRatingSchema.index({ templateId: 1, userId: 1 }, { unique: true });
templateRatingSchema.index({ templateId: 1, createdAt: -1 });

export const TemplateRatingModel = mongoose.model<ITemplateRatingDocument>(
  'TemplateRating',
  templateRatingSchema,
);
