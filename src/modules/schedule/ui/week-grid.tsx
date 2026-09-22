"use client";

import Link from "next/link";
import { useState } from "react";
import { formatTime } from "@/modules/schedule/service/schedule";
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
  const [movingId, setMovingId] = useState<string | null>(null);
  const todayKey = toDateInputValue(today);
  const movingCard = movingId ? cards.find((item) => item.id === movingId) : undefined;

  function cardsOn(day: Date) {
    const key = toDateInputValue(day);
    return cards
      .filter((card) => card.date === key)
      .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
  }

  function dropOnDay(day: Date) {
    if (!movingCard || !onMove) return;
    const key = toDateInputValue(day);
    if (movingCard.date === key) return;
    if (canDrop && !canDrop(day)) return;
    onMove(movingCard, sessionDateUtc(day));
    setMovingId(null);
    setOverDate(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {movingCard ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-dark/40 bg-accent/15 px-3 py-2 text-sm text-ink"
        >
          <span>
            Moving <span className="font-medium">{movingCard.name}</span> — tap a day to drop it.
          </span>
          <button
            type="button"
            onClick={() => {
              setMovingId(null);
              setOverDate(null);
            }}
            className="text-xs font-medium text-muted underline hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : null}
      {days.map((day) => {
        const key = toDateInputValue(day);
        const isToday = key === todayKey;
        const droppable = Boolean(onMove) && (!canDrop || canDrop(day));
        const isMoveTarget = Boolean(movingCard) && droppable && movingCard!.date !== key;
        const isOver = overDate === key || isMoveTarget;
        return (
          <section
            key={key}
            aria-label={formatDayHeading(day)}
            onDragOver={(event) => {
              if (!droppable || movingCard) return;
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
              if (!droppable || movingCard) return;
              const raw = event.dataTransfer.getData("text/plain");
              const card = cards.find((item) => item.id === raw);
              if (!card || card.date === key || !onMove) return;
              onMove(card, sessionDateUtc(day));
            }}
            onClick={() => {
              if (!isMoveTarget) return;
              dropOnDay(day);
            }}
            className={`flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2 ${
              isToday ? "border-ink" : "border-hairline"
            } ${isMoveTarget || isOver ? "bg-canvas" : "bg-card"} ${
              isMoveTarget ? "cursor-pointer ring-1 ring-accent-dark/50" : ""
            }`}
          >
            <h3 className="w-16 shrink-0 pt-1 text-sm font-semibold text-ink sm:w-20">{formatDayHeading(day)}</h3>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {cardsOn(day).map((card) => (
                <WeekCard
                  key={card.id}
                  card={card}
                  moving={movingId === card.id}
                  onRemove={card.canRemove ? onRemove : undefined}
                  onDuplicate={card.canDuplicate ? onDuplicate : undefined}
                  onMoveStart={
                    card.canDrag && onMove
                      ? () => {
                          setOverDate(null);
                          setMovingId(card.id);
                        }
                      : undefined
                  }
                  onDragStart={
                    card.canDrag && !movingCard
                      ? () => {
                          setOverDate(null);
                          setMovingId(null);
                        }
                      : undefined
                  }
                />
              ))}
              {onAdd && (!canAdd || canAdd(day)) && !movingCard && (
                <button
                  type="button"
                  aria-label={`${addLabel ?? "+ Add"} on ${formatDayHeading(day)}`}
                  onClick={() => onAdd(day)}
                  className="w-fit text-left text-xs font-medium text-muted hover:text-ink"
                >
                  {addLabel ?? "+ Add"}
                </button>
              )}
              {isMoveTarget ? (
                <p className="text-xs font-medium text-accent-dark">Drop here</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WeekCard({
  card,
  moving,
  onRemove,
  onDuplicate,
  onMoveStart,
  onDragStart,
}: {
  card: WeekGridCard;
  moving?: boolean;
  onRemove?: (card: WeekGridCard) => void;
  onDuplicate?: (card: WeekGridCard) => void;
  onMoveStart?: () => void;
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
      className={`w-full rounded-md border p-2 ${
        moving ? "border-accent-dark bg-accent/20" : "border-hairline bg-canvas"
      } ${onDragStart ? "cursor-grab" : ""}`}
    >
      {card.href && !moving ? (
        <Link href={card.href} aria-label={card.name} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
      {(onRemove || onDuplicate || onMoveStart) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {onMoveStart && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMoveStart();
              }}
              className="text-xs text-muted hover:text-ink sm:hidden"
            >
              {moving ? "Moving…" : "Move"}
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate(card);
              }}
              className="text-xs text-muted hover:text-ink"
            >
              Duplicate
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(card);
              }}
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
