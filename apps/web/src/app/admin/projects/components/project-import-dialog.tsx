'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import type { ProjectImportPreview } from '@critiq/core/projects';
import { RiUploadCloud2Line, RiDownloadLine } from '@remixicon/react';
import {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VideoCard } from '@/components/video-card';
import { videos } from '@/lib/constants/videos';
import { toast } from '@/components/ui/sonner';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import { previewProjectImportAction, importProjectsAction } from '../actions';

const columns = [
  'Project Title',
  'About The Project',
  'Submission Url',
  "Enter Your Project's Github",
  'Video Demo Link',
  'Track',
  'Opt-In Prizes',
  'Project Status',
];
export function ProjectImportDialog({
  format,
  locked,
  children,
}: {
  format: 'devpost' | 'csv';
  locked: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [fileName, setFileName] = useState(''),
    [reading, setReading] = useState(false),
    [dragging, setDragging] = useState(false);
  const [error, setError] = useState(''),
    [errors, setErrors] = useState<string[]>([]),
    [preview, setPreview] = useState<ProjectImportPreview | null>(null);
  const busy = useRef(false),
    readVersion = useRef(0),
    input = useRef<HTMLInputElement>(null),
    id = useId(),
    router = useRouter();
  const devpost = format === 'devpost';
  const form = useForm({
    defaultValues: { csv: '' },
    onSubmit: async ({ value }) => {
      if (locked || busy.current || reading) return;
      busy.current = true;
      setError('');
      setErrors([]);
      try {
        if (!preview) {
          const result = await previewProjectImportAction({
            format,
            csv: value.csv,
          });
          if (!result.ok) {
            setError(result.error.message);
            setErrors(result.error.fieldErrors?.csv ?? []);
            return;
          }
          setPreview(result.data);
        } else {
          const result = await importProjectsAction({ format, csv: value.csv });
          if (!result.ok) {
            setError(result.error.message);
            setErrors(result.error.fieldErrors?.csv ?? []);
            setPreview(null);
            return;
          }
          toast.success(
            `${result.data.added} projects added: ${result.data.placed} placed, ${result.data.unassigned} awaiting available tables. ${result.data.duplicates} duplicates and ${result.data.notSubmitted} hidden or non-submitted rows skipped.`,
          );
          setOpen(false);
          reset();
          router.refresh();
        }
      } catch {
        setError(
          'Unable to connect. Your file is still here. Please try again.',
        );
      } finally {
        busy.current = false;
      }
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting),
    csv = useStore(form.store, (s) => s.values.csv);
  const pending = submitting || reading;
  const guard = useUnsavedGuard({
    when: open && Boolean(csv),
    description:
      'Your selected file has not been imported. Leaving will discard the preview.',
  });
  function reset() {
    readVersion.current++;
    form.reset();
    setFileName('');
    setPreview(null);
    setError('');
    setErrors([]);
    setReading(false);
    setDragging(false);
    if (input.current) input.current.value = '';
  }
  function close() {
    if (!pending && !busy.current)
      void guard(() => {
        setOpen(false);
        reset();
      });
  }
  async function readFile(files: FileList | null) {
    if (pending || busy.current || locked) return;
    setError('');
    setErrors([]);
    setPreview(null);
    form.setFieldValue('csv', '');
    setFileName('');
    if (!files || files.length !== 1) {
      setError('Choose one CSV file.');
      return;
    }
    const file = files[0]!;
    if (
      !/\.csv$/i.test(file.name) ||
      ![
        '',
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'text/plain',
      ].includes(file.type)
    ) {
      setError('Choose a .csv text file.');
      return;
    }
    if (file.size > 1_000_000) {
      setError('Choose a CSV file smaller than 1 MB.');
      return;
    }
    const version = ++readVersion.current;
    setReading(true);
    try {
      const text = await file.text();
      if (version !== readVersion.current) return;
      if (!text.trim()) {
        setError('This file is empty. Choose a CSV with project rows.');
        return;
      }
      if (text.includes('\u0000') || text.includes('\uFFFD')) {
        setError('Save your file as UTF-8 CSV and try again.');
        return;
      }
      form.setFieldValue('csv', text);
      setFileName(file.name);
    } catch {
      setError('Unable to read this file. Choose it again.');
    } finally {
      if (version === readVersion.current) setReading(false);
    }
  }
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          reset();
          setOpen(true);
        } else close();
      }}
    >
      <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="max-w-4xl"
        aria-describedby={undefined}
        showCloseButton={!pending}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {preview
                ? 'Review project import'
                : devpost
                  ? 'Import from Devpost'
                  : 'Import CSV'}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <div className="flex flex-col gap-5">
              {preview ? (
                <>
                  <div role="status" className="flex flex-wrap gap-5 text-sm">
                    <span>
                      <strong>{preview.projects.length}</strong> ready to add
                    </span>
                    <span>
                      <strong>{preview.notSubmitted}</strong> hidden or not
                      submitted
                    </span>
                    <span>
                      <strong>{preview.duplicates}</strong> duplicates
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {fileName} · {preview.totalRows} rows reviewed. Track and
                    challenge names match existing categories. Nothing is saved
                    until you select Import projects.
                  </p>
                  <div className="max-h-72 overflow-y-auto rounded-xl border">
                    <ul className="divide-y">
                      {preview.projects.slice(0, 50).map((project) => (
                        <li
                          key={project.rowNumber}
                          className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <span className="min-w-0 break-words font-medium">
                            {project.name}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {project.trackName} · {project.challenges}{' '}
                            challenges
                          </span>
                        </li>
                      ))}
                    </ul>
                    {preview.projects.length > 50 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        Showing the first 50 of {preview.projects.length}{' '}
                        projects.
                      </p>
                    )}
                    {!preview.projects.length && (
                      <p className="p-4 text-sm text-muted-foreground">
                        No new submitted projects to import. Choose another file
                        or close this dialog.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid min-w-0 items-start gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-5">
                    {devpost ? (
                      <div className="flex flex-col gap-3 text-sm">
                        <h3 className="font-semibold">
                          Export your projects from Devpost
                        </h3>
                        <ol className="flex list-decimal flex-col gap-2 pl-5">
                          <li>
                            Open your hackathon’s Manage area, then select{' '}
                            <strong>Metrics</strong>.
                          </li>
                          <li>
                            Under Type of report, select{' '}
                            <strong>Projects data</strong>.
                          </li>
                          <li>
                            Under Personally identifiable information, select{' '}
                            <strong>Do not include</strong>.
                          </li>
                          <li>
                            Select <strong>Generate report</strong>, then
                            download the CSV when it is ready. Keep the original
                            header row.
                          </li>
                          <li>
                            Check that Track and Opt-In Prizes match your Critiq
                            category names.
                          </li>
                        </ol>
                        <p className="text-muted-foreground">
                          Only submitted projects are added. “Submitted
                          (Hidden)” and “Draft” projects are skipped. Existing
                          projects are kept as they are; duplicate submission
                          URLs, Devpost IDs, and titles without a URL are
                          skipped.
                        </p>
                        <details>
                          <summary className="cursor-pointer">
                            Required Devpost headers
                          </summary>
                          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                            {columns.map((column) => (
                              <li key={column}>{column}</li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 text-sm">
                        <h3 className="font-semibold">
                          Prepare a headerless CSV
                        </h3>
                        <p>
                          Use these eight fields in this exact order. Keep empty
                          optional fields and quote any value containing commas
                          or line breaks.
                        </p>
                        <ol className="flex list-decimal flex-col gap-1 pl-5">
                          {columns.map((column) => (
                            <li key={column}>{column}</li>
                          ))}
                        </ol>
                        <Button asChild variant="secondary">
                          <a href="/templates/projects.csv" download>
                            <RiDownloadLine data-icon="inline-start" />
                            Download example CSV
                          </a>
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      A blank Track uses Overall. Separate opt-in challenges
                      with commas inside one quoted field.{' '}
                      {devpost
                        ? 'Extra Devpost prizes without a matching Critiq challenge are ignored. Unknown tracks and ineligible existing challenges must be fixed before importing.'
                        : 'Unknown or ineligible categories must be fixed before importing.'}
                    </p>
                  </div>
                  <VideoCard
                    video={devpost ? videos.devpostImport : videos.csvImport}
                  />
                  <FieldGroup className="md:col-span-2">
                    <form.Field name="csv">
                      {() => (
                        <Field data-invalid={Boolean(error || errors.length)}>
                          <FieldLabel htmlFor={`${id}-file`}>
                            Project CSV file
                          </FieldLabel>
                          <div
                            onDragOver={(event) => {
                              event.preventDefault();
                              if (!pending) setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(event) => {
                              event.preventDefault();
                              setDragging(false);
                              void readFile(event.dataTransfer.files);
                            }}
                            data-dragging={dragging}
                            className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-5 text-center data-[dragging=true]:border-primary data-[dragging=true]:bg-accent"
                          >
                            <RiUploadCloud2Line
                              aria-hidden="true"
                              className="size-7 text-muted-foreground"
                            />
                            <p className="text-sm">
                              {reading
                                ? 'Reading file…'
                                : fileName || 'Drag and drop a CSV here'}
                            </p>
                            <Input
                              ref={input}
                              id={`${id}-file`}
                              type="file"
                              accept=".csv,text/csv"
                              disabled={pending || locked}
                              onChange={(event) =>
                                void readFile(event.target.files)
                              }
                              aria-invalid={Boolean(error)}
                              aria-describedby={`${id}-limits ${id}-errors`}
                            />
                            <p
                              id={`${id}-limits`}
                              className="text-xs text-muted-foreground"
                            >
                              UTF-8 CSV · Up to 1 MB and 500 project rows
                            </p>
                          </div>
                        </Field>
                      )}
                    </form.Field>
                  </FieldGroup>
                </div>
              )}
              {(error || errors.length > 0) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <p>{error}</p>
                    <FieldError id={`${id}-errors`}>
                      {errors.length > 0 && (
                        <ul className="flex list-disc flex-col gap-1 pl-4">
                          {errors.map((message, index) => (
                            <li key={index}>{message}</li>
                          ))}
                        </ul>
                      )}
                    </FieldError>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={close}
              >
                Cancel
              </Button>
              {preview && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setPreview(null)}
                >
                  Change file
                </Button>
              )}
            </div>
            <LoadingButton
              type="submit"
              loading={pending}
              disabled={
                locked ||
                !csv ||
                (preview !== null && preview.projects.length === 0)
              }
            >
              {preview
                ? `Import ${preview.projects.length} projects`
                : 'Preview import'}
            </LoadingButton>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
