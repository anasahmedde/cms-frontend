import { designerReducer, initialDesignerState } from "../designerReducer";
import { validateZones } from "../zoneValidation";

const tpl = (zones = []) => ({
  id: 1, name: "T", description: null, orientation: "portrait",
  design_width: 1080, design_height: 1920, zones, status: "draft", version: 0,
});
const zone = (key, over = {}) => ({
  key, type: "text", x: 0, y: 0, w: 50, h: 10, z: 1, style: {}, binding: { source: "static" }, ...over,
});
const init = (zones) => designerReducer(initialDesignerState, { type: "INIT", template: tpl(zones) });

describe("designerReducer", () => {
  test("ADD_ZONE selects the new zone, marks dirty, and is undoable", () => {
    let s = init([]);
    s = designerReducer(s, { type: "ADD_ZONE", zone: zone("header") });
    expect(s.template.zones).toHaveLength(1);
    expect(s.selectedKey).toBe("header");
    expect(s.dirty).toBe(true);
    s = designerReducer(s, { type: "UNDO" });
    expect(s.template.zones).toHaveLength(0);
    s = designerReducer(s, { type: "REDO" });
    expect(s.template.zones).toHaveLength(1);
  });

  test("gesture pushes history exactly once", () => {
    let s = init([zone("a")]);
    s = designerReducer(s, { type: "BEGIN_GESTURE" });
    s = designerReducer(s, { type: "UPDATE_ZONE", key: "a", patch: { x: 10 } });
    s = designerReducer(s, { type: "UPDATE_ZONE", key: "a", patch: { x: 20 } });
    s = designerReducer(s, { type: "UPDATE_ZONE", key: "a", patch: { x: 30 } });
    s = designerReducer(s, { type: "END_GESTURE" });
    expect(s.past).toHaveLength(1);
    expect(s.template.zones[0].x).toBe(30);
    s = designerReducer(s, { type: "UNDO" });
    expect(s.template.zones[0].x).toBe(0); // back to pre-gesture position in one undo
  });

  test("no-op gesture pushes no history", () => {
    let s = init([zone("a")]);
    s = designerReducer(s, { type: "BEGIN_GESTURE" });
    s = designerReducer(s, { type: "END_GESTURE" });
    expect(s.past).toHaveLength(0);
  });

  test("committed field edit is undoable and merges style", () => {
    let s = init([zone("a", { style: { bg_color: "#111111" } })]);
    s = designerReducer(s, { type: "UPDATE_ZONE", key: "a", patch: { style: { text_color: "#ffffff" } }, commit: true });
    expect(s.template.zones[0].style).toEqual({ bg_color: "#111111", text_color: "#ffffff" });
    expect(s.past).toHaveLength(1);
  });

  test("renaming the selected zone follows selection", () => {
    let s = init([zone("a")]);
    s = designerReducer(s, { type: "SELECT", key: "a" });
    s = designerReducer(s, { type: "UPDATE_ZONE", key: "a", patch: { key: "b" }, commit: true });
    expect(s.selectedKey).toBe("b");
    expect(s.template.zones[0].key).toBe("b");
  });

  test("DELETE_ZONE clears selection and is undoable", () => {
    let s = init([zone("a"), zone("b", { y: 20 })]);
    s = designerReducer(s, { type: "SELECT", key: "a" });
    s = designerReducer(s, { type: "DELETE_ZONE", key: "a" });
    expect(s.template.zones.map((z) => z.key)).toEqual(["b"]);
    expect(s.selectedKey).toBeNull();
    s = designerReducer(s, { type: "UNDO" });
    expect(s.template.zones).toHaveLength(2);
  });

  test("MARK_SAVED clears dirty and applies server patch", () => {
    let s = init([]);
    s = designerReducer(s, { type: "SET_META", patch: { name: "New" } });
    expect(s.dirty).toBe(true);
    s = designerReducer(s, { type: "MARK_SAVED", patch: { status: "published", version: 3 } });
    expect(s.dirty).toBe(false);
    expect(s.template.version).toBe(3);
  });
});

describe("validateZones (client mirror of backend rules)", () => {
  const whiteboard = [
    zone("header", { h: 15, w: 100 }),
    zone("main", { type: "playlist", y: 15, h: 70, w: 100, binding: { source: "device.playlist" } }),
    zone("qr", { type: "qr", y: 85, h: 15, w: 30, binding: { source: "content", scope: "shop" } }),
  ];
  test("valid layout passes", () => expect(validateZones(whiteboard)).toEqual([]));
  test("overflow fails", () =>
    expect(validateZones([zone("a", { x: 60, w: 60 })])[0]).toMatch(/extends past/));
  test("duplicate keys fail", () =>
    expect(validateZones([zone("a"), zone("a", { y: 50 })]).join()).toMatch(/duplicate/));
  test("bad binding for type fails", () =>
    expect(validateZones([zone("a", { type: "playlist", binding: { source: "static" } })]).join()).toMatch(/can't bind/));
  test("bad hex color fails", () =>
    expect(validateZones([zone("a", { style: { bg_color: "red" } })]).join()).toMatch(/hex color/));
});
