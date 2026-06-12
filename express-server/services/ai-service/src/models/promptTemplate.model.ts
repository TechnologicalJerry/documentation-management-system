import mongoose, { Document, Schema, Model } from 'mongoose';
import { GenerationType } from './generation.model';

export interface IPromptTemplate {
  name: string;
  type: GenerationType;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPromptTemplateDocument extends IPromptTemplate, Document {}

const promptTemplateSchema = new Schema<IPromptTemplateDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: Object.values(GenerationType),
      required: true,
      index: true,
    },
    systemPrompt: {
      type: String,
      required: true,
    },
    userPromptTemplate: {
      type: String,
      required: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      maxlength: 500,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        const anyRet = ret as any;
        anyRet.id = String(anyRet._id);
        delete anyRet._id;

        return anyRet;
      },
    },
    toObject: {
      transform(_doc, ret) {
        const anyRet = ret as any;
        anyRet.id = String(anyRet._id);
        delete anyRet._id;

        return anyRet;
      },
    },
  },
);

// Only one default template per type
promptTemplateSchema.index(
  { type: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
    name: 'unique_default_per_type',
  },
);

promptTemplateSchema.index({ name: 1 }, { unique: true });

export const PromptTemplateModel: Model<IPromptTemplateDocument> =
  mongoose.model<IPromptTemplateDocument>('PromptTemplate', promptTemplateSchema);
