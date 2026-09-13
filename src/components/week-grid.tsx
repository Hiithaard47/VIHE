"use client";

import Link from "next/link";
import { useState } from "react";
import { formatTime } from "@/lib/schedule";
import { formatDayHeading, sessionDateUtc, startOfTodayUtc, toDateInputValue } from "@/lib/time";

export type WeekGridCard = {
  id: string;
  sessionId?: string;
  name: string;
  categoryName: string;
  startMinute: number | null;
  endMinute: number | null;
  date: string;
  markedCount?: number;
  href?: string;
  canRemove: boolean;
  canDrag: boolean;
  canDuplicate?: boolean;
};

export function WeekGrid({
  days,
  cards,
  addLabel,
  onAdd,
  canAdd,
  onRemove,
  onDuplicate,
  onMove,
  canDrop,
  today = startOfTodayUtc(),
}: {
  days: Date[];
  cards: WeekGridCard[];
  addLabel?: string;
  onAdd?: (date: Date) => void;
  canAdd?: (date: Date) => boolean;
  onRemove?: (card: WeekGridCard) => void;
  onDuplicate?: (card: WeekGridCard) => void;
  onMove?: (card: WeekGridCard, date: Date) => void;
  canDrop?: (date: Date) => boolean;
  today?: Date;
}) {
  const [overDate, setOverDate] = useState<string | null>(null);
  const todayKey = toDateInputValue(today);

  function cardsOn(day: Date) {
    const key = toDateInputValue(day);
    return cards
      .filter((card) => card.date === key)
      .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
  }

  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => {
        const key = toDateInputValue(day);
        const isToday = key === todayKey;
        const isOver = overDate === key;
        const droppable = Boolean(onMove) && (!canDrop || canDrop(day));
        return (
          <section
            key={key}
            aria-label={formatDayHeading(day)}
            onDragOver={(event) => {
              if (!droppable) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverDate(key);
            }}
            onDragLeave={() => {
              if (overDate === key) setOverDate(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOverDate(null);
              if (!droppable) return;
              const raw = event.dataTransfer.getData("text/plain");
              const card = cards.find((item) => item.id === raw);
              if (!card || card.date === key || !onMove) return;
              onMove(card, sessionDateUtc(day));
            }}
            className={`flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2 ${
              isToday ? "border-ink" : "border-hairline"
            } ${isOver ? "bg-canvas" : "bg-card"}`}
          >
            <h3 className="w-16 shrink-0 pt-1 text-sm font-semibold text-ink">{formatDayHeading(day)}</h3>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {cardsOn(day).map((card) => (
                <WeekCard
                  key={card.id}
                  card={card}
                  onRemove={card.canRemove ? onRemove : undefined}
                  onDuplicate={card.canDuplicate ? onDuplicate : undefined}
                  onDragStart={
                    card.canDrag
                      ? () => {
                          setOverDate(null);
                        }
                      : undefined
                  }
                />
              ))}
              {onAdd && (!canAdd || canAdd(day)) && (
                <button
                  type="button"
                  aria-label={`${addLabel ?? "+ Add"} on ${formatDayHeading(day)}`}
                  onClick={() => onAdd(day)}
                  className="w-fit text-left text-xs font-medium text-muted hover:text-ink"
                >
                  {addLabel ?? "+ Add"}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WeekCard({
  card,
  onRemove,
  onDuplicate,
  onDragStart,
}: {
  card: WeekGridCard;
  onRemove?: (card: WeekGridCard) => void;
  onDuplicate?: (card: WeekGridCard) => void;
  onDragStart?: () => void;
}) {
  const time =
    card.startMinute != null && card.endMinute != null
      ? `${formatTime(card.startMinute)}–${formatTime(card.endMinute)}`
      : null;
  const body = (
    <>
      {time && <p className="text-xs text-muted">{time}</p>}
      <p className="font-medium text-ink">{card.name}</p>
      <p className="text-xs text-muted">{card.categoryName}</p>
      {card.markedCount != null && (
        <p className="text-xs text-muted">{card.markedCount > 0 ? `${card.markedCount} marked` : "—"}</p>
      )}
    </>
  );

  return (
    <article
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => {
        if (!onDragStart) return;
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className={`w-full rounded-md border border-hairline bg-canvas p-2 ${onDragStart ? "cursor-grab" : ""}`}
    >
      {card.href ? (
        <Link href={card.href} aria-label={card.name} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
      {(onRemove || onDuplicate) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(card)}
              className="text-xs text-muted hover:text-ink"
            >
              Duplicate
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(card)}
              className="text-xs text-muted hover:text-ink"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </article>
  );
}
