// Run the production test server on the fixture's policy date while allowing time to advance.
const realDate = Date;
const offset = realDate.parse("2026-11-23T12:00:00Z") - realDate.now();
const fixtureNow = () => realDate.now() + offset;

globalThis.Date = new Proxy(realDate, {
  apply() {
    return new realDate(fixtureNow()).toString();
  },
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [fixtureNow()], newTarget);
  },
  get(target, key, receiver) {
    return key === "now" ? fixtureNow : Reflect.get(target, key, receiver);
  },
});
