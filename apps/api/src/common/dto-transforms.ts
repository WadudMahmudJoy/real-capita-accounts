import { Transform } from "class-transformer";
import type { TransformFnParams } from "class-transformer";

export const Trim = () =>
  Transform(({ value }: TransformFnParams): unknown =>
    typeof value === "string" ? value.trim() : value,
  );

export const TrimUppercase = () =>
  Transform(({ value }: TransformFnParams): unknown =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  );

export const parseBooleanQueryValue = (value: unknown): unknown => {
  if (value === undefined || value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export const ParseBooleanQuery = () =>
  Transform(({ value }: TransformFnParams): unknown =>
    parseBooleanQueryValue(value),
  );
