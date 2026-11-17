'use client';

import { RiArrowDownSLine } from '@remixicon/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SignOutButton } from './sign-out-button';

export function UserMenu({ userName }: { userName: string }) {
  const initials =
    userName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toUpperCase() || 'U';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="lg"
          aria-label={`Account for ${userName}`}
          className="max-w-full gap-2 pr-3 pl-1"
        >
          <Avatar size="lg" className="border border-input" aria-hidden="true">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate sm:block xl:max-w-24 2xl:max-w-40">
            {userName}
          </span>
          <RiArrowDownSLine aria-hidden="true" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-44 max-w-[calc(100vw-2.5rem)] p-2"
        aria-label="Your account"
      >
        <SignOutButton size="sm" />
      </PopoverContent>
    </Popover>
  );
}
