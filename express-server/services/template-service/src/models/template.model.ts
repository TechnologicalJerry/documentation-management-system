import mongoose, { Schema } from 'mongoose';
import slugify from 'slugify';
import { TemplateCategory, TemplateType, type ITemplateDocument } from '../types/template.types';

const templateVariableSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    defaultValue: {
      type: String,
      default: '',
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const templateSchema = new Schema<ITemplateDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    content: {
      type: String,
      required: true,
    },
    contentHtml: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: Object.values(TemplateCategory),
      required: true,
      default: TemplateCategory.CUSTOM,
    },
    type: {
      type: String,
      enum: Object.values(TemplateType),
      required: true,
      default: TemplateType.USER,
    },
    authorId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      index: true,
      sparse: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    variables: {
      type: [templateVariableSchema],
      default: [],
    },
    previewImage: {
      type: String,
      trim: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
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
    toObject: {
      virtuals: true,
    },
  },
);

// Compound indexes
templateSchema.index({ category: 1, isPublic: 1 });
templateSchema.index({ type: 1, isActive: 1 });
templateSchema.index({ authorId: 1, type: 1 });
templateSchema.index({ organizationId: 1, type: 1 });
templateSchema.index({ usageCount: -1 });
templateSchema.index({ rating: -1 });
templateSchema.index({ createdAt: -1 });
templateSchema.index({ deletedAt: 1 }, { sparse: true });

// Full-text search index
templateSchema.index(
  { name: 'text', description: 'text', tags: 'text' },
  { weights: { name: 10, tags: 5, description: 3 }, name: 'template_text_search' },
);

// Auto-generate slug before saving
templateSchema.pre<ITemplateDocument>('save', async function (next) {
  if (this.isModified('name') && !this.slug) {
    const baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await TemplateModel.findOne({ slug, _id: { $ne: this._id } });
      if (!existing) {break;}
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    this.slug = slug;
  }
  next();
});

export const TemplateModel = mongoose.model<ITemplateDocument>('Template', templateSchema);
