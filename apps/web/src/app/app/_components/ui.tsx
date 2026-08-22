import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small, shared presentation primitives for the accounting app pages.
 * Kept intentionally calm and neutral: no gradients, no charts, no marketing
 * flourish. They exist so every foundation page reads with the same spacing,
 * hierarchy, and form styling.
 */

export const inputClassName =
  "h-11 w-full rounded-md border border-input bg-input-surface px-3 text-sm text-foreground outline-none transition duration-200 placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:opacity-60";

export function PageIntro({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(24,92,103,0.07)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  children,
  required,
  hint,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        className="text-sm font-medium text-foreground"
        htmlFor={htmlFor}
      >
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClassName, props.className)} />;
}

export function TextArea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(
        inputClassName,
        "min-h-24 resize-y py-2.5 leading-6",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(inputClassName, "cursor-pointer pr-9", props.className)}
    />
  );
}

export function CheckboxField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 transition hover:bg-secondary/60"
      htmlFor={id}
    >
      <input
        checked={checked}
        className="mt-0.5 size-4 rounded border-input accent-primary"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  danger:
    "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
  ghost: "text-foreground hover:bg-secondary",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border border-border bg-card text-foreground hover:bg-secondary",
};

export function buttonClassName({
  variant = "primary",
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60",
    buttonVariants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={buttonClassName({ className, variant })}
      type={type}
    />
  );
}

type BadgeTone = "active" | "inactive" | "closed" | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  active: "border-success-border bg-success-surface text-success",
  closed: "border-warning-border bg-warning-surface text-warning",
  inactive: "border-border bg-secondary text-muted-foreground",
  neutral: "border-border bg-secondary text-secondary-foreground",
};

export function StatusBadge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

type NoticeTone = "error" | "success" | "info";

const noticeStyles: Record<
  NoticeTone,
  { wrapper: string; icon: typeof Info }
> = {
  error: {
    icon: AlertCircle,
    wrapper: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  info: {
    icon: Info,
    wrapper: "border-border bg-secondary text-secondary-foreground",
  },
  success: {
    icon: CheckCircle2,
    wrapper: "border-success-border bg-success-surface text-success",
  },
};

export function Notice({
  tone,
  children,
}: {
  tone: NoticeTone;
  children: ReactNode;
}) {
  const { wrapper, icon: Icon } = noticeStyles[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm leading-6",
        wrapper,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border bg-secondary/40 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
      {message}
    </div>
  );
}
