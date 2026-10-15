'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type SetupReadinessAlertProps = {
  checklistComplete: boolean;
  onFinish: () => void;
};

export function SetupReadinessAlert({
  checklistComplete,
  onFinish,
}: SetupReadinessAlertProps) {
  return (
    <Alert
      role="note"
      variant="soft"
      className="flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="min-w-0 flex-1">
        <AlertTitle className="line-clamp-none">
          Complete your checklist to mark the event ready
        </AlertTitle>
        <AlertDescription className="mt-1">
          Finishing locks all configuration. You can return to Draft to unlock
          it before judging starts.
        </AlertDescription>
      </div>
      <div className="shrink-0 self-end sm:self-center">
        {checklistComplete ? (
          <Button size="sm" className="w-32 shrink-0 px-3" onClick={onFinish}>
            Finish
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Finish unavailable"
                >
                  <Button size="sm" className="w-32 shrink-0 px-3" disabled>
                    Finish
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>
                Complete your checklist
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </Alert>
  );
}
