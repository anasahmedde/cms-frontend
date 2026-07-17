// Pure designer state: template being edited, selection, undo/redo history.
// Gestures (drag/resize) update transiently; history is pushed once per gesture.

export const initialDesignerState = {
  template: null,        // { id, name, description, orientation, design_width, design_height, zones, status, version }
  selectedKey: null,
  past: [],              // stacks of zones arrays
  future: [],
  gestureBase: null,     // zones snapshot taken at gesture start
  dirty: false,
};

const HISTORY_LIMIT = 60;

function pushPast(state, zonesSnapshot) {
  return [...state.past.slice(-HISTORY_LIMIT + 1), zonesSnapshot];
}

export function designerReducer(state, action) {
  switch (action.type) {
    case "INIT":
      return { ...initialDesignerState, template: action.template };

    case "SELECT":
      return { ...state, selectedKey: action.key };

    case "SET_META": {
      // name / description / orientation / design_width / design_height
      return {
        ...state,
        template: { ...state.template, ...action.patch },
        dirty: true,
      };
    }

    case "ADD_ZONE": {
      const zones = [...state.template.zones, action.zone];
      return {
        ...state,
        past: pushPast(state, state.template.zones),
        future: [],
        template: { ...state.template, zones },
        selectedKey: action.zone.key,
        dirty: true,
      };
    }

    case "REPLACE_ZONES": {
      return {
        ...state,
        past: pushPast(state, state.template.zones),
        future: [],
        template: { ...state.template, zones: action.zones },
        selectedKey: action.zones[0]?.key || null,
        dirty: true,
      };
    }

    case "DELETE_ZONE": {
      const zones = state.template.zones.filter((z) => z.key !== action.key);
      return {
        ...state,
        past: pushPast(state, state.template.zones),
        future: [],
        template: { ...state.template, zones },
        selectedKey: state.selectedKey === action.key ? null : state.selectedKey,
        dirty: true,
      };
    }

    case "UPDATE_ZONE": {
      // action.patch applied to zone action.key. Transient unless committed:
      // gestures call BEGIN_GESTURE first, then END_GESTURE pushes history once.
      const zones = state.template.zones.map((z) => {
        if (z.key !== action.key) return z;
        const next = { ...z, ...action.patch };
        if (action.patch.style) next.style = { ...z.style, ...action.patch.style };
        if (action.patch.binding) next.binding = { ...action.patch.binding };
        return next;
      });
      const historyPush = action.commit && !state.gestureBase
        ? { past: pushPast(state, state.template.zones), future: [] }
        : {};
      const selection = action.patch.key && state.selectedKey === action.key
        ? { selectedKey: action.patch.key }
        : {};
      return {
        ...state,
        ...historyPush,
        ...selection,
        template: { ...state.template, zones },
        dirty: true,
      };
    }

    case "BEGIN_GESTURE":
      if (state.gestureBase) return state;
      return { ...state, gestureBase: state.template.zones };

    case "END_GESTURE": {
      if (!state.gestureBase) return state;
      const changed = state.gestureBase !== state.template.zones;
      return {
        ...state,
        gestureBase: null,
        past: changed ? pushPast(state, state.gestureBase) : state.past,
        future: changed ? [] : state.future,
      };
    }

    case "UNDO": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [state.template.zones, ...state.future],
        template: { ...state.template, zones: previous },
        selectedKey: previous.some((z) => z.key === state.selectedKey) ? state.selectedKey : null,
        dirty: true,
      };
    }

    case "REDO": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        past: pushPast(state, state.template.zones),
        future: rest,
        template: { ...state.template, zones: next },
        selectedKey: next.some((z) => z.key === state.selectedKey) ? state.selectedKey : null,
        dirty: true,
      };
    }

    case "MARK_SAVED":
      return { ...state, dirty: false, template: { ...state.template, ...action.patch } };

    default:
      return state;
  }
}
