"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

export const pickupHours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export const pickupMinutes = ["00", "15", "30", "45"] as const;
export const pickupPeriods = ["AM", "PM"] as const;

export type PickupPeriod = (typeof pickupPeriods)[number];

export type PickupTime = {
  hour: string;
  minute: string;
  period: PickupPeriod;
};

const wheelItemHeight = 48;
const visibleWheelRows = 5;
const wheelHeight = wheelItemHeight * visibleWheelRows;
const wheelSpacerHeight = (wheelHeight - wheelItemHeight) / 2;
const scrollEndDelay = 120;

type PickupTimeWheelProps = {
  value: PickupTime;
  onChange: (value: PickupTime) => void;
};

type TimeWheelColumnProps<T extends string> = {
  label: string;
  testId: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  showSeparator?: boolean;
};

export function PickupTimeWheel({ value, onChange }: PickupTimeWheelProps) {
  const readableTime = formatPickupTime(value);

  return (
    <fieldset className="grid min-w-0 gap-3" aria-describedby="pickup-time-preview">
      <legend className="sr-only">Choose pickup time</legend>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">Pickup time</span>
        <output id="pickup-time-preview" className="text-sm font-semibold text-primary" aria-live="polite">
          Pickup at {readableTime}
        </output>
      </div>

      <div className="grid grid-cols-3 px-2 text-center text-xs font-medium text-muted-foreground" aria-hidden="true">
        <span>Hour</span>
        <span>Minute</span>
        <span>AM/PM</span>
      </div>

      <div
        className="relative grid min-w-0 grid-cols-3 overflow-hidden rounded-lg border border-border/70 bg-background/70 shadow-xs"
        data-testid="pickup-time-wheel"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 border-y border-primary/20 bg-primary/10"
          style={{ height: wheelItemHeight }}
          aria-hidden="true"
        />

        <TimeWheelColumn
          label="Pickup hour"
          testId="pickup-hour-wheel"
          options={pickupHours}
          value={value.hour}
          onChange={(hour) => onChange({ ...value, hour })}
        />
        <TimeWheelColumn
          label="Pickup minute"
          testId="pickup-minute-wheel"
          options={pickupMinutes}
          value={value.minute}
          onChange={(minute) => onChange({ ...value, minute })}
          showSeparator
        />
        <TimeWheelColumn
          label="AM or PM"
          testId="pickup-period-wheel"
          options={pickupPeriods}
          value={value.period}
          onChange={(period) => onChange({ ...value, period })}
          showSeparator
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-background via-background/80 to-transparent"
          style={{ height: wheelSpacerHeight }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-background via-background/80 to-transparent"
          style={{ height: wheelSpacerHeight }}
          aria-hidden="true"
        />
      </div>
    </fieldset>
  );
}

function TimeWheelColumn<T extends string>({
  label,
  testId,
  options,
  value,
  onChange,
  showSeparator = false,
}: TimeWheelColumnProps<T>) {
  const selectedIndex = Math.max(options.indexOf(value), 0);
  const [centeredIndex, setCenteredIndex] = useState(selectedIndex);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const centeredIndexRef = useRef(selectedIndex);
  const currentValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<number | null>(null);
  const initialPositionFrameRef = useRef<number | null>(null);
  const hasPositionedRef = useRef(false);
  const listboxId = useId();

  useEffect(() => {
    currentValueRef.current = value;
    onChangeRef.current = onChange;
  }, [onChange, value]);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const valueChangedOutsideWheel = options[centeredIndexRef.current] !== value;

    if (hasPositionedRef.current && !valueChangedOutsideWheel) {
      return;
    }

    const positionSelectedOption = () => {
      container.scrollTop = selectedIndex * wheelItemHeight;
      centeredIndexRef.current = selectedIndex;
      setCenteredIndex(selectedIndex);
    };

    positionSelectedOption();
    hasPositionedRef.current = true;
    initialPositionFrameRef.current = window.requestAnimationFrame(positionSelectedOption);

    return () => {
      if (initialPositionFrameRef.current !== null) {
        window.cancelAnimationFrame(initialPositionFrameRef.current);
      }
    };
  }, [options, selectedIndex, value]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }

      if (scrollEndTimerRef.current !== null) {
        window.clearTimeout(scrollEndTimerRef.current);
      }
    },
    [],
  );

  function getNearestIndex(scrollTop: number) {
    return Math.min(Math.max(Math.round(scrollTop / wheelItemHeight), 0), options.length - 1);
  }

  function updateCenteredIndex(index: number) {
    if (index === centeredIndexRef.current) {
      return;
    }

    centeredIndexRef.current = index;
    setCenteredIndex(index);
  }

  function commitIndex(index: number) {
    const nextValue = options[index];

    if (!nextValue || nextValue === currentValueRef.current) {
      return;
    }

    currentValueRef.current = nextValue;
    onChangeRef.current(nextValue);
  }

  function centerIndex(index: number, behavior: ScrollBehavior) {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    updateCenteredIndex(index);
    container.scrollTo({
      top: index * wheelItemHeight,
      behavior,
    });
  }

  function selectIndex(index: number) {
    centerIndex(index, "smooth");
    commitIndex(index);
  }

  function settleScroll() {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const nearestIndex = getNearestIndex(container.scrollTop);
    const targetScrollTop = nearestIndex * wheelItemHeight;

    updateCenteredIndex(nearestIndex);
    commitIndex(nearestIndex);

    if (Math.abs(container.scrollTop - targetScrollTop) > 1) {
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }

  function handleScroll() {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      updateCenteredIndex(getNearestIndex(container.scrollTop));
    });

    if (scrollEndTimerRef.current !== null) {
      window.clearTimeout(scrollEndTimerRef.current);
    }

    scrollEndTimerRef.current = window.setTimeout(settleScroll, scrollEndDelay);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextIndex = centeredIndexRef.current;

    if (event.key === "ArrowDown") {
      nextIndex = Math.min(nextIndex + 1, options.length - 1);
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(nextIndex - 1, 0);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectIndex(nextIndex);
  }

  return (
    <div className={cn("relative z-10 min-w-0", showSeparator && "border-l border-border/60")}>
      <div
        ref={containerRef}
        id={listboxId}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-activedescendant={`${listboxId}-option-${centeredIndex}`}
        data-testid={testId}
        className="relative touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden"
        style={{ height: wheelHeight }}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        <div style={{ height: wheelSpacerHeight }} aria-hidden="true" />
        {options.map((option, optionIndex) => {
          const distance = Math.abs(optionIndex - centeredIndex);
          const isCentered = optionIndex === centeredIndex;

          return (
            <button
              key={option}
              id={`${listboxId}-option-${optionIndex}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={isCentered}
              data-value={option}
              className={cn(
                "flex w-full snap-center snap-always items-center justify-center px-1 text-sm text-muted-foreground transition-[color,opacity,font-size] duration-150 hover:text-foreground focus-visible:outline-none",
                isCentered && "text-base font-semibold text-foreground opacity-100",
                distance === 1 && !isCentered && "opacity-55",
                distance > 1 && "opacity-25",
              )}
              style={{ height: wheelItemHeight }}
              onClick={() => selectIndex(optionIndex)}
            >
              {option}
            </button>
          );
        })}
        <div style={{ height: wheelSpacerHeight }} aria-hidden="true" />
      </div>
    </div>
  );
}

export function isPickupTimeValid(value: PickupTime) {
  return (
    pickupHours.some((hour) => hour === value.hour) &&
    pickupMinutes.some((minute) => minute === value.minute) &&
    pickupPeriods.some((period) => period === value.period)
  );
}

export function formatPickupTime(value: PickupTime) {
  if (!isPickupTimeValid(value)) {
    return "";
  }

  return `${Number(value.hour)}:${value.minute} ${value.period}`;
}
