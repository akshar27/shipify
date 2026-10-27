import { getUser, clearSession } from "./session";

beforeEach(() => localStorage.clear());

test("getUser returns the stored user", () => {
  localStorage.setItem("user", JSON.stringify({ id: "1", name: "Ada", isVerified: true }));
  expect(getUser()).toEqual({ id: "1", name: "Ada", isVerified: true });
});

test("getUser is null when nothing is stored", () => {
  expect(getUser()).toBeNull();
});

test.each(["{bad", "null", "42", '"text"', "undefined"])("getUser never throws on a corrupted value (%s)", (raw) => {
  localStorage.setItem("user", raw);
  expect(() => getUser()).not.toThrow();
  expect(getUser()).toBeNull();
});

test("clearSession removes the token and the user", () => {
  localStorage.setItem("token", "t");
  localStorage.setItem("user", "{}");
  clearSession();
  expect(localStorage.getItem("token")).toBeNull();
  expect(localStorage.getItem("user")).toBeNull();
});
