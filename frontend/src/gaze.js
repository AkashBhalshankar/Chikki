// Where Chikki is being asked to look. The draggable sparkle sets a point (in screen coordinates); every Chikki on
// the page turns his eyes toward it. null means "no point: follow the pointer as usual".

let point = null;
const listeners = new Set();

export function setGaze(next) {
  point = next;
  listeners.forEach((listener) => listener(point));
}

export function getGaze() {
  return point;
}

export function onGaze(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
