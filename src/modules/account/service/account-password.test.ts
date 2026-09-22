import { describe, it, expect } from "vitest";
import { AccountError, isAccountError } from "./account-password";

describe("AccountError", () => {
  it("has code and name", () => {
    const err = new AccountError("msg", "VALIDATION");
    expect(err.code).toBe("VALIDATION");
    expect(err.name).toBe("AccountError");
    expect(isAccountError(err)).toBe(true);
    expect(isAccountError(new Error("x"))).toBe(false);
  });
});
