"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  companyMediaUrl,
  removeCompanyMedia,
  toErrorMessage,
  uploadCompanyMedia,
  type Company,
  type CompanyMediaKind,
} from "@/lib/api";
import { Button, Notice } from "../../_components/ui";

const ACCEPTED_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"];

type CompanyMediaFieldProps = {
  companyId: string;
  kind: CompanyMediaKind;
  label: string;
  hint?: string;
  hasMedia: boolean;
  revision: number;
  variant: "logo" | "background";
  onMediaChanged: (company: Company) => void;
};

/**
 * Upload / replace / remove control for one closed company media kind, with a
 * preview served from the public `/company-media/:id/:kind` endpoint. Stored
 * filesystem paths are never rendered — only the derived media URL.
 */
export function CompanyMediaField({
  companyId,
  kind,
  label,
  hint,
  hasMedia,
  revision,
  variant,
  onMediaChanged,
}: CompanyMediaFieldProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  function handleUnauthorized(caught: unknown): boolean {
    if (caught instanceof ApiError && caught.isUnauthorized) {
      router.replace("/login");
      return true;
    }
    return false;
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
      setMediaError("Only PNG, JPEG, or WebP images are accepted.");
      return;
    }

    setMediaError(null);
    setIsUploading(true);

    try {
      const result = await uploadCompanyMedia(companyId, kind, file);
      onMediaChanged(result.company);
    } catch (caught) {
      if (handleUnauthorized(caught)) {
        return;
      }
      setMediaError(toErrorMessage(caught));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove(): Promise<void> {
    setMediaError(null);
    setIsRemoving(true);

    try {
      const result = await removeCompanyMedia(companyId, kind);
      onMediaChanged(result.company);
    } catch (caught) {
      if (handleUnauthorized(caught)) {
        return;
      }
      setMediaError(toErrorMessage(caught));
    } finally {
      setIsRemoving(false);
    }
  }

  const isBusy = isUploading || isRemoving;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>

      {hasMedia ? (
        variant === "background" ? (
          <div className="h-40 w-full max-w-md overflow-hidden rounded-md border border-border bg-secondary/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${label} preview`}
              className="h-full w-full object-cover"
              src={companyMediaUrl(companyId, kind, revision)}
            />
          </div>
        ) : (
          <div className="flex h-28 w-full max-w-xs items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${label} preview`}
              className="h-full w-full object-contain"
              src={companyMediaUrl(companyId, kind, revision)}
            />
          </div>
        )
      ) : (
        <div className="flex h-20 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-border bg-secondary/40 text-xs text-muted-foreground">
          No {label.toLowerCase()} uploaded
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
          ref={inputRef}
          type="file"
        />
        <Button
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="secondary"
        >
          {isUploading
            ? "Uploading..."
            : hasMedia
              ? "Replace"
              : "Upload"}
        </Button>
        {hasMedia ? (
          <Button
            disabled={isBusy}
            onClick={() => void handleRemove()}
            type="button"
            variant="secondary"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </Button>
        ) : null}
      </div>

      {mediaError ? <Notice tone="error">{mediaError}</Notice> : null}
    </div>
  );
}
