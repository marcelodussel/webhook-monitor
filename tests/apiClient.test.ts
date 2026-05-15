import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, isApiAccessDenied } from "../lib/apiClient.ts";

describe("isApiAccessDenied", () => {
  it("is true for ApiError with status 401 or 403", () => {
    assert.equal(isApiAccessDenied(new ApiError("nope", 401)), true);
    assert.equal(isApiAccessDenied(new ApiError("forbidden", 403)), true);
  });

  it("is false for ApiError with other statuses", () => {
    assert.equal(isApiAccessDenied(new ApiError("missing", 404)), false);
    assert.equal(isApiAccessDenied(new ApiError("server", 500)), false);
  });

  it("is false for non-ApiError values", () => {
    assert.equal(isApiAccessDenied(new Error("plain")), false);
    assert.equal(isApiAccessDenied("string"), false);
    assert.equal(isApiAccessDenied(null), false);
    assert.equal(isApiAccessDenied(undefined), false);
  });
});
