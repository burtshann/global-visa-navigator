// Run the test server on the fixture's policy date while allowing time to advance.
const { readFileSync } = process.getBuiltinModule("node:fs");
const realDate = Date;
const offset = realDate.parse("2026-11-28T12:00:00Z") - realDate.now();
const fixtureNow = () => realDate.now() + offset;

function assessmentNow() {
  try {
    return realDate.parse(readFileSync(".next/e2e-assessment-clock", "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return fixtureNow();
  }
}

globalThis.Date = new Proxy(realDate, {
  apply() {
    return new realDate(fixtureNow()).toString();
  },
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [assessmentNow()], newTarget);
  },
  get(target, key, receiver) {
    return key === "now" ? fixtureNow : Reflect.get(target, key, receiver);
  },
});
