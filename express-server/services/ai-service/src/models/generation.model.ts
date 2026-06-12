import mongoose, { Schema, Model } from 'mongoose';

export enum GenerationType {
  FULL_DOCS = 'FULL_DOCS',
  SUMMARY = 'SUMMARY',
  IMPROVE = 'IMPROVE',
  Q_AND_A = 'Q_AND_A',
  CODE_DOCS = 'CODE_DOCS',
  TRANSLATE = 'TRANSLATE',
  CUSTOM = 'CUSTOM',
}

export enum GenerationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum AIProvider {
  OLLAMA = 'OLLAMA',
  OPENAI = 'OPENAI',
  CUSTOM = 'CUSTOM',
}

export interface GenerationInput {
  content: string;
  context?: string;
  options?: Record<string, unknown>;
}

export interface GenerationOutput {
  content: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
}

export interface IGeneration {
  userId: string;
  projectId?: string;
  documentId?: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string;
  systemPrompt: string;
  model: string;
  provider: AIProvider;
  input: GenerationInput;
  output?: GenerationOutput;
  error?: string;
  processingTime?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface IGenerationDocument extends IGeneration {}

const generationInputSchema = new Schema<GenerationInput>(
  {
    content: { type: String, required: true },
    context: { type: String },
    options: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const generationOutputSchema = new Schema<GenerationOutput>(
  {
    content: { type: String, required: true },
    tokensUsed: { type: Number },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
    finishReason: { type: String },
  },
  { _id: false },
);

const generationSchema = new Schema<IGenerationDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      index: true,
    },
    documentId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(GenerationType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(GenerationStatus),
      required: true,
      default: GenerationStatus.PENDING,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    systemPrompt: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      enum: Object.values(AIProvider),
      required: true,
    },
    input: {
      type: generationInputSchema,
      required: true,
    },
    output: {
      type: generationOutputSchema,
    },
    error: {
      type: String,
    },
    processingTime: {
      type: Number,
    },
    completedAt: {
      type: Date,
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

// Compound indexes for common queries
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ userId: 1, status: 1 });
generationSchema.index({ userId: 1, type: 1, createdAt: -1 });
generationSchema.index({ projectId: 1, createdAt: -1 });
generationSchema.index({ documentId: 1, createdAt: -1 });
generationSchema.index({ status: 1, createdAt: 1 }); // for queue processing

// TTL index to auto-delete old failed/cancelled generations after 30 days
generationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { status: { $in: [GenerationStatus.FAILED, GenerationStatus.CANCELLED] } } },
);

export const GenerationModel: Model<IGenerationDocument> = mongoose.model<IGenerationDocument>(
  'Generation',
  generationSchema,
);
