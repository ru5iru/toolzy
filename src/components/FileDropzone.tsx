import { useRef, useState, type ReactNode } from "react";
import { FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/formatBytes";

interface FileDropzoneProps {
  /** Accessible name for the hidden file input and the drop area. */
  label: string;
  onFile: (file: File) => void;
  onClear?: () => void;
  file?: File;
  accept?: string;
  hint?: ReactNode;
  disabled?: boolean;
}

/** Single-file picker with drag-and-drop, styled like the other Toolzy tools. */
export const FileDropzone = ({ label, onFile, onClear, file, accept, hint, disabled }: FileDropzoneProps) => {
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const clear = () => {
    if (picker.current) picker.current.value = "";
    onClear?.();
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={`border border-dashed rounded-lg p-4 text-center ${dragging ? "border-primary bg-secondary" : "border-border"}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        const files = e.dataTransfer.files;
        if (files.length !== 1) { toast.error("Drop one file at a time."); return; }
        onFile(files[0]);
      }}
    >
      <input
        ref={picker}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onFile(selected);
          e.target.value = "";
        }}
      />
      <FileUp className="h-6 w-6 text-primary mx-auto mb-2" aria-hidden="true" />
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" type="button" disabled={disabled} onClick={() => picker.current?.click()}>
          <FileUp />{file ? "Change file" : "Select file"}
        </Button>
        {file && onClear && (
          <Button size="sm" type="button" variant="outline" onClick={clear}><X />Clear</Button>
        )}
      </div>
      {file ? (
        <p className="text-xs font-mono mt-2 break-all">{file.name} <span className="text-muted-foreground">· {formatBytes(file.size)}</span></p>
      ) : (
        hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>
      )}
    </div>
  );
};
