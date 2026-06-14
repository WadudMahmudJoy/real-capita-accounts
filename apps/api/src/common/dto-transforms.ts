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
