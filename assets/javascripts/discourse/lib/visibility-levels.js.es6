const HIDDEN = 0;
const SHOWN = 1;

export const VisibilityLevels = {
  HIDDEN,
  SHOWN
};

export function buttonDetails(level) {
  switch (level) {
    case HIDDEN:
      return { id: HIDDEN, key: "hidden", icon: "far-eye-slash" };
    default:
      return { id: SHOWN, key: "shown", icon: "far-eye" };
  }
}

export const allLevels = [
  HIDDEN,
  SHOWN
].map(buttonDetails);
