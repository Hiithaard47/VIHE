import { z } from "zod";
import { STATUS_OPTIONS, type StatusValue } from "@/modules/attendance/service/policy";

const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value) as [StatusValue, ...StatusValue[]];

const emptyToNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

export const policySchema = z.object({
  defaultStatus: z.enum(STATUS_VALUES),
  lateCountsAsAttended: z.boolean(),
  excusedCountsAsAttended: z.boolean(),
  lockAfterDays: z.preprocess(emptyToNull, z.number().int().min(0).nullable()),
});

export type PolicyInput = z.infer<typeof policySchema>;

export function parsePolicyForm(formData: FormData) {
  return policySchema.safeParse({
    defaultStatus: formData.get("defaultStatus"),
    // An unchecked checkbox is absent from FormData, so presence is the value.
    lateCountsAsAttended: formData.get("lateCountsAsAttended") !== null,
    excusedCountsAsAttended: formData.get("excusedCountsAsAttended") !== null,
    lockAfterDays: formData.get("lockAfterDays"),
  });
}
