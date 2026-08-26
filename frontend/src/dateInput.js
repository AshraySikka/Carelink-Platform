// Converts between the UTC timestamps the backend stores and the local
// wall clock values an <input type="datetime-local"> works with.
//
// A datetime-local input has no timezone of its own, it is just a plain
// "YYYY-MM-DDTHH:mm" string. If that string is sent to the backend as is,
// Django (running with TIME_ZONE=UTC) reads it as UTC, silently shifting
// the real moment by the browser's own UTC offset. These two helpers do
// the conversion explicitly in both directions so what the user picks is
// what actually gets saved, and what got saved is what they see back.

// UTC ISO string from the API -> local wall clock string for the input's value.
export function toLocalInputValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Local wall clock string from the input -> a proper UTC ISO string to send.
export function fromLocalInputValue(localValue) {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}