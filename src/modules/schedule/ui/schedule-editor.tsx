"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createScheduleSession, duplicateOneOffSession, saveSchedule } from "@/modules/schedule/actions";
import { deleteSession, moveSession } from "@/modules/sessions/actions";
import { AddWeekSessionDialog } from "@/modules/sessions/ui/add-week-session-dialog";
import { WeekGrid, type WeekGridCard } from "@/modules/schedule/ui/week-grid";
import { WeekNavigator } from "@/modules/schedule/ui/week-navigator";
import { flashUrl } from "@/lib/flash";
import { sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { clampWeek, daysOfWeek, mondayOf, nextFreeWeekday, parseMeetingTimes, weekStart } from "@/modules/schedule/service/schedule";
import { isFutureSessionDate, parseDateInput, startOfTodayUtc, toDateInputValue } from "@/lib/time";

export type ScheduleSession = {
  id: string;
  date: string;
  name: string;
  startMinute: number | null;
  endMinute: number | null;
  categoryId: string;
  categoryName: string;
  markedCount: number;
};

export function ScheduleEditor({
  courseId,
  portal,
  subjectName,
  subjects,
  categories,
  initialTermStart,
  initialWeekCount,
  sessions,
  returnTo,
  canManagePastDates,
}: {
  courseId: string;
  portal: CoursePortal;
  subjectName: string;
  subjects: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  initialTermStart: string;
  initialWeekCount: number;
  sessions: ScheduleSession[];
  returnTo: string;
  canManagePastDates: boolean;
}) {
  const router = useRouter();
  const [termStart, setTermStart] = useState(initialTermStart);
  const [weekCount, setWeekCount] = useState(initialWeekCount);
  const [week, setWeek] = useState(1);
  const [items, setItems] = useState(sessions);
  const [seenSessions, setSeenSessions] = useState(sessions);
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const saveTimer = useRef<number | null>(null);

  if (sessions !== seenSessions) {
    setSeenSessions(sessions);
    setItems(sessions);
  }

  const monday = mondayOf(new Date(`${termStart}T00:00:00.000Z`));
  const safeCount = Math.min(52, Math.max(1, weekCount || 1));
  const safeWeek = clampWeek(week, safeCount);
  const visibleMonday = weekStart(monday, safeWeek);
  const days = daysOfWeek(visibleMonday);
  const weekDates = new Set(days.map((day) => toDateInputValue(day)));
  const weekSessions = items.filter((item) => weekDates.has(item.date));
  const subjectId = subjects[0]?.id;

  const cards: WeekGridCard[] = weekSessions.map((item) => ({
    id: item.id,
    sessionId: item.id,
    name: item.name,
    categoryName: item.categoryName,
    startMinute: item.startMinute,
    endMinute: item.endMinute,
    date: item.date,
    markedCount: item.markedCount,
    href: sessionHref(portal, item.id),
    canRemove: item.markedCount === 0 && canManageSessionDate(canManagePastDates, item.date),
    canDrag: item.markedCount === 0 && canManageSessionDate(canManagePastDates, item.date),
    canDuplicate: item.startMinute != null && canManageSessionDate(canManagePastDates, item.date),
  }));

  function persistSoon(nextTerm: string, nextWeeks: number) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      startTransition(async () => {
        setStatus("saving");
        setError(null);
        const result = await saveSchedule(courseId, portal, {
          subjectId,
          termStart: nextTerm,
          weekCount: nextWeeks,
        });
        if ("error" in result) {
          setStatus("error");
          setError(result.error);
          return;
        }
        setStatus("saved");
        router.refresh();
      });
    }, 400);
  }

  async function addSlot(formData: FormData) {
    if (!addDate || !subjectId) return false;
    const times = parseMeetingTimes(String(formData.get("startTime") ?? ""), String(formData.get("endTime") ?? ""));
    const name = String(formData.get("name") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "").trim();
    if (!times || !name || !categoryId) return false;
    setAddError(null);
    const result = await createScheduleSession(courseId, portal, {
      subjectId,
      date: toDateInputValue(addDate),
      name,
      categoryId,
      startTime: String(formData.get("startTime") ?? ""),
      endTime: String(formData.get("endTime") ?? ""),
    });
    if ("error" in result) {
      setAddError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  function removeCard(card: WeekGridCard) {
    if (!card.sessionId || !canManageSessionDate(canManagePastDates, card.date)) return;
    const formData = new FormData();
    formData.set("returnTo", returnTo);
    void deleteSession(card.sessionId, portal, formData);
  }

  function moveCard(card: WeekGridCard, date: Date) {
    const next = toDateInputValue(date);
    if (card.date === next || !card.sessionId || !canManageSessionDate(canManagePastDates, card.date)) return;

    const previous = items;
    setItems((current) => current.map((item) => (item.id === card.sessionId ? { ...item, date: next } : item)));
    setAddError(null);

    const formData = new FormData();
    formData.set("date", next);
    formData.set("returnTo", returnTo);

    startTransition(async () => {
      const result = await moveSession(card.sessionId!, portal, formData);
      if ("error" in result) {
        setItems(previous);
        setAddError(result.error);
        return;
      }
      router.replace(flashUrl(returnTo, "success", "Session moved."), { scroll: false });
      router.refresh();
    });
  }

  function duplicateCard(card: WeekGridCard) {
    if (card.startMinute == null || !card.sessionId) return;
    const from = parseDateInput(card.date);
    if (!from) return;
    const occupied = weekSessions
      .filter((item) => item.startMinute != null)
      .map((item) => ({
        weekday: new Date(`${item.date}T00:00:00.000Z`).getUTCDay(),
        startMinute: item.startMinute as number,
      }));
    const weekday = nextFreeWeekday(occupied, from.getUTCDay(), card.startMinute);
    const target = weekday == null ? undefined : days.find((item) => item.getUTCDay() === weekday);
    if (!target || (!canManagePastDates && !isFutureSessionDate(target))) {
      setAddError("Every other day already has a meeting at this time.");
      return;
    }
    startTransition(async () => {
      setAddError(null);
      const result = await duplicateOneOffSession(courseId, portal, {
        sessionId: card.sessionId!,
        date: toDateInputValue(target),
      });
      if ("error" in result) {
        setAddError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-ink">Schedule · {subjectName}</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-col gap-1 text-sm text-ink">
              Term start
              <input
                type="date"
                name="termStart"
                value={termStart}
                onChange={(event) => {
                  const next = event.target.value;
                  setTermStart(next);
                  persistSoon(next, safeCount);
                }}
                className="w-full min-w-0 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Weeks
              <input
                type="number"
                name="weekCount"
                min={1}
                max={52}
                value={weekCount}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setWeekCount(next);
                  const count = Math.min(52, Math.max(1, next || 1));
                  setWeek((current) => clampWeek(current, count));
                  persistSoon(termStart, count);
                }}
                className="w-20 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
              />
            </label>
            <p aria-live="polite" className={`text-xs ${status === "error" ? "text-red-700" : "text-muted"}`}>
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : error}
            </p>
          </div>
        </div>
        <WeekNavigator
          week={safeWeek}
          weekCount={safeCount}
          monday={visibleMonday}
          onPrev={() => setWeek((current) => clampWeek(current - 1, safeCount))}
          onNext={() => setWeek((current) => clampWeek(current + 1, safeCount))}
        />
      </div>

      <div>
        <WeekGrid
          days={days}
          cards={cards}
          addLabel="+ Add"
          onAdd={(day) => {
            setAddError(null);
            setAddDate(day);
          }}
          canAdd={(day) => canManagePastDates || isFutureSessionDate(day)}
          onRemove={removeCard}
          onDuplicate={duplicateCard}
          onMove={moveCard}
          canDrop={(day) => canManagePastDates || isFutureSessionDate(day)}
          today={startOfTodayUtc()}
        />
        {addError && addDate === null && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {addError}
          </p>
        )}
      </div>

      <AddWeekSessionDialog
        key={addDate ? toDateInputValue(addDate) : "closed"}
        open={addDate !== null}
        date={addDate}
        title="Add meeting"
        submitLabel="Add"
        defaultCategoryId={categories[0]?.id ?? ""}
        categories={categories}
        error={addError}
        onLocalSubmit={addSlot}
        onClose={() => setAddDate(null)}
      />
    </div>
  );
}

function isEditableSessionDate(value: string) {
  const date = parseDateInput(value);
  return Boolean(date && isFutureSessionDate(date));
}

function canManageSessionDate(canManagePastDates: boolean, value: string) {
  if (canManagePastDates) return Boolean(parseDateInput(value));
  return isEditableSessionDate(value);
}
