import { describe, expect, it } from "vitest";
import { validateAssignmentFile, validateAssignmentUploads } from "./assignment-files";

function fakeFile(type: string, size: number, name = "file.bin") {
  const buffer = new ArrayBuffer(Math.min(size, 8));
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateAssignmentFile", () => {
  it("allows PDF and images up to 10 MB", () => {
    expect(validateAssignmentFile(fakeFile("application/pdf", 9 * 1024 * 1024, "a.pdf"))).toBeNull();
    expect(validateAssignmentFile(fakeFile("image/png", 10 * 1024 * 1024 + 1, "a.png"))).toBe(
      "PDF and image files must be 10 MB or smaller.",
    );
  });

  it("allows audio and video up to 5 MB", () => {
    expect(validateAssignmentFile(fakeFile("audio/mpeg", 5 * 1024 * 1024, "a.mp3"))).toBeNull();
    expect(validateAssignmentFile(fakeFile("video/mp4", 5 * 1024 * 1024 + 1, "a.mp4"))).toBe(
      "Audio and video files must be 5 MB or smaller.",
    );
  });

  it("rejects unsupported types", () => {
    expect(validateAssignmentFile(fakeFile("text/plain", 100, "a.txt"))).toBe(
      "Only PDF, image, audio, or video files can be uploaded.",
    );
  });
});

describe("validateAssignmentUploads", () => {
  it("requires at least one file", () => {
    expect(validateAssignmentUploads([])).toBe("Upload at least one PDF, image, audio, or video file.");
  });
});
