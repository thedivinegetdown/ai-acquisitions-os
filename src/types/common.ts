export type ConfidenceLevel = "Low" | "Medium" | "High";

export type ScoreLabel =
  | "Poor"
  | "Fair"
  | "Good"
  | "Excellent"
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export type ServiceError = {
  message: string;
  code?: string;
  cause?: unknown;
};

export type ServiceResult<T> =
  | {
      success: true;
      data: T;
      error?: never;
    }
  | {
      success: false;
      data?: never;
      error: ServiceError;
    };

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: ServiceError | null;
};

export type EntityId = string | number;

export type Nullable<T> = T | null | undefined;
